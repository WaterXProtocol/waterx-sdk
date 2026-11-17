/**
 * `candles/frame.ts` — the quote-center live candle plane's WIRE CONTRACT
 * (`model::LiveCandleFrame`, `v: 1`): the frame type, its one parser, the
 * per-(symbol, tf) order, {@link candlePointToFrame} (a REST `include_open`
 * point as a frame), and {@link LiveCandleBook}, the small reducer that applies
 * the order, the `void` tombstone and reconnect resync for a consumer.
 *
 * WHAT A FRAME IS. The bar IN FLIGHT for one (symbol, tf) bucket, as the
 * quote-center's leader folds it from the same inputs its ClickHouse rollup
 * persists. Every frame is a FULL snapshot of its bar (never a delta), so a
 * skipped frame costs only latency. ClickHouse's rolled bar (REST
 * `GET /v1/candles/{symbol}`) is authoritative for every closed bucket; a live
 * bar — `closed` included — is provisional until the rollup persists it.
 *
 * THE ORDER. Per (symbol, tf) frames are totally ordered by
 * `(bucket_ms, state === "closed", updated_at_ms)` — the quote-center's own
 * `LiveCandleFrame::order_key`. A relay may SKIP frames (coalescing, lag, a
 * gateway stream ending), never reorder them.
 *
 * THE SNAPSHOT IS NOT GUARANTEED — SEED FROM REST. The quote-service sends the
 * current frame of every matching pair when a stream is opened, but the
 * gateway shares ONE upstream per path + query: a client that joins an
 * upstream another client already opened gets live frames only, so a quiet
 * pair stays empty until its next frame. Seed every (re)connect from REST
 * `GET /v1/candles/{symbol}?tf=…&include_open=true` through
 * {@link candlePointToFrame}, over {@link candleSeedWindow}.
 *
 * A MISSED `void` IS NEVER RE-SENT. The quote-center serves a tombstone
 * neither in a snapshot nor from REST, so one lost to a disconnect or a lagged
 * relay would leave a withdrawn bar live forever. Hence
 * {@link LiveCandleBook.markSuspect}: on each (re)connect, every `open` bar of
 * the reconnected tickers is hidden until a newer frame replaces it or FRESH
 * evidence re-asserts it — a frame of the same bucket the caller vouches was
 * obtained from the server after the mark was set (`apply`'s `evidence`).
 * Ordering alone is never evidence: a REST point carries no production time,
 * so an old (cached) response and a current one look the same.
 *
 * `void` IS A TOMBSTONE. The plane withdraws its live bar for that bucket (a
 * new leader could not vouch for it): drop the bar and read REST. It orders
 * like `open` — a later `open` or `closed` frame of the bucket supersedes it —
 * and its prices are meaningless (zeroed here). `updated_at_ms` is the
 * producing LEADER's wall clock, and a tombstone is issued by a NEW leader
 * about the previous one's bar, so the two clocks are not comparable: a `void`
 * supersedes an `open` frame of its bucket whatever its `updated_at_ms`
 * ({@link supersedesLiveCandleMark}). A tombstone is never re-sent, so losing
 * one to a clock a few ms behind would leave the withdrawn bar live for the
 * rest of its bucket.
 *
 * ONLY THE BAR AND ITS CLOCKS CAN REJECT A FRAME. `v`, `symbol`, `tf`,
 * `state`, `source`, `bucket_ms` and `updated_at_ms` are the identity and the
 * order; a non-`void` frame's `open/high/low/close` are the money. Any of them
 * missing or out of contract (a price that is not positive and finite,
 * `low > high`, `open` / `close` outside `[low, high]`) is `malformed`;
 * `tick_count` (coverage, never volume) is a diagnostic and reads `0` unless it
 * is a non-negative integer. `source` is strict, as it is on
 * the quote-center's own Redis reads. A clock beyond
 * {@link CANDLE_MAX_FUTURE_DRIFT_MS} is `bad_timestamp`: the same wedging guard
 * as the canonical plane's, since "newer key wins" would otherwise pin a pair
 * on one far-future frame for the process lifetime.
 */

import {
  CANONICAL_MAX_FUTURE_DRIFT_MS,
  CANONICAL_MAX_SYMBOLS_PER_REQUEST,
} from "../canonical/frame.ts";

