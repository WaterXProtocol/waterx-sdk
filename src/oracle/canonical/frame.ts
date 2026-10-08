/**
 * `canonical/frame.ts` — the canonical price plane's WIRE CONTRACT: the
 * `CanonicalQuote` object and the ONE parser both transports share.
 *
 * WHY THIS PLANE EXISTS. Everything else the SDK reads off-chain is a LEG of
 * the on-chain price: the signed BBO leaves (`/v1/sign/bbo/consensus`) are the
 * `waterx_rule` leg, the Lazer parsed read is the `pyth_lazer_rule` leg.
 * Neither is "the price" — `oracle::aggregate` combines them by the per-ticker
 * weight table, and on production every market but DOGE weights the waterx leg
 * at ZERO, so a consumer showing the BBO leaf was showing a number the chain
 * never settles against. The quote-center's canonical plane mirrors those
 * weight tables and re-runs the aggregator off-chain, so its output is the only
 * off-chain price with the settlement's definition. Rule for consumers: what
 * goes on chain as a leg reads the raw source; everything else reads canonical.
 *
 * ONE PARSER. The contract makes a stream frame byte-compatible with a REST item
 * (`GET /v1/canonical/{symbol}` ≡ one frame of `GET /v1/canonical/stream`;
 * `GET /v1/canonical?symbols=` wraps the same objects in `{ items }`), so the
 * REST reader (`read.ts`) and the stream client (`stream.ts`) decode through
 * {@link parseCanonicalQuote} and cannot disagree about a field.
 *
 * `*_scaled` ARE STRINGS. `price_scaled` / `confidence_scaled` (and a leg's
 * `price_scaled`) are u64s on the wire — JSON integer literals. A plain
 * `JSON.parse` yields IEEE-754 doubles that lose precision above 2^53, so the
 * reviver recovers each literal's exact source text (ES2023 `context.source`,
 * Node ≥ 21 — the same mechanism the rule's signed-payload parser relies on)
 * and keeps it as the decimal string the fixed contract type promises. On a
 * runtime without source access the value is stringified from the double,
 * which is exact up to 2^53 — ample for a 1e9-scaled price, lossy only for a
 * literal nobody's display path reads exactly.
 *
 * ONLY THE PRICE AND ITS TIME CAN REJECT A QUOTE. An `ok` quote whose `price`
 * is not a positive finite number, or whose `timestamp_ms` is missing, not a
 * positive finite number, or implausibly far in the future, is a drop — those
 * are the two fields a consumer feeds into money maths and ordering. Every
 * other field is a diagnostic (`legs`, `config_epoch`, `weight_threshold`,
 * `outlier_tolerance`, the scaled mirrors) and is DEFAULTED when absent or of
 * the wrong type rather than used to refuse a price. A non-ok quote is never
 * rejected for its numbers at all: it carries no price, only a `reason`, and
 * the contract says every evaluation is delivered so consumers mark the ticker
 * stale instead of freezing on the last price.
 *
 * `CANONICAL_MAX_FUTURE_DRIFT_MS` is a WEDGING guard, not a freshness policy.
 * Both the stream guard here and every consumer cache treat "newer timestamp"
 * as "wins", so a single far-future stamp (a µs/ns units slip, a skewed source
 * clock) would pin the price for the process lifetime and report it perpetually
 * fresh. Sized well above real NTP skew and well below a units slip, like the
 * backend's `MAX_FUTURE_DRIFT_MS`. Freshness (how OLD a price may be) stays
 * with the consumer.
 */

/** `GET /v1/canonical?symbols=A,B` → `{ items: CanonicalQuote[] }`; `GET /v1/canonical/{symbol}` → one `CanonicalQuote`. */
export const CANONICAL_BATCH_ROUTE = "v1/canonical";
/** WebSocket `GET /v1/canonical/stream?symbols=A,B` — one `CanonicalQuote` JSON object per frame. */
export const CANONICAL_STREAM_ROUTE = "v1/canonical/stream";
/** See the module header — a wedging guard against units slips and skewed clocks. */
export const CANONICAL_MAX_FUTURE_DRIFT_MS = 60_000;

