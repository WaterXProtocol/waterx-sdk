/**
 * `quote-center-error.ts` — the WaterX quote-center's ERROR CONTRACT, in one
 * place for every path that talks to it: the signed-leaf fetch (`rules/waterx-rule.ts`)
 * and the canonical price reads (`canonical/read.ts`).
 *
 * Error identity belongs to the service, not to prose: a reworded message must
 * never change SDK behaviour. {@link QUOTE_CENTER_ERROR_CODES} is the ONE place a
 * wire code is given meaning; {@link classifyQuoteCenter404} is the ONE
 * definition of "nothing served this path" vs "the route answered and refused";
 * {@link describeQuoteCenterFailure} is the ONE rendering of a non-ok response.
 * Two consumers each re-deriving these is how a refinement to one (a new code, a
 * new status rule) silently fails to reach the other.
 */

import { bodySnippet, readBodySnippet } from "./update-fetch.ts";

/**
 * Values are the quote-center's published enum (`ErrorCode` in
 * `quote-service/src/api.rs`), which is APPEND-ONLY — a number is never reused
 * or renumbered, because clients pin it. Add a row here when the service adds
 * one; nothing else in the SDK changes.
 */
export type QuoteCenterErrorMeaning = "unknown_symbol" | "no_canonical_evaluation";
export const QUOTE_CENTER_ERROR_CODES: Readonly<Record<number, QuoteCenterErrorMeaning>> = {
  /** `ErrorCode::UnknownSymbol` — the symbol is not one the service signs. */
  10001: "unknown_symbol",
  /**
   * `ErrorCode::NoCanonicalEvaluation` — a mirrored symbol the canonical plane
   * has not evaluated (probed 2026-10-08 on production: XAUTUSD / AAPLXUSD).
   * The canonical reader turns it into a quote `reason`; on the leaf route it is
   * simply "not peelable".
   */
  10009: "no_canonical_evaluation",
};

/** One quote-center error body, parsed. `code` is the contract; `message` is for humans. */
export interface QuoteCenterError {
  /** Numeric wire code (`ErrorCode as u32`). Absent on deployments predating the contract. */
  code?: number;
  /** Symbol the service named, when it named one. */
  symbol?: string;
  /** Human-readable text. NEVER used for control flow — display and debugging only. */
  message: string;
}

/**
 * Parse any quote-center error body. Returns `null` when the body is not a JSON
 * object, which is itself one signal that nothing served the path (see
 * {@link classifyQuoteCenter404}).
 *
 * `code` is a JSON NUMBER: the service serializes `ErrorCode as u32`.
 */
export function parseQuoteCenterError(body: string): QuoteCenterError | null {
  if (!body) return null;
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  const code = typeof o.code === "number" && Number.isFinite(o.code) ? o.code : undefined;
  const message =
    typeof o.error === "string" ? o.error : typeof o.message === "string" ? o.message : "";
  const symbol = typeof o.symbol === "string" && o.symbol ? o.symbol : undefined;
  return { code, symbol, message };
}

/** Semantic meaning of a parsed error, via the contract table — `undefined` when unmapped. */
export function quoteCenterErrorMeaning(
  err: QuoteCenterError,
): QuoteCenterErrorMeaning | undefined {
  return err.code === undefined ? undefined : QUOTE_CENTER_ERROR_CODES[err.code];
}

/**
 * Recover the symbol an unknown-symbol refusal names.
 *
 * TRANSITIONAL. `symbol` is the field that should carry this and is read first.
 * The message parse exists only because an older quote-center sends neither a
 * code nor a symbol field — it is the one place text is still read, it can only
 * ever produce a NAME (never a routing decision), and it is deleted the moment
 * every deployed service emits `{ code, symbol }`.
 */
export function namedQuoteCenterSymbol(err: QuoteCenterError): string | undefined {
  if (err.symbol) return err.symbol;
  const raw = /unknown (?:signed )?symbol[:\s]+(\S+)/i.exec(err.message)?.[1];
  // Trim quoting/punctuation the wording may wrap the name in. A capture of
  // `"XAGUSD"` or `XAGUSD,` is not a ticker: it fails a caller's
  // `remaining.includes` check and turns a graceful per-symbol peel into a
  // thrown refresh.
  return raw?.replace(/^["'`]+|["'`.,;:]+$/g, "") || undefined;
}

/** The two things a quote-center 404 can mean. */
export type QuoteCenter404 =
  /** Nothing served this path: `detail` is `GET /<route> → 404 <snippet>`, ready to join into a ladder's final error. */
  | { kind: "route_missing"; detail: string }
  /** The route answered and refused. `shown` is the bounded text for an error message. */
  | { kind: "refusal"; refusal: QuoteCenterError; shown: string };

/**
 * Classify a 404 from the quote-center (consumes the body).
 *
 * A refusal is only credible as "the ROUTE answered" when the body carries
 * something only the quote-center would send: a `code` from its error contract,
 * or the name of a symbol. A 404 with NEITHER is indistinguishable from a
 * generic 404 page — and every framework-default 404 is JSON
 * (`{"error":"not found"}` from Express/Next/Cloudflare), so keying
 * route-missing on "body did not parse as JSON" would strand exactly the
 * same-origin proxy the rule documents. Structured-but-anonymous ⇒ route
 * missing; the caller tries its next rung or route, and if none answers its
 * final error names every attempt.
 *
 * Every string here is truncated: the body is parsed in full, but these ride
 * into thrown Errors on the tx-build path, and a proxy or CDN can 404 with a
 * multi-kilobyte HTML page.
 */
export async function classifyQuoteCenter404(
  res: Response,
  route: string,
): Promise<QuoteCenter404> {
  const body = (await res.text()).trim();
  const refusal = parseQuoteCenterError(body);
  const shown = bodySnippet(refusal?.message || body);
  if (!refusal || (refusal.code === undefined && !namedQuoteCenterSymbol(refusal))) {
    return { kind: "route_missing", detail: `GET /${route} → 404 ${shown}`.trim() };
  }
  return { kind: "refusal", refusal, shown };
}

/**
 * One rendering for every non-ok quote-center response: status, the numeric
 * code when the body carries one, and the human message. Codes reach the
 * operator on EVERY error path, not just the 404s the classifier inspects, so a
 * service that starts emitting them is immediately legible in logs.
 */
export async function describeQuoteCenterFailure(res: Response): Promise<string> {
  // `readBodySnippet`, not a bare `res.text()`: a proxy can answer a 502 with
  // a multi-kilobyte HTML page, and this string ends up inside a thrown Error
  // on the tx-build path.
  const body = (await readBodySnippet(res)).trim();
  const parsed = parseQuoteCenterError(body);
  if (!parsed) return `${String(res.status)} ${body}`.trim();
  const code = parsed.code === undefined ? "" : ` code ${String(parsed.code)}`;
  return `${String(res.status)}${code} ${parsed.message || body}`.trim();
}
