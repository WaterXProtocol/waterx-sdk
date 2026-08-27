/**
 * `pyth-pro-history.ts` — Pyth Pro chart history
 * (`GET /v1/{channel}/history`), the TradingView-UDF-shaped bar source that
 * replaced Benchmarks for chart backfill (the 2026-08-26 Core retirement
 * cutover removed Benchmarks outright — 404 on every path, Bearer or not).
 * Bearer-REQUIRED (unlike the symbol catalog): consumers call this
 * server-side with their `PYTH_API_KEY`.
 *
 * The `symbol` must be FULLY QUALIFIED (`Crypto.BTC/USD`,
 * `Equity.US.AAPL/USD` — the catalog's `symbol` field); a bare pair 404s.
 * `channel` picks the aggregation cadence the key's grant allows (e.g.
 * `fixed_rate@1000ms`).
 */

import { PYTH_PRO_API_ENDPOINT } from "./symbol-catalog.ts";
import { fetchWithPolicy, joinEndpointPath, type FetchPolicy } from "./update-fetch.ts";

/**
 * Thrown by {@link fetchPythProHistory} on a non-2xx response. The message
 * keeps the historical shape (`Pyth Pro history fetch failed: <status>
 * <body>`), but consumers should branch on `instanceof PythProHistoryError`
 * + `.status` (e.g. `403` for the entitlement fallback) instead of parsing
 * the message. A retry-exhausted transport failure (429/5xx budget spent,
 * network error) is NOT wrapped — it stays `fetchWithPolicy`'s own
 * `FetchPolicyError`.
 */
export class PythProHistoryError extends Error {
  /** HTTP status of the failed response (e.g. `403` unentitled, `404` unknown symbol). */
  readonly status: number;

  constructor(status: number, body: string) {
    super(`Pyth Pro history fetch failed: ${status} ${body}`);
    this.name = "PythProHistoryError";
    this.status = status;
  }
}

/**
 * Fetch one history window. Returns the endpoint's TradingView-UDF-style JSON
 * body VERBATIM (`unknown` — e.g. `{ s: "ok", t: [...], o: [...], h: [...],
 * l: [...], c: [...] }`): bar-shape interpretation stays with the charting
 * consumer, the SDK only owns transport + auth. Throws
 * {@link PythProHistoryError} on non-2xx with the body attached — branch on
 * `instanceof` + `.status` (a 403 here is the caller's fallback trigger),
 * not on the message text.
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
  // `opts.fetch` is the full `FetchPolicy`, which itself has an `apiKey`, so
  // spreading it AFTER the explicit one let `{ fetch: { apiKey: undefined } }`
  // silently strip the Bearer this endpoint requires — a 403 with no clue why.
  // The dedicated argument wins; the policy supplies it only as a fallback.
  const res = await fetchWithPolicy(
    url.toString(),
    {},
    { ...opts.fetch, apiKey: opts.apiKey ?? opts.fetch?.apiKey },
  );
  if (!res.ok) {
    throw new PythProHistoryError(res.status, await res.text());
  }
  return res.json();
}