/** WebSocket `GET /v1/candles/stream?symbols=A,B&tf=1m,5m` — one {@link LiveCandleFrame} JSON object per frame. */
export const CANDLE_STREAM_ROUTE = "v1/candles/stream";
/**
 * The quote-center answers more than this many symbols in one subscription
 * with a 400 (code 10003, `TooManySymbols`; the same `MAX_SIGNED_LEAVES` cap as
 * the canonical stream). `openCandleStream` shards at this size.
 */
export const CANDLE_MAX_SYMBOLS_PER_REQUEST = CANONICAL_MAX_SYMBOLS_PER_REQUEST;
/** Same budget and rationale as {@link CANONICAL_MAX_FUTURE_DRIFT_MS}: a wedging guard, not a freshness policy. */
export const CANDLE_MAX_FUTURE_DRIFT_MS = CANONICAL_MAX_FUTURE_DRIFT_MS;

/** Every timeframe the live candle plane serves (`valid_candle_tfs` in the quote-center). */
export const CANDLE_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
export type CandleTimeframe = (typeof CANDLE_TIMEFRAMES)[number];
/** Bucket width per timeframe; buckets are UTC epoch-floor aligned to it. */
export const CANDLE_TIMEFRAME_MS: Readonly<Record<CandleTimeframe, number>> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export const LIVE_CANDLE_STATES = ["open", "closed", "void"] as const;
export type LiveCandleState = (typeof LIVE_CANDLE_STATES)[number];
export const LIVE_CANDLE_SOURCES = ["canonical", "bbo"] as const;
export type LiveCandleSource = (typeof LIVE_CANDLE_SOURCES)[number];

/**
 * One live candle frame — byte-identical on the stream and in the
 * quote-center's KV. Field names are the wire's (snake_case).
 */
export interface LiveCandleFrame {
  v: 1;
  symbol: string;
  tf: CandleTimeframe;
  /** The bucket's open time, unix ms, UTC epoch-floor aligned to `tf`. */
  bucket_ms: number;
  /** Display floats (the plane's ScaledDecimal(9)). `0` on a `void` frame. */
  open: number;
  high: number;
  low: number;
  close: number;
  /** Distinct folded timestamps — coverage, NEVER volume (the plane carries none). */
  tick_count: number;
  state: LiveCandleState;
  /** `canonical` when every folded minute was canonical, `bbo` when any fell back to BBO ticks. */
  source: LiveCandleSource;
  /** The leader's wall clock when the frame was produced; the last component of the order. */
  updated_at_ms: number;
}

export const CANDLE_DROP_REASONS = [
  /** Not JSON, not a `v: 1` frame, an unknown `tf` / `state` / `source`, a misaligned bucket, or a non-`void` bar with a non-positive / non-finite price, `low > high`, or `open` / `close` outside `[low, high]`. */
  "malformed",
  /** `bucket_ms` or `updated_at_ms` beyond {@link CANDLE_MAX_FUTURE_DRIFT_MS}. */
  "bad_timestamp",
  /** Stream only: a (symbol, tf) this client did not subscribe. */
  "unsolicited",
  /** Stream only: a frame ordered BELOW the last delivered one for its (symbol, tf). */
  "out_of_order",
  /** Stream only: the same order key as the last delivered frame for its (symbol, tf), on the same connection (the first equal frame on a NEW connection is delivered — see `openCandleStream`'s guard). */
  "duplicate",
] as const;
export type CandleDropReason = (typeof CANDLE_DROP_REASONS)[number];

const TIMEFRAME_SET: ReadonlySet<string> = new Set(CANDLE_TIMEFRAMES);
const STATE_SET: ReadonlySet<string> = new Set(LIVE_CANDLE_STATES);
const SOURCE_SET: ReadonlySet<string> = new Set(LIVE_CANDLE_SOURCES);