export type CanonicalStatus = "ok" | "unavailable";

/** One rule's contribution to an evaluation, as the evaluator saw it. Diagnostic. */
export interface CanonicalLeg {
  rule: "waterx" | "pyth_lazer" | "constant" | "supra";
  weight: number;
  /** u64 as an exact decimal string; `"0"` when the leg carried none. */
  price_scaled: string;
  ts_ms: number;
  status: string;
}

/**
 * One canonical evaluation — the body of `GET /v1/canonical/{symbol}`, one
 * item of the batch route, one frame of the stream. Field names are the wire's
 * (snake_case), per the repo's BCS/wire convention. Signature fixed by the
 * cross-repo plan; consumers are coded against it.
 */
export interface CanonicalQuote {
  symbol: string;
  status: CanonicalStatus;
  /** `""` on an `ok` quote; the evaluator's reason otherwise (never `""` — `"unspecified"` when the wire omits it). */
  reason: string;
  /** Display-grade USD float. Meaningless unless `status === "ok"`. */
  price: number;
  /** u64 (1e9-scaled) as an exact decimal string. */
  price_scaled: string;
  confidence: number;
  confidence_scaled: string;
  /** The evaluation's PRICE time (a Lazer-driven tick carries the feed's own feedUpdateTimestamp). `0` when a non-ok quote carries none. */
  timestamp_ms: number;
  config_epoch: number;
  weight_threshold: number;
  outlier_tolerance: number;
  legs: CanonicalLeg[];
}

/**
 * Why a frame / item was not a usable quote. Closed on purpose — consumers
 * label metrics with it, and the REST reader prefixes it (`invalid_<reason>`)
 * into the `reason` of the entry it synthesises in the item's place.
 */
export const CANONICAL_DROP_REASONS = [
  /** Not JSON, not an object, no usable `symbol`, or a `status` outside the contract. */
  "malformed",
  /** `ok` quote whose `price` is missing, non-finite, zero or negative. */
  "non_positive_price",
  /** `ok` quote whose `timestamp_ms` is missing, non-finite, non-positive, or beyond {@link CANONICAL_MAX_FUTURE_DRIFT_MS}. */
  "bad_timestamp",
  /** Stream only: a symbol this client did not subscribe. */
  "unsolicited",
  /** Stream only: older than the last delivered `ok` quote for that ticker. */
  "out_of_order",
  /** Stream only: the same `timestamp_ms` as the last delivered `ok` quote for that ticker. */
  "duplicate",
] as const;
export type CanonicalDropReason = (typeof CANONICAL_DROP_REASONS)[number];

/** The fields whose JSON integer literal must survive as an exact string. */
const SCALED_KEYS = new Set(["price_scaled", "confidence_scaled"]);
/** A JSON number token that is lexically an integer: no `.`, no `e`/`E`. */
const INTEGER_TOKEN = /^-?\d+$/;

/**
 * `JSON.parse` with every `*_scaled` value decoded as a string — exact when the
 * runtime hands the reviver its source token, else from the double (see the
 * module header). Exported for the REST reader, which parses the batch body
 * ONCE with this and hands the items to {@link parseCanonicalQuote}.
 */
