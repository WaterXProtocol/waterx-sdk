/**
 * `canonical/read.ts` — `readCanonicalPrices`, the REST read of the canonical
 * price plane (see `frame.ts` for what canonical IS and why it is the only
 * off-chain price with the settlement's definition).
 *
 * REST is the SEED, the stream is steady state. A consumer reads this once at
 * boot (the backend's `PriceService` seed), or on every request when nothing
 * else is available (the frontend's BE-down fallback), then follows
 * `openCanonicalStream`. Nothing here reaches a tx build.
 *
 * EVERY REQUESTED TICKER IS A KEY. A consumer iterating its own request list
 * must never find a hole: a symbol the server refused, omitted, or answered
 * with something unparseable comes back as a `status: "unavailable"` quote
 * whose `reason` says which (`unknown_symbol` / `no_canonical_evaluation` from
 * the server's own code table, `not_in_response`, `invalid_<drop reason>`).
 * The contract already makes the SERVER do this for a batch's unknown symbols;
 * the reader extends it to every way a symbol can go unanswered, so "no fresh
 * price" is one branch (`status !== "ok"`) and never an `undefined` check.
 *
 * THE ONLY FALLBACK: per-symbol GETs when the batch route is ABSENT. On
 * 2026-10-08 production exposed `/v1/canonical/{symbol}` only through the
 * gateway's catch-all and had no batch route at all, so a reader that insisted
 * on the batch would have priced nothing. "Absent" is decided exactly as the
 * leaf path decides it ({@link fetchLeafChunk}'s rule): a 404 whose body
 * carries NEITHER an error `code` NOR a `symbol` — a proxy's default 404 page,
 * usually JSON — means nothing served the path; a 404 that carries one is the
 * quote-center itself refusing, which is an error here (the batch route never
 * 404s a symbol, per the contract) and an unavailable quote on the per-symbol
 * route. Nothing else falls back: a 5xx has already spent `fetchWithPolicy`'s
 * retry budget and throws as `FetchPolicyError` verbatim (consumers
 * `instanceof` it), and a 4xx is deterministic and thrown with the server's
 * own wording.
 */

import { parseQuoteCenterError, QUOTE_CENTER_ERROR_CODES } from "../rules/waterx-rule.ts";
import {
  bodySnippet,
  fetchWithPolicy,
  joinEndpointPath,
  readBodySnippet,
  type FetchPolicy,
} from "../update-fetch.ts";
import {
  CANONICAL_BATCH_ROUTE,
  parseCanonicalQuote,
  parseCanonicalText,
  syntheticUnavailable,
  type CanonicalQuote,
} from "./frame.ts";

/** Signature fixed by the cross-repo plan; consumers are coded against it. */
export interface CanonicalReadOptions {
  /** Quote-center base URL. A proxy's own base path is preserved. */
  endpoint: string;
  /** Oracle TICKERS (repo convention); the wire calls them `symbols`. */
  tickers: readonly string[];
  /** The same policy object every oracle fetch takes (timeout / retries / `fetchImpl` / Bearer). */
  fetch?: FetchPolicy;
}

/**
 * `GET /v1/canonical?symbols=…` (per-symbol `GET /v1/canonical/{symbol}`
 * fallback on a bare 404). Never drops a symbol: every requested ticker is a
 * key, a refused or unanswered one `status: "unavailable"` with its `reason`.
 * See the module header for the exact dispositions.
 */
export async function readCanonicalPrices(
  opts: CanonicalReadOptions,
): Promise<Map<string, CanonicalQuote>> {
  const out = new Map<string, CanonicalQuote>();
  if (opts.tickers.length === 0) return out;
  const now = Date.now();

  const batch = await fetchBatch(opts.endpoint, opts.tickers, opts.fetch);
  if ("items" in batch) {
    foldItems(out, batch.items, new Set(opts.tickers), now);
  } else {
    const singles = await Promise.all(
      opts.tickers.map((ticker) =>
        fetchSingle(opts.endpoint, ticker, opts.fetch, batch.routeMissing, now),
      ),
    );
    for (const [ticker, quote] of singles) out.set(ticker, quote);
  }
  for (const ticker of opts.tickers) {
    if (!out.has(ticker)) out.set(ticker, syntheticUnavailable(ticker, "not_in_response"));
  }
  return out;
}

const ACCEPT_JSON = { accept: "application/json" } as const;