export function isCandleTimeframe(value: unknown): value is CandleTimeframe {
  return typeof value === "string" && TIMEFRAME_SET.has(value);
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/**
 * The frame, or the drop reason. Accepts the JSON text or an already-parsed
 * value. Untrusted input: never throws. See the module header for what can
 * reject a frame.
 */
export function parseLiveCandleFrame(
  input: unknown,
  nowMs: number = Date.now(),
): LiveCandleFrame | CandleDropReason {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return "malformed";
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "malformed";
  const f = raw as Record<string, unknown>;
  if (f.v !== 1) return "malformed";
  const { symbol, tf, state, source, bucket_ms, updated_at_ms } = f;
  if (typeof symbol !== "string" || symbol === "") return "malformed";
  if (!isCandleTimeframe(tf)) return "malformed";
  if (typeof state !== "string" || !STATE_SET.has(state)) return "malformed";
  if (typeof source !== "string" || !SOURCE_SET.has(source)) return "malformed";
  if (!Number.isSafeInteger(bucket_ms) || !Number.isSafeInteger(updated_at_ms)) {
    return "malformed";
  }
  const bucketMs = bucket_ms as number;
  const updatedAtMs = updated_at_ms as number;
  if (bucketMs < 0 || updatedAtMs < 0) return "malformed";
  // On its timeframe's UTC grid, or it can never line up with a rolled bar.
  if (bucketMs % CANDLE_TIMEFRAME_MS[tf] !== 0) return "malformed";
  const horizon = nowMs + CANDLE_MAX_FUTURE_DRIFT_MS;
  if (bucketMs > horizon || updatedAtMs > horizon) return "bad_timestamp";

  const isVoid = state === "void";
  if (!isVoid) {
    const { open, high, low, close } = f;
    if (
      !isPositiveFinite(open) ||
      !isPositiveFinite(high) ||
      !isPositiveFinite(low) ||
      !isPositiveFinite(close) ||
      low > high ||
      open < low ||
      open > high ||
      close < low ||
      close > high
    ) {
      return "malformed";
    }
  }
  const tickCount = f.tick_count;
  return {
    v: 1,
    symbol,
    tf,
    bucket_ms: bucketMs,
    // A tombstone's prices are never read: zero them so none can leak.
    open: isVoid ? 0 : (f.open as number),
    high: isVoid ? 0 : (f.high as number),
    low: isVoid ? 0 : (f.low as number),
    close: isVoid ? 0 : (f.close as number),
    tick_count:
      Number.isSafeInteger(tickCount) && (tickCount as number) >= 0 ? (tickCount as number) : 0,
    state: state as LiveCandleState,
    source: source as LiveCandleSource,
    updated_at_ms: updatedAtMs,
  };
}

/**
 * The plane's per-(symbol, tf) total order, `(bucket_ms, state === "closed",
 * updated_at_ms)`; `void` orders like `open`. Negative: `a` is older than `b`;
 * `0`: the same key (a replay); positive: `a` is newer. Only meaningful for two
 * frames of the same (symbol, tf). This is the server's `order_key` verbatim;
 * consumers tracking a pair's newest frame use
 * {@link supersedesLiveCandleMark}, which adds the cross-leader `void` rule.
 */
export function compareLiveCandleFrames(a: LiveCandleFrame, b: LiveCandleFrame): number {
  if (a.bucket_ms !== b.bucket_ms) return a.bucket_ms - b.bucket_ms;
  const ac = a.state === "closed" ? 1 : 0;
  const bc = b.state === "closed" ? 1 : 0;
  if (ac !== bc) return ac - bc;
  return a.updated_at_ms - b.updated_at_ms;
}

/**
 * Does `frame` supersede `mark`, the newest frame kept for its (symbol, tf)?
 * {@link compareLiveCandleFrames} `> 0`, plus: a `void` supersedes an `open`
 * mark of the SAME bucket whatever its `updated_at_ms` (see "`void` IS A
 * TOMBSTONE" in the module header). It never supersedes a `closed` mark (the
 * plane only withdraws open bars) and orders normally against another `void`.
 */
export function supersedesLiveCandleMark(frame: LiveCandleFrame, mark: LiveCandleFrame): boolean {
  if (frame.state === "void" && mark.state === "open" && frame.bucket_ms === mark.bucket_ms) {
    return true;
  }
  return compareLiveCandleFrames(frame, mark) > 0;
}

/**
 * The mark to keep after `frame` superseded `mark`: `frame`, except that a
 * `void` accepted with an `updated_at_ms` BELOW the mark's keeps the mark's —
 * the watermark never moves backwards inside a bucket, so the withdrawn bar's
 * own older frames cannot be replayed past the tombstone. The cost: the new
 * leader's later frames of that bucket are held back until its clock passes
 * the old leader's last stamp (the skew between two NTP-synced hosts).
 */
export function nextLiveCandleMark(
  frame: LiveCandleFrame,
  mark: LiveCandleFrame | undefined,
): LiveCandleFrame {
  if (
    mark !== undefined &&
    frame.state === "void" &&
    frame.bucket_ms === mark.bucket_ms &&
    mark.updated_at_ms > frame.updated_at_ms
  ) {
    return { ...frame, updated_at_ms: mark.updated_at_ms };
  }
  return frame;
}

/** The map key {@link LiveCandleBook} (and the stream's guard) keep a pair under. */
export function liveCandleKey(ticker: string, tf: CandleTimeframe): string {
  return `${ticker}\u0000${tf}`;
}

/**
 * One point of REST `GET /v1/candles/{symbol}?tf=…&include_open=true`
 * (`model::CandlePoint`). `state` / `source` are present ONLY on the live bars
 * `include_open` appends; a ClickHouse-rolled bar omits both.
 */
export interface CandlePoint {
  timestamp_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  count: number;
  state?: string;
  source?: string;
}

/**
 * A REST `include_open` LIVE point as a {@link LiveCandleFrame}, so a seed can
 * be merged through {@link LiveCandleBook}; `undefined` for a rolled point (no
 * `state` — it is history, not a live bar) or anything out of contract.
 *
 * `updated_at_ms` is `0`, never the local clock: REST does not carry the
 * leader's production time, and a local `Date.now()` running ahead of the
 * leader would make every real stream frame of that bucket look older than
 * the seed. With `0`, any stream frame of the bucket supersedes the seed.
 * `count` maps to `tick_count`. `seedLiveCandles` is the caller most
 * consumers want.
 */
export function candlePointToFrame(
  point: CandlePoint,
  ticker: string,
  tf: CandleTimeframe,
  nowMs: number = Date.now(),
): LiveCandleFrame | undefined {
  if (point.state === undefined) return undefined;
  const frame = parseLiveCandleFrame(
    {
      v: 1,
      symbol: ticker,
      tf,
      bucket_ms: point.timestamp_ms,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      tick_count: point.count,
      state: point.state,
      source: point.source,
      updated_at_ms: 0,
    },
    nowMs,
  );
  return typeof frame === "string" || frame.state === "void" ? undefined : frame;
}

/**
 * The `from` / `to` (unix ms) to seed one timeframe with: REST
 * `GET /v1/candles/{symbol}?tf=…&from=…&to=…&include_open=true`. The window is
 * the previous bucket and the current one, so the answer holds at most two
 * rolled points plus the live bars.
 *
 * Do NOT seed with a wide window: the route returns rolled points OLDEST first
 * up to `limit` (default 1000) and appends the live bars only when fewer rolled
 * points than `limit` came back — a day of 1m bars for a 24/7 pair is the 1000
 * oldest minutes and no live bar at all.
 */
export function candleSeedWindow(
  tf: CandleTimeframe,
  nowMs: number = Date.now(),
): { from: number; to: number } {
  const width = CANDLE_TIMEFRAME_MS[tf];
  return { from: Math.floor(nowMs / width) * width - width, to: nowMs };
}

/** What {@link LiveCandleBook.apply} did with a frame. */
export type LiveCandleApplyResult = "applied" | "voided" | "reasserted" | "stale";

/**
 * When a frame handed to {@link LiveCandleBook.apply} was OBTAINED from the
 * server: for a stream frame, when it was received; for a REST seed, when the
 * request was SENT (minus the response's `Age`, if any). It is the caller's
 * statement — the book cannot check it.
 */
export interface LiveCandleEvidence {
  observedAtMs: number;
}

/**
 * The newest live bar per (symbol, tf), with the order, `void` and reconnect
 * resync applied:
 *
 *   - a frame that supersedes the pair's last one
 *     ({@link supersedesLiveCandleMark}) is `applied` and becomes the pair's
 *     bar (a `void` frame is `voided`: {@link bar} answers `undefined` for the
 *     pair until a newer `open` / `closed` frame arrives — read that bucket
 *     from REST);
 *   - a frame that does NOT supersede a SUSPECT bar (see {@link markSuspect})
 *     but is an `open` frame of its bucket, passed with `evidence` observed at
 *     or after the mark, and either a REST seed (`updated_at_ms: 0`) or the
 *     bar's own key re-sent, is `reasserted`: the bar is shown again with the
 *     frame's OHLC / `tick_count` / `source`, keeping its own `updated_at_ms`
 *     as the ordering watermark;
 *   - anything else is `stale` (ignored) — including the same frame WITHOUT
 *     evidence, an older-stamped stream frame, and evidence observed before
 *     the mark. A stale frame never clears a suspect mark.
 *
 * RESIDUAL RISK of a re-assertion. `evidence` is trusted: a caller that stamps
 * a cached response as fresh re-asserts a withdrawn bar (`seedLiveCandles`
 * sends `Cache-Control: no-cache` and subtracts the response's `Age`, but an
 * intermediary that ignores both is invisible to it). And a re-assertion
 * observed just before a tombstone is written is honest but short-lived — the
 * `void` then arrives on the (already open) stream and withdraws the bar.
 *
 * It never ages bars out — a `closed` bar stays the pair's bar until a newer
 * frame replaces it; deciding when a bar is too old to show (and refetching
 * closed buckets from REST, which wins) is the consumer's.
 */
export class LiveCandleBook {
  private readonly last = new Map<string, LiveCandleFrame>();
  /** Pairs whose `open` bar awaits re-assertion → when the mark was set (epoch ms). */
  private readonly suspect = new Map<string, number>();

  apply(frame: LiveCandleFrame, evidence?: LiveCandleEvidence): LiveCandleApplyResult {
    const key = liveCandleKey(frame.symbol, frame.tf);
    const prev = this.last.get(key);
    if (prev !== undefined && !supersedesLiveCandleMark(frame, prev)) {
      const suspectSince = this.suspect.get(key);
      if (
        suspectSince !== undefined &&
        evidence !== undefined &&
        evidence.observedAtMs >= suspectSince &&
        frame.state === "open" &&
        frame.bucket_ms === prev.bucket_ms &&
        (frame.updated_at_ms === 0 || frame.updated_at_ms === prev.updated_at_ms)
      ) {
        this.suspect.delete(key);
        // The re-asserting frame is the server's CURRENT bar: show its values,
        // not the pre-outage ones. The watermark stays `prev`'s, so a seed
        // (`updated_at_ms: 0`) cannot lower it and let an older frame back in.
        this.last.set(key, { ...frame, updated_at_ms: prev.updated_at_ms });
        return "reasserted";
      }
      return "stale";
    }
    // The tombstone is KEPT as the pair's last frame: it is the watermark an
    // older replayed `open` frame of the withdrawn bucket must not get past.
    this.last.set(key, nextLiveCandleMark(frame, prev));
    this.suspect.delete(key);
    return frame.state === "void" ? "voided" : "applied";
  }

  /**
   * Hide every `open` bar of `tickers` (every ticker when omitted) until a
   * newer frame replaces it or fresh evidence re-asserts it (see the class
   * doc). Call it when a stream shard (re)connects (`onConnection` `opened`,
   * with that shard's tickers), BEFORE seeding: a `void` the outage swallowed
   * is never re-sent, so a bar nothing re-asserts is treated as withdrawn.
   * `closed` bars are final and stay. `atMs` is the moment evidence must be
   * observed at or after; marking an already-suspect pair moves it forward.
   */
  markSuspect(tickers?: readonly string[], atMs: number = Date.now()): void {
    const only = tickers === undefined ? undefined : new Set(tickers);
    for (const [key, frame] of this.last) {
      if (frame.state === "open" && (only === undefined || only.has(frame.symbol))) {
        this.suspect.set(key, atMs);
      }
    }
  }

  /** The pair's current live bar, or `undefined` when there is none, it was voided, or it is suspect. */
  bar(ticker: string, tf: CandleTimeframe): LiveCandleFrame | undefined {
    const key = liveCandleKey(ticker, tf);
    const frame = this.last.get(key);
    return frame === undefined || frame.state === "void" || this.suspect.has(key)
      ? undefined
      : frame;
  }

  /** Every pair's current live bar (neither voided nor suspect). */
  bars(): LiveCandleFrame[] {
    return [...this.last.entries()]
      .filter(([key, frame]) => frame.state !== "void" && !this.suspect.has(key))
      .map(([, frame]) => frame);
  }

  /** Forget a pair (e.g. after its bucket was refetched from REST). */
  delete(ticker: string, tf: CandleTimeframe): void {
    const key = liveCandleKey(ticker, tf);
    this.last.delete(key);
    this.suspect.delete(key);
  }

  clear(): void {
    this.last.clear();
    this.suspect.clear();
  }
}
