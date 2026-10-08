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
 * `price_scaled`) are u64s on the wire — JSON integer literals that a double
 * cannot hold exactly above 2^53. {@link parseCanonicalText} keeps them as the
 * decimal strings the fixed contract type promises, through the SDK's shared
 * source-token mechanism (`utils/json-exact.ts`) when, and only when, a literal
 * needs it.
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
 * stale instead of freezing on the last price. Its price fields are ZEROED on
 * the way through, so every unavailable quote — parsed or synthesised — reads
 * the same and none can leak a stale real value.
 *
 * `CANONICAL_MAX_FUTURE_DRIFT_MS` is a WEDGING guard, not a freshness policy.
 * Both the stream guard here and every consumer cache treat "newer timestamp"
 * as "wins", so a single far-future stamp (a µs/ns units slip, a skewed source
 * clock) would pin the price for the process lifetime and report it perpetually
 * fresh. Sized well above real NTP skew and well below a units slip, like the
 * backend's `MAX_FUTURE_DRIFT_MS`. Freshness (how OLD a price may be) stays
 * with the consumer.
 */

import { INTEGER_TOKEN, parseJsonWithNumberSource } from "../../utils/json-exact.ts";

/** `GET /v1/canonical?symbols=A,B` → `{ items: CanonicalQuote[] }`; `GET /v1/canonical/{symbol}` → one `CanonicalQuote`. */
export const CANONICAL_BATCH_ROUTE = "v1/canonical";
/** WebSocket `GET /v1/canonical/stream?symbols=A,B` — one `CanonicalQuote` JSON object per frame. */
export const CANONICAL_STREAM_ROUTE = "v1/canonical/stream";
/** See the module header — a wedging guard against units slips and skewed clocks. */
export const CANONICAL_MAX_FUTURE_DRIFT_MS = 60_000;
/**
 * The quote-center answers more symbols than this in ONE request — the batch
 * route or a stream subscription — with a 400 (code 10003, `TooManySymbols`;
 * `MAX_SIGNED_LEAVES` in its `api.rs`). `readCanonicalPrices` chunks and
 * `openCanonicalStream` shards at this size, so a caller never sees the cap.
 */
export const CANONICAL_MAX_SYMBOLS_PER_REQUEST = 32;

/** De-duplicate (first occurrence wins, order kept) and split into requests of at most {@link CANONICAL_MAX_SYMBOLS_PER_REQUEST}. */
export function chunkCanonicalTickers(tickers: readonly string[]): string[][] {
  const distinct = [...new Set(tickers)];
  const out: string[][] = [];
  for (let i = 0; i < distinct.length; i += CANONICAL_MAX_SYMBOLS_PER_REQUEST) {
    out.push(distinct.slice(i, i + CANONICAL_MAX_SYMBOLS_PER_REQUEST));
  }
  return out;
}

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
  /**
   * The evaluation's PRICE time: the server's clock for a BBO- or
   * liveness-driven tick, the feed's own `feedUpdateTimestamp` for a
   * Lazer-driven one — so it is NOT monotonic per symbol (a Lazer tick can
   * carry an older time than the liveness verdict before it). `0` when a
   * non-ok quote carries none.
   */
  timestamp_ms: number;
  /**
   * ADDITIVE to the fixed contract (the quote-center added the field after the
   * plan was cut). The EVALUATION clock — one clock per quote-center leader,
   * whatever drove the tick — and therefore the per-symbol ORDER: the server's
   * own stream bridge, and `openCanonicalStream`'s guard, order on it, falling
   * back to `timestamp_ms` when it is `0`. Parsed leniently: missing, not a
   * positive finite number, or implausibly far in the future reads `0` (a
   * pre-field server, a synthesised quote), never a drop. Not a price time —
   * freshness still reads `timestamp_ms`.
   */
  evaluated_at_ms?: number;
  config_epoch: number;
  weight_threshold: number;
  outlier_tolerance: number;
  legs: CanonicalLeg[];
}

/**
 * Why a frame / item was not a usable quote. Closed on purpose — consumers
 * label metrics with it, and the REST reader prefixes it (`invalid_<reason>`)
 * into the `reason` of the entry it synthesises in the item's place. The reader
 * adds exactly two values of its own that no frame can produce:
 * `not_in_response` (a requested symbol the batch omitted) and
 * `invalid_symbol_mismatch` (a per-symbol body answering for another symbol).
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
  /** Stream only: an ordering key (`evaluated_at_ms`, else `timestamp_ms`) below the last delivered frame's for that ticker. */
  "out_of_order",
  /** Stream only: an `ok` quote with the same ordering key as the last delivered `ok` quote for that ticker. */
  "duplicate",
] as const;
export type CanonicalDropReason = (typeof CANONICAL_DROP_REASONS)[number];

/** The fields whose JSON integer literal must survive as an exact string. */
const SCALED_KEYS = new Set(["price_scaled", "confidence_scaled"]);

