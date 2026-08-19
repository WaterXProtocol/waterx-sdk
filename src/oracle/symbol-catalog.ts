/**
 * `symbol-catalog.ts` — the Pyth Pro symbol catalog (`GET /v1/symbols`):
 * every Lazer feed's integer id, its legacy Hermes hex id, its
 * fully-qualified reference symbol (`Crypto.BTC/USD`, `Equity.US.AAPL/USD`),
 * its `schedule` string (same grammar `parsePythSchedule` implements), asset
 * type, state, and fastest channel. This replaces the retired Hermes
 * `/v2/price_feeds` catalog for BOTH of its jobs: the schedule catalog for
 * market hours AND the hex↔integer feed-id map.
 *
 * KEYLESS — the catalog read requires no Bearer (probed 2026-08-19), so
 * schedule consumers need no credential. It is also BIG (~4.6MB, ~3.6k
 * records), hence the generous default timeout; consumers cache the result
 * (BE service interval-refreshes; FE route caches) rather than fetch per
 * request.
 */

import { fetchWithPolicy, joinEndpointPath, type FetchPolicy } from "./update-fetch.ts";

/** The Pyth Pro API base the catalog (and history) endpoints live under. */
const PYTH_PRO_API_ENDPOINT = "https://pyth.dourolabs.app";

/** ~4.6MB body — a money-path 15s budget is too tight on slow links. */
const CATALOG_TIMEOUT_MS = 60_000;

/**
 * One `/v1/symbols` record (the fields consumers key off; extra wire fields
 * are dropped, not preserved).
 */
export type PythSymbolRecord = {
  /** Integer Lazer feed id — the `pyth_lazer_rule.feeds` id scheme. */
  pyth_lazer_id: number;
  /** Legacy Hermes hex feed id, or null for Lazer-only feeds. */
  hermes_id: string | null;
  /** Fully-qualified reference symbol, e.g. `Crypto.BTC/USD` — the join key consumers map tickers onto. */
  symbol: string;
  /** Pyth market-hours grammar string (absent for some 24/7 feeds). */
  schedule?: string;
  /** e.g. `"crypto"`, `"equity"`, `"fx"`, `"metal"`. */
  asset_type: string;
  /** Feed lifecycle state (e.g. `"stable"`). */
  state: string;
  /** Fastest channel the feed publishes (e.g. `"real_time"`, `"fixed_rate@200ms"`). */
  min_channel?: string;
};

/**
 * Fetch the full symbol catalog. Returns records with a numeric
 * `pyth_lazer_id` and a string `symbol`; other fields pass through as-is
 * (missing → undefined/null per the type). Throws on non-2xx or a non-array
 * body. `opts.fetch` overrides the retry/timeout policy (and `fetchImpl` for
 * tests); the default budget is deliberately generous — see the module
 * header.
 */
export async function fetchPythSymbolCatalog(opts?: {
  fetch?: FetchPolicy;
}): Promise<PythSymbolRecord[]> {
  const url = joinEndpointPath(PYTH_PRO_API_ENDPOINT, "v1/symbols");
  const res = await fetchWithPolicy(
    url.toString(),
    {},
    { timeoutMs: CATALOG_TIMEOUT_MS, ...opts?.fetch },
  );
  if (!res.ok) {
    throw new Error(`Pyth symbol catalog fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as unknown;
  if (!Array.isArray(json)) {
    throw new Error("Pyth symbol catalog returned a non-array body");
  }
  const records: PythSymbolRecord[] = [];
  for (const raw of json as Record<string, unknown>[]) {
    // Tolerant per-record gate: one malformed row must not sink the ~3.6k
    // others (mirrors the schedule parser's skip-a-bad-feed posture).
    if (typeof raw?.pyth_lazer_id !== "number" || typeof raw.symbol !== "string") continue;
    records.push({
      pyth_lazer_id: raw.pyth_lazer_id,
      hermes_id: typeof raw.hermes_id === "string" ? raw.hermes_id : null,
      symbol: raw.symbol,
      ...(typeof raw.schedule === "string" ? { schedule: raw.schedule } : {}),
      asset_type: typeof raw.asset_type === "string" ? raw.asset_type : "",
      state: typeof raw.state === "string" ? raw.state : "",
      ...(typeof raw.min_channel === "string" ? { min_channel: raw.min_channel } : {}),
    });
  }
  return records;
}
