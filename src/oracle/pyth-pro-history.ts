/**
 * `pyth-pro-history.ts` — Pyth Pro chart history
 * (`GET /v1/{channel}/history`), the TradingView-UDF-shaped bar source that
 * replaces Benchmarks for chart backfill. Bearer-REQUIRED (unlike the symbol
 * catalog): consumers call this server-side with their `PYTH_API_KEY` and
 * keep their own fallback policy (e.g. Benchmarks on 403/5xx while its
 * keyless window lasts).
 *
 * The `symbol` must be FULLY QUALIFIED (`Crypto.BTC/USD`,
 * `Equity.US.AAPL/USD` — the catalog's `symbol` field); a bare pair 404s.
 * `channel` picks the aggregation cadence the key's grant allows (e.g.
 * `fixed_rate@1000ms`).
 */

import { fetchWithPolicy, joinEndpointPath, type FetchPolicy } from "./update-fetch.ts";

/** Same Pyth Pro API base the symbol catalog lives under. */
const PYTH_PRO_API_ENDPOINT = "https://pyth.dourolabs.app";

/**
 * Fetch one history window. Returns the endpoint's TradingView-UDF-style JSON
 * body VERBATIM (`unknown` — e.g. `{ s: "ok", t: [...], o: [...], h: [...],
 * l: [...], c: [...] }`): bar-shape interpretation stays with the charting
 * consumer, the SDK only owns transport + auth. Throws on non-2xx with the
 * body attached (a 403 here is the caller's fallback trigger).
 */
export async function fetchPythProHistory(opts: {
  /** Aggregation channel path segment, e.g. `"fixed_rate@1000ms"`. */
  channel: string;
  /** Fully-qualified reference symbol, e.g. `"Crypto.BTC/USD"`. */
  symbol: string;
  /** UDF resolution, e.g. `"1"`, `"60"`, `"1D"`. */
  resolution: string;
  /** Window start (unix seconds, inclusive). */
  fromSec: number;
  /** Window end (unix seconds, inclusive). */
  toSec: number;
  /** Pyth Pro Bearer key — REQUIRED by the endpoint. */
  apiKey: string;
  fetch?: FetchPolicy;
}): Promise<unknown> {
  const url = joinEndpointPath(PYTH_PRO_API_ENDPOINT, `v1/${opts.channel}/history`);
  url.searchParams.set("symbol", opts.symbol);
  url.searchParams.set("resolution", opts.resolution);
  url.searchParams.set("from", String(opts.fromSec));
  url.searchParams.set("to", String(opts.toSec));
  const res = await fetchWithPolicy(url.toString(), {}, { apiKey: opts.apiKey, ...opts.fetch });
  if (!res.ok) {
    throw new Error(`Pyth Pro history fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