/**
 * Parse a canonical body (one quote, or the batch `{ items }`) so every
 * `*_scaled` literal can be recovered EXACTLY. Exported for the REST reader,
 * which parses the batch body ONCE and hands the items to
 * {@link parseCanonicalQuote}.
 *
 * Fast path first: a plain `JSON.parse`, and `scaledOr0` stringifies the
 * doubles — exact up to 2^53, which at 1e9 scaling is a $9M price, so every
 * live quote takes it. Only when some `*_scaled` double is NOT a safe integer
 * is the text re-parsed with the source-token reviver, which costs ~7× (it
 * materialises a context per primitive). The stream's message handler calls
 * this per frame, so the common case must not pay for the rare one.
 */
export function parseCanonicalText(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  if (!hasUnsafeScaled(parsed)) return parsed;
  return parseJsonWithNumberSource(text, (value, source, key) => {
    if (!SCALED_KEYS.has(key)) return value;
    if (source !== undefined) return INTEGER_TOKEN.test(source) ? source : value;
    // No source access and a literal a double cannot hold: refuse, as the
    // signed-payload parser does, rather than hand back fabricated digits
    // under a type that promises an exact string. `parseCanonicalQuote` turns
    // this into a `malformed` drop; the batch reader lets it propagate.
    if (!Number.isSafeInteger(value)) {
      throw new CanonicalPrecisionError();
    }
    return value;
  });
}

/** A `*_scaled` literal above 2^53 on a runtime without JSON reviver source access. */
export class CanonicalPrecisionError extends Error {
  constructor() {
    super(
      "canonical quote carries a *_scaled integer above 2^53 and this runtime lacks JSON " +
        "source access — cannot preserve u64 precision",
    );
    this.name = "CanonicalPrecisionError";
  }
}

/** Does any `*_scaled` value, at any depth, exceed what a double holds exactly? Allocation-free. */
function hasUnsafeScaled(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  if (Array.isArray(value)) {
    for (const item of value) if (hasUnsafeScaled(item)) return true;
    return false;
  }
  const record = value as Record<string, unknown>;
  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue;
    const v = record[key];
    if (SCALED_KEYS.has(key)) {
      if (typeof v === "number" && !Number.isSafeInteger(v)) return true;
    } else if (hasUnsafeScaled(v)) {
      return true;
    }
  }
  return false;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr0(value: unknown): number {
  return isFiniteNumber(value) ? value : 0;
}

/** The ONE place a scaled double becomes its string — exact up to 2^53 (see `parseCanonicalText`). */
function scaledOr0(value: unknown): string {
  if (typeof value === "string" && value !== "") return value;
  return isFiniteNumber(value) ? String(value) : "0";
}

/** A positive, finite instant not implausibly ahead of `nowMs` (see the module header). */
function isPlausibleTimestamp(ts: unknown, nowMs: number): ts is number {
  return isFiniteNumber(ts) && ts > 0 && ts <= nowMs + CANONICAL_MAX_FUTURE_DRIFT_MS;
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
 * plausible (the stream guard's fallback ordering key) and zeroed otherwise; every
 * diagnostic field is defaulted rather than validated, and `evaluated_at_ms`
 * (the stream's ordering key) is zeroed rather than rejected when unusable.
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
      // Not JSON — or a `CanonicalPrecisionError`: a quote whose exact digits
      // this runtime cannot recover is dropped, never delivered approximated.
      return "malformed";
    }
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "malformed";
  const frame = raw as Record<string, unknown>;

  const symbol = frame.symbol;
  if (typeof symbol !== "string" || symbol === "") return "malformed";
  const status = frame.status;
  if (status !== "ok" && status !== "unavailable") return "malformed";

  let price: number;
  let price_scaled: string;
  let confidence: number;
  let confidence_scaled: string;
  let timestamp_ms: number;
  let reason: string;
  if (status === "ok") {
    if (!isFiniteNumber(frame.price) || frame.price <= 0) return "non_positive_price";
    if (!isPlausibleTimestamp(frame.timestamp_ms, nowMs)) return "bad_timestamp";
    price = frame.price;
    price_scaled = scaledOr0(frame.price_scaled);
    confidence = numberOr0(frame.confidence);
    confidence_scaled = scaledOr0(frame.confidence_scaled);
    timestamp_ms = frame.timestamp_ms;
    reason = "";
  } else {
    // A non-ok evaluation carries no price — whatever the wire put in these
    // fields (a last value, a zero) is ZEROED, exactly as the reader's
    // synthesised quotes are, so a consumer that reads `price` off a non-ok
    // quote by mistake sees 0 and never a stale real value. Every unavailable
    // quote looks the same, whichever path produced it.
    price = 0;
    price_scaled = "0";
    confidence = 0;
    confidence_scaled = "0";
    timestamp_ms = isPlausibleTimestamp(frame.timestamp_ms, nowMs) ? frame.timestamp_ms : 0;
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
    price_scaled,
    confidence,
    confidence_scaled,
    timestamp_ms,
    // Lenient on both arms: an unusable evaluation clock only costs the
    // stream guard its preferred key (it falls back to `timestamp_ms`), and
    // the same plausibility bound keeps a far-future stamp from wedging it.
    evaluated_at_ms: isPlausibleTimestamp(frame.evaluated_at_ms, nowMs) ? frame.evaluated_at_ms : 0,
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
    evaluated_at_ms: 0,
    config_epoch: 0,
    weight_threshold: 0,
    outlier_tolerance: 0,
    legs: [],
  };
}
