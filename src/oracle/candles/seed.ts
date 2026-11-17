/**
 * `candles/seed.ts` — `seedLiveCandles`, the REST seed every (re)connect of
 * `openCandleStream` needs: the stream alone guarantees no snapshot (the
 * gateway shares upstreams) and never re-sends a missed `void`, so on each
 * `opened` a consumer marks the shard's bars suspect and seeds them from
 * `GET /v1/candles/{symbol}?tf=…&from=…&to=…&include_open=true`.
 *
 * It is a helper rather than a README recipe because the recipe has four ways
 * to go wrong: a wide window returns no live bar (`candleSeedWindow`), serial
 * requests hide a 32-ticker × 6-timeframe shard's bars for 192 round trips, an
 * unhandled rejection from one failed request kills a Node process, and a
 * seed is only evidence when it is FRESH. So: one two-bucket request per
 * (ticker, timeframe), a bounded number in flight, every failure caught and
 * reported in the result (the promise never rejects), and each response's
 * observation time — when its request was SENT, minus the response's `Age` —
 * handed to `LiveCandleBook.apply` as evidence. Requests carry
 * `Cache-Control: no-cache`: the route sets no cache headers of its own, so
 * an intermediary may otherwise answer from a heuristic cache.
 */

import { fetchWithPolicy, joinEndpointPath, type FetchPolicy } from "../update-fetch.ts";
import {
  CANDLE_TIMEFRAMES,
  candlePointToFrame,
  candleSeedWindow,
  isCandleTimeframe,
  type CandlePoint,
  type CandleTimeframe,
  type LiveCandleBook,
} from "./frame.ts";

/** `GET /v1/candles/{symbol}` — rolled points, plus the live bars with `include_open=true`. */
export const CANDLES_ROUTE = "v1/candles";

const DEFAULT_CONCURRENCY = 8;

export interface SeedLiveCandlesOptions {
  /** Quote-center http(s) base URL, as for the stream; a proxy base path is preserved. */
  endpoint: string;
  /** The tickers to seed — on an `opened` event, that event's `tickers`. */
  tickers: readonly string[];
  /** Default: all of {@link CANDLE_TIMEFRAMES}. Pass the stream's. */
  timeframes?: readonly CandleTimeframe[];
  /** The book the live points are applied to (with fresh evidence). */
  book: LiveCandleBook;
  /** Request headers (e.g. `X-Internal-Key`), added to `Accept` and `Cache-Control: no-cache`. */
  headers?: Record<string, string>;
  /** The same policy object every oracle fetch takes (timeout / retries / `fetchImpl` / Bearer). */
  fetch?: FetchPolicy;
  /** Requests in flight at once. Default 8. */
  concurrency?: number;
}

export interface SeedLiveCandlesResult {
  /** Requests attempted: one per (ticker, timeframe). */
  requests: number;
  /** Live points that became a pair's bar. */
  applied: number;
  /** Live points that re-asserted a suspect bar. */
  reasserted: number;
  /** Requests that failed; their pairs were not seeded (a suspect bar stays hidden until the stream replaces it). */
  failures: { ticker: string; timeframe: string; error: string }[];
}

/**
 * Seed `book` from REST for `tickers` × `timeframes`. Never rejects: a failed
 * request is an entry in `failures`. Call it on every `opened` event, AFTER
 * `book.markSuspect(event.tickers)`. See the module header.
 */
export async function seedLiveCandles(
  opts: SeedLiveCandlesOptions,
): Promise<SeedLiveCandlesResult> {
  const result: SeedLiveCandlesResult = { requests: 0, applied: 0, reasserted: 0, failures: [] };
  const tickers = [...new Set(opts.tickers.map((t) => t.trim()).filter((t) => t !== ""))];
  const timeframes = [...new Set<string>(opts.timeframes ?? CANDLE_TIMEFRAMES)];
  const jobs: { ticker: string; timeframe: string }[] = [];
  for (const ticker of tickers)
    for (const timeframe of timeframes) jobs.push({ ticker, timeframe });
  result.requests = jobs.length;

  const seedOne = async (ticker: string, timeframe: string): Promise<void> => {
    if (!isCandleTimeframe(timeframe)) throw new Error(`unknown timeframe ${timeframe}`);
    const { from, to } = candleSeedWindow(timeframe);
    const url = joinEndpointPath(opts.endpoint, `${CANDLES_ROUTE}/${encodeURIComponent(ticker)}`);
    url.searchParams.set("tf", timeframe);
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));
    url.searchParams.set("include_open", "true");
    const sentAt = Date.now();
    const res = await fetchWithPolicy(
      url.toString(),
      { headers: { ...opts.headers, Accept: "application/json", "Cache-Control": "no-cache" } },
      opts.fetch,
    );
    if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
    // A response served from a cache says how old it is; an absent or
    // unparsable `Age` is 0. Evidence older than a suspect mark re-asserts nothing.
    const age = Number(res.headers.get("age") ?? "0");
    const observedAtMs = sentAt - (Number.isFinite(age) && age > 0 ? age * 1_000 : 0);
    const points: unknown = await res.json();
    if (!Array.isArray(points)) throw new Error("response is not an array of candle points");
    for (const point of points) {
      if (typeof point !== "object" || point === null) continue;
      const frame = candlePointToFrame(point as CandlePoint, ticker, timeframe);
      if (frame === undefined) continue; // a rolled (history) point
      const outcome = opts.book.apply(frame, { observedAtMs });
      if (outcome === "applied") result.applied++;
      else if (outcome === "reasserted") result.reasserted++;
    }
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    for (let job = jobs[next++]; job !== undefined; job = jobs[next++]) {
      try {
        await seedOne(job.ticker, job.timeframe);
      } catch (err) {
        result.failures.push({
          ticker: job.ticker,
          timeframe: job.timeframe,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  };
  const width = Math.max(
    1,
    Math.min(Math.floor(opts.concurrency ?? DEFAULT_CONCURRENCY), jobs.length),
  );
  await Promise.all(Array.from({ length: width }, worker));
  return result;
}