async function fetchBatch(
  endpoint: string,
  tickers: readonly string[],
  policy: FetchPolicy | undefined,
): Promise<{ items: unknown[] } | { routeMissing: string }> {
  const url = joinEndpointPath(endpoint, CANONICAL_BATCH_ROUTE);
  url.searchParams.set("symbols", tickers.join(","));
  const res = await fetchWithPolicy(url.toString(), { headers: ACCEPT_JSON }, policy);
  if (res.status === 404) {
    const body = (await res.text()).trim();
    const refusal = parseQuoteCenterError(body);
    if (isRouteMissing(refusal)) {
      return { routeMissing: `GET /${CANONICAL_BATCH_ROUTE} → 404 ${bodySnippet(body)}`.trim() };
    }
    throw new Error(
      `Canonical price read refused: 404 code ${String(refusal!.code)} ` +
        bodySnippet(refusal!.message || body),
    );
  }
  if (!res.ok) throw new Error(`Canonical price read failed: ${await describeFailure(res)}`);
  const text = await res.text();
  const parsed = parseCanonicalText(text) as { items?: unknown } | null;
  if (typeof parsed !== "object" || parsed === null || !Array.isArray(parsed.items)) {
    throw new Error(`Canonical price read returned an unexpected body: ${bodySnippet(text)}`);
  }
  return { items: parsed.items };
}

/** Decode a batch's items into `out`: requested symbols only, first answer per symbol wins. */
function foldItems(
  out: Map<string, CanonicalQuote>,
  items: unknown[],
  requested: ReadonlySet<string>,
  now: number,
): void {
  for (const item of items) {
    const parsed = parseCanonicalQuote(item, now);
    if (typeof parsed === "string") {
      // The defect is keyed on the item's own symbol when it has a usable one;
      // an item with none is unanswerable and its ticker lands in
      // `not_in_response` like any omitted symbol.
      const symbol = (item as { symbol?: unknown } | null)?.symbol;
      if (typeof symbol === "string" && requested.has(symbol) && !out.has(symbol)) {
        out.set(symbol, syntheticUnavailable(symbol, `invalid_${parsed}`));
      }
      continue;
    }
    if (requested.has(parsed.symbol) && !out.has(parsed.symbol)) out.set(parsed.symbol, parsed);
  }
}

async function fetchSingle(
  endpoint: string,
  ticker: string,
  policy: FetchPolicy | undefined,
  batchMissing: string,
  now: number,
): Promise<[string, CanonicalQuote]> {
  const route = `${CANONICAL_BATCH_ROUTE}/${encodeURIComponent(ticker)}`;
  const res = await fetchWithPolicy(
    joinEndpointPath(endpoint, route).toString(),
    { headers: ACCEPT_JSON },
    policy,
  );
  if (res.status === 404) {
    const body = (await res.text()).trim();
    const refusal = parseQuoteCenterError(body);
    if (isRouteMissing(refusal)) {
      throw new Error(
        `Canonical price routes unavailable: ${batchMissing}; GET /${route} → 404 ${bodySnippet(body)}`.trim(),
      );
    }
    // The route answered and refused THIS symbol — that is an answer. Code
    // first (the service's contract), then its human text, then the status.
    const meaning =
      refusal!.code === undefined ? undefined : QUOTE_CENTER_ERROR_CODES[refusal!.code];
    return [ticker, syntheticUnavailable(ticker, meaning ?? (refusal!.message || "http_404"))];
  }
  if (!res.ok) throw new Error(`Canonical price read failed: ${await describeFailure(res)}`);
  const parsed = parseCanonicalQuote(await res.text(), now);
  if (typeof parsed === "string")
    return [ticker, syntheticUnavailable(ticker, `invalid_${parsed}`)];
  if (parsed.symbol !== ticker) {
    return [ticker, syntheticUnavailable(ticker, "invalid_symbol_mismatch")];
  }
  return [ticker, parsed];
}

/**
 * A 404 is "nothing served this path" only when its body names neither an
 * error `code` nor a `symbol` — the leaf path's rule, minus its transitional
 * message shim (the canonical routes postdate the numeric contract).
 */
function isRouteMissing(refusal: ReturnType<typeof parseQuoteCenterError>): boolean {
  return !refusal || (refusal.code === undefined && !refusal.symbol);
}

/** `<status> [code N] <message|snippet>` — the same rendering the rule gives every non-ok response. */
async function describeFailure(res: Response): Promise<string> {
  const body = (await readBodySnippet(res)).trim();
  const parsed = parseQuoteCenterError(body);
  if (!parsed) return `${String(res.status)} ${body}`.trim();
  const code = parsed.code === undefined ? "" : ` code ${String(parsed.code)}`;
  return `${String(res.status)}${code} ${parsed.message || body}`.trim();
}