export function parseCanonicalText(text: string): unknown {
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }): unknown => {
    if (!SCALED_KEYS.has(key)) return value;
    if (typeof value === "string") return value;
    if (typeof value !== "number") return value;
    const token = context?.source;
    if (token !== undefined && INTEGER_TOKEN.test(token)) return token;
    return Number.isFinite(value) ? String(value) : value;
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr0(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

function scaledOr0(value: unknown): string {
  if (typeof value === "string" && value !== "") return value;
  // An already-parsed object (not run through `parseCanonicalText`) still
  // carries the literal as a number — stringify it; exact up to 2^53.
  return isFiniteNumber(value) ? String(value) : "0";
}

function parseLeg(raw: unknown): CanonicalLeg | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const leg = raw as Record<string, unknown>;
  return {
    // The wire string is kept verbatim; the union type names the rules the
    // chain knows today, and a new rule reaching here is a diagnostic, not a
    // reason to drop a price.
    rule: (typeof leg.rule === "string" ? leg.rule : "waterx") as CanonicalLeg["rule"],
    weight: numberOr0(leg.weight),
    price_scaled: scaledOr0(leg.price_scaled),
    ts_ms: numberOr0(leg.ts_ms),
    status: typeof leg.status === "string" ? leg.status : "",
  };
}

/**
 * Decode one canonical object — a REST item, a per-symbol body, or a stream
 * frame — into a {@link CanonicalQuote}, or name why it cannot be one. A
 * `string` is parsed with {@link parseCanonicalText} first; anything else is
 * taken as an already-parsed value. `nowMs` is the clock the timestamp's
 * plausibility is judged against.
 *
 * The rules are the module header's: `malformed` for a broken envelope or a
 * status outside the contract; an `ok` quote is rejected only on `price`
 * (`non_positive_price`) and `timestamp_ms` (`bad_timestamp`); an `unavailable`
 * quote is never rejected for its numbers — its `timestamp_ms` is kept when
 * plausible (the stream guard orders on it) and zeroed otherwise; every
 * diagnostic field is defaulted rather than validated.
 */
export function parseCanonicalQuote(
  input: unknown,
  nowMs: number = Date.now(),
): CanonicalQuote | CanonicalDropReason {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = parseCanonicalText(input);
    } catch {
      return "malformed";
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "malformed";
  const frame = raw as Record<string, unknown>;

  const symbol = frame.symbol;
  if (typeof symbol !== "string" || symbol === "") return "malformed";
  const status = frame.status;
  if (status !== "ok" && status !== "unavailable") return "malformed";

  const plausible = (ts: unknown): ts is number =>
    isFiniteNumber(ts) && ts > 0 && ts <= nowMs + CANONICAL_MAX_FUTURE_DRIFT_MS;

  let price: number;
  let timestamp_ms: number;
  let reason: string;
  if (status === "ok") {
    if (!isFiniteNumber(frame.price) || frame.price <= 0) return "non_positive_price";
    if (!plausible(frame.timestamp_ms)) return "bad_timestamp";
    price = frame.price;
    timestamp_ms = frame.timestamp_ms;
    reason = "";
  } else {
    price = numberOr0(frame.price);
    timestamp_ms = plausible(frame.timestamp_ms) ? frame.timestamp_ms : 0;
    reason = typeof frame.reason === "string" && frame.reason !== "" ? frame.reason : "unspecified";
  }

  const legs: CanonicalLeg[] = [];
  if (Array.isArray(frame.legs)) {
    for (const raw of frame.legs) {
      const leg = parseLeg(raw);
      if (leg) legs.push(leg);
    }
  }

  return {
    symbol,
    status,
    reason,
    price,
    price_scaled: scaledOr0(frame.price_scaled),
    confidence: numberOr0(frame.confidence),
    confidence_scaled: scaledOr0(frame.confidence_scaled),
    timestamp_ms,
    config_epoch: numberOr0(frame.config_epoch),
    weight_threshold: numberOr0(frame.weight_threshold),
    outlier_tolerance: numberOr0(frame.outlier_tolerance),
    legs,
  };
}

/**
 * The quote the REST reader puts in place of an answer the server did not give
 * for a requested symbol (an omitted item, a per-symbol 404, an item that
 * failed {@link parseCanonicalQuote}). Only `symbol` / `status` / `reason` are
 * meaningful; the numbers are zero and `legs` empty, so a consumer that reads
 * `price` off a non-ok quote by mistake sees 0, never a stale real value.
 */
export function syntheticUnavailable(symbol: string, reason: string): CanonicalQuote {
  return {
    symbol,
    status: "unavailable",
    reason,
    price: 0,
    price_scaled: "0",
    confidence: 0,
    confidence_scaled: "0",
    timestamp_ms: 0,
    config_epoch: 0,
    weight_threshold: 0,
    outlier_tolerance: 0,
    legs: [],
  };
}
