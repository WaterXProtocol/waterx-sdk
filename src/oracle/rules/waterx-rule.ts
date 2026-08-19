/**
 * `WaterxRule` — `PriceUpdateRule` for the first-party WaterX quote-center
 * (Nautilus-TEE, ed25519), plus the collector-feed legs `aggregateTicker`
 * appends per waterx-routed ticker. Endpoint comes from `host.waterx` (the
 * `waterxEndpoint`/`waterxFetch` create options), else this source's own
 * `WATERX_INFRA`. Unlike Pyth Lazer, whose verify is a single shared PTB step,
 * the Move API bundles verify AND feed into ONE call per collector, so
 * `buildUpdateCalls` emits nothing and the signed data is handed straight to
 * the per-ticker feed leg.
 *
 * TWO wire shapes carry the same prices, and this rule prefers the first:
 *
 * 1. **Merkle leaves** (default) — `GET /v1/quotes/leaves?symbols=…` returns one
 *    `SignedLeaf` per symbol: the price fields, a Merkle `proof`, and the
 *    enclave's signature over the snapshot ROOT (`MERKLE_ROOT_INTENT`). Fed via
 *    {@link feedWaterxRuleWithProof} → `waterx_rule::collect_single_with_proof`,
 *    which re-derives the root from the leaf + proof. One symbol costs ONE
 *    `new_batch_item` plus ~log2(n) 32-byte proof hashes.
 * 2. **Batch envelope** (fallback) — `GET /v1/quotes/update?symbols=…` returns
 *    ONE signature over the whole item vector (`BATCH_PRICE_INTENT`). It is
 *    indivisible: {@link feedWaterxRule} must rebuild EVERY item in-PTB for
 *    `waterx_rule::collect_batch_latest` to re-verify, even to use one symbol's
 *    price. With the 29-feed mainnet registry that is 58 extra moveCalls and
 *    ~320 extra pure inputs on every trade, which is why it is no longer the
 *    default. Used only when the quote-center has no leaf route yet (404),
 *    and by callers that still push whole batches.
 *
 * Both collect entries are the dual-rule path: they feed `collector.symbol()`
 * WITHOUT aggregating, so a waterx-routed ticker composes onto the same
 * collector as Pyth/Supra (compose-then-aggregate). Their abort-vs-abstain
 * disposition is identical: a config/integrity mismatch, a bad signature or a
 * signed timestamp AHEAD of the on-chain `Clock` ABORTS; a freshness miss
 * ABSTAINS so the other weighted rules cover a lagging TEE, and so does a
 * REPLAYED signed timestamp (the per-symbol high-water mark of audit F-014 —
 * already-recorded means the chain holds a price at least this fresh, so two
 * PTBs carrying the same snapshot for the same symbol no longer kill each
 * other; only the single-rule `feed_*` entries abort on a replay).
 */

import { fromHex } from "@mysten/bcs";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { Network } from "../../constants.ts";
import {
  collectBatchLatest,
  collectSingleWithProof,
  newBatchItem,
  newBatchPayload,
  pushBatchItem,
} from "../../generated/waterx_rule/waterx_rule.ts";
import { ownEntry } from "../../utils/record.ts";
import type { WaterxRulePackage } from "../config.ts";
import type { OracleHost } from "../host.ts";
import {
  assertRuleUpdateData,
  type PriceUpdateRule,
  type RuleUpdateData,
} from "../price-update-rule.ts";
import type { OraclePriceEntry } from "../read-prices.ts";
import {
  FetchPolicyError,
  fetchWithPolicy,
  joinEndpointPath,
  type FetchPolicy,
} from "../update-fetch.ts";

/** Intent the quote-center signs a whole BATCH payload under. Exported to NAME
 *  the signing scheme only — consumers no longer mirror the intent gate
 *  themselves: every quote-center pull (tx-build fetch, read executor, BE
 *  prefetch) goes through {@link fetchWaterxSignedUpdate} /
 *  {@link fetchWaterxSignedLeaves}, which enforce it, so a mispointed endpoint
 *  is rejected identically on every path. */
export const BATCH_PRICE_INTENT = 1;

/**
 * Intent the quote-center signs a snapshot's Merkle ROOT under
 * (`waterx_rule::MERKLE_ROOT_INTENT`). Distinct from
 * {@link BATCH_PRICE_INTENT} on purpose: the intent byte is the first field of
 * the signed `IntentMessage`, so a batch signature can never be replayed as a
 * root signature or vice versa. Leaves carry no `intent` field of their own —
 * they are only ever submitted through `collect_single_with_proof`, which pins
 * the intent on-chain — so this exists to name the scheme, not to gate a parse.
 */
export const MERKLE_ROOT_INTENT = 2;

/**
 * WaterX quote-center external infra — owned by THIS source, by network.
 * Mirrors `LAZER_INFRA` (rules/pyth-lazer-rule.ts): per-network constants for
 * infrastructure the source's operator runs, co-located with the only rule
 * that reads them — no other oracle source ever touches a quote-center
 * endpoint. Public read (no auth), so there is no api_key. `endpoint` has no
 * trailing slash — the rule appends the path.
 *
 * These are the DEFAULTS behind the caller's `client.waterx` access slice
 * (`waterxEndpoint` / `waterxFetch` create options) — the browser-CORS proxy
 * hook, since this is the one source fetched from the page.
 */
export const WATERX_INFRA: Record<Network, { endpoint: string }> = {
  MAINNET: { endpoint: "https://quote-center.waterx.app" },
  TESTNET: { endpoint: "https://quote-center-staging.waterx.app" },
};

/**
 * The waterx source's quote-center base for `network` — the ONE accessor
 * consumers (BE/FE read planes) use when, and only when, their own
 * `ORACLE_SOURCE` resolves to `'waterx_rule'`. Under any other source the
 * read endpoint is that source's own configuration — never this one.
 */
export function waterxQuoteCenterEndpoint(network: Network): string {
  return WATERX_INFRA[network].endpoint;
}

/**
 * Off-chain mirror of the on-chain `waterx_rule` `FeedConfig.max_age` DEFAULT
 * (90s): a price older than this ABSTAINS on-chain, so a read plane serving it
 * as live would show a price no trade could execute against. The single
 * source of truth for consumers' post-cache freshness filters — import this,
 * never re-declare the number. (A deployment that overrides `max_age`
 * per-feed on-chain diverges from this mirror; none does today.)
 */
export const WATERX_MAX_PRICE_AGE_MS = 90_000;

/**
 * `true` iff a quote-center read entry is still within
 * {@link WATERX_MAX_PRICE_AGE_MS} of `nowMs` — the freshness predicate
 * consumers apply to `readQuoteCenterPrices` output (post-cache), matching
 * the on-chain abstain boundary instead of each inventing a policy.
 */
export function isFreshWaterxEntry(entry: OraclePriceEntry, nowMs: number): boolean {
  return nowMs - entry.publishTimeMs <= WATERX_MAX_PRICE_AGE_MS;
}

/**
 * One item inside a signed batch payload, mirroring the quote-center
 * `/v1/quotes/update` JSON 1:1 (snake_case). The u64 integer fields are the
 * EXACT values the enclave signed over BCS — `collect_batch_latest` rebuilds
 * the payload on-chain and re-verifies, so they must round-trip byte-for-byte.
 * They are `bigint` (not `number`): {@link parseSignedEnvelope} decodes them
 * from the raw JSON integer literals so a value above `Number.MAX_SAFE_INTEGER`
 * (2^53) can never lose precision and silently abort the on-chain signature
 * check. `num_sources` is a `u8` (≤ 255) and stays a `number`.
 */
export interface WaterxBatchItem {
  symbol: string;
  ticker: string;
  sources: bigint[];
  method: string;
  price_timestamp_ms: bigint;
  price_n: bigint;
  price_scale: bigint;
  confidence_n: bigint;
  confidence_scale: bigint;
  max_source_deviation_bps: bigint;
  num_sources: number;
}

/** The enclave-signed batch envelope from `GET /v1/quotes/update`. */
export interface WaterxSignedEnvelope {
  intent: number;
  /** Enclave signing timestamp (ms) — the on-chain `timestamp_ms` argument. */
  timestamp_ms: bigint;
  payload: { items: WaterxBatchItem[] };
  /** ed25519 signature over `BCS(IntentMessage<BatchPricePayload>)`, hex (± `0x`). */
  signature: string;
}

/**
 * One enclave-signed Merkle leaf from `GET /v1/quotes/leaves` — identical shape
 * to the `/v1/quote/stream/signed` SSE/WS events (quote-center serves both from
 * one conversion), so a leaf from either transport submits the same way.
 *
 * It is the batch item's fields PLUS its membership proof: on-chain,
 * `collect_single_with_proof` recomputes `keccak256(0x00 || BCS(item))`, folds
 * it through `proof` (sorted pairs, no direction flags), and verifies the
 * enclave's signature over THAT root — so every item field must round-trip
 * byte-for-byte, exactly as for the batch path.
 */
export interface WaterxSignedLeaf extends WaterxBatchItem {
  /**
   * Enclave signing timestamp of the SNAPSHOT ROOT (ms) — the on-chain
   * `timestamp_ms` argument. Shared by every leaf of one snapshot, and distinct
   * from `price_timestamp_ms` (when the price itself was observed).
   */
  signed_timestamp_ms: bigint;
  /** keccak256 Merkle root (hex). Diagnostic only — the chain re-derives it. */
  root: string;
  /** Sibling hashes (hex, 32 bytes each) folding this leaf to `root`. Empty for a one-leaf snapshot. */
  proof: string[];
  /** ed25519 signature over `BCS(IntentMessage<MerkleRoot>)`, hex (± `0x`). */
  signature: string;
}

/** Leaf variant of `waterx_rule`'s `RuleUpdateData.payload` — the default path. */
export interface WaterxLeafPayload {
  readonly leaves: readonly WaterxSignedLeaf[];
}

/** Batch-envelope variant of `waterx_rule`'s `RuleUpdateData.payload` — the fallback path. */
export interface WaterxEnvelopePayload {
  readonly envelope: WaterxSignedEnvelope;
}

/**
 * `waterx_rule`'s narrowed `RuleUpdateData.payload` shape: a per-symbol leaf set
 * OR one indivisible batch envelope. The variant a payload carries decides which
 * on-chain entry the feed leg emits, so consumers must route on it via
 * {@link waterxLeavesOf} / {@link waterxEnvelopeOf} rather than assuming either.
 */
export type WaterxUpdatePayload = WaterxLeafPayload | WaterxEnvelopePayload;

function isWaterxEnvelopePayloadShape(payload: unknown): payload is WaterxEnvelopePayload {
  const env = (payload as { envelope?: unknown })?.envelope as WaterxSignedEnvelope | undefined;
  return (
    typeof env === "object" &&
    env !== null &&
    typeof env.signature === "string" &&
    typeof env.timestamp_ms === "bigint" &&
    Array.isArray(env.payload?.items)
  );
}

function isWaterxLeafPayloadShape(payload: unknown): payload is WaterxLeafPayload {
  const leaves = (payload as { leaves?: unknown })?.leaves;
  return Array.isArray(leaves) && leaves.every(isSignedLeafShape);
}

/** Every u64 field of a leaf — each one is signed, so each must be present and exact. */
const LEAF_U64_FIELDS = [
  "price_timestamp_ms",
  "price_n",
  "price_scale",
  "confidence_n",
  "confidence_scale",
  "max_source_deviation_bps",
  "signed_timestamp_ms",
] as const;

/**
 * FULL structural check on a leaf, not just the fields the feed leg happens to
 * touch first.
 *
 * Every field here is either part of the BCS bytes the enclave signed (so a
 * missing one means the rebuilt item cannot match) or the signature/proof
 * material itself. A partial guard let a 200 that omitted, say, `ticker` pass as
 * a valid leaf and fail LATER, mid-PTB-build, as `Parameter ticker is required`
 * — after `assertCoverage` had already declared the response good, and while the
 * caller's `tx` was already being mutated. `parseSignedLeaves` promises to reject
 * a malformed leaf before any PTB is touched; this is what makes that true.
 */
/** Hex characters only. Length is checked separately — see {@link isHexOfBytes}. */
const HEX_ONLY = /^[0-9a-fA-F]*$/;

/**
 * `true` iff `hex` (± `0x`) is exactly `bytes` bytes of hex.
 *
 * A static pattern plus an explicit length compare, deliberately not a computed
 * `new RegExp(`…{${bytes * 2}}`)`: that recompiles on every call and semgrep
 * blocks it as `detect-non-literal-regexp`.
 */
function isHexOfBytes(hex: unknown, bytes: number): boolean {
  if (typeof hex !== "string") return false;
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  return body.length === bytes * 2 && HEX_ONLY.test(body);
}

function isSignedLeafShape(leaf: unknown): leaf is WaterxSignedLeaf {
  const l = leaf as Record<string, unknown> | null;
  if (typeof l !== "object" || l === null) return false;
  if (typeof l.symbol !== "string" || l.symbol === "") return false;
  if (typeof l.ticker !== "string" || l.ticker === "") return false;
  if (typeof l.method !== "string" || l.method === "") return false;
  // `num_sources` is a u8, and this guard runs at TWO stages: on the freshly
  // revived object (where every JSON integer, including this one, is a bigint)
  // and again on a normalized payload from `narrowUpdateData` / a consumer cache
  // (where `parseSignedLeaves` has coerced it to a number). Both are valid here;
  // only the domain matters.
  const n = l.num_sources;
  if (typeof n === "bigint") {
    if (n < 0n || n > 255n) return false;
  } else if (typeof n === "number") {
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
  } else {
    return false;
  }
  // `sources` is a vector<u64>: exact bigints, like every other signed integer.
  if (!Array.isArray(l.sources) || l.sources.length === 0) return false;
  if (l.sources.some((s) => typeof s !== "bigint" || s < 0n)) return false;
  for (const field of LEAF_U64_FIELDS) {
    const v = l[field];
    if (typeof v !== "bigint" || v < 0n) return false;
  }
  // ed25519 is always 64 bytes and the root is always a 32-byte keccak256; a
  // wrong-length signature is an on-chain abort, so it is rejected here.
  if (!isHexOfBytes(l.signature, 64)) return false;
  if (!isHexOfBytes(l.root, 32)) return false;
  if (!Array.isArray(l.proof) || l.proof.some((p) => typeof p !== "string")) return false;
  return true;
}

/**
 * Shape check ONLY — the `kind` discriminant is checked separately by the
 * caller before this runs (mirrors the other rules' guard split), so a
 * same-shaped payload from a different rule can never silently pass. Accepts
 * either variant; the accessors below pick one out.
 */
function isWaterxUpdatePayloadShape(payload: unknown): payload is WaterxUpdatePayload {
  return isWaterxLeafPayloadShape(payload) || isWaterxEnvelopePayloadShape(payload);
}

/** A JSON number token that is lexically an integer: no `.`, no `e`/`E`. */
const INTEGER_TOKEN = /^-?\d+$/;

/**
 * `JSON.parse` with every integer decoded as an exact `bigint`.
 *
 * The signature is over `BCS(IntentMessage<…>)`, so every u64 the SDK rebuilds
 * in-PTB must equal the enclave's byte-for-byte or the on-chain verify fails and
 * ABORTS the whole trade PTB (a bad signature is not an abstain). A plain
 * `JSON.parse` yields IEEE-754 doubles that lose precision above 2^53, so
 * instead we recover each integer's exact source literal via the ES2023 reviver
 * `context.source` (Node 21+ / modern browsers) and `BigInt()` it. On an older
 * runtime that passes no `context`, a value within 2^53 is still exact
 * (`BigInt(number)`); a value ABOVE it throws loudly here rather than silently
 * corrupting the payload into an on-chain abort.
 *
 * Integrality is decided from the SOURCE TOKEN, never from the parsed value: a
 * display float can be lexically `0.0` while `JSON.parse` hands back the number
 * `0`, which `Number.isInteger` accepts — and `BigInt("0.0")` throws
 * `SyntaxError`. The leaf endpoint really does emit that (Rust `f64` serializes
 * a whole number as `0.0`), so keying off the value crashed every fetch that
 * included, say, a `confidence: 0.0` leaf. Exponent tokens (`1e3`) throw the
 * same way. Only `-?\d+` becomes a `bigint`; every other numeric token stays a
 * number, which is right for the display-only `price` / `confidence` fields —
 * they are not part of any signed byte string.
 */
function parseWithExactIntegers(text: string, what: string): unknown {
  return JSON.parse(
    text,
    (_key: string, value: unknown, context?: { source?: string }): unknown => {
      if (typeof value !== "number") return value;
      const token = context?.source;
      if (token !== undefined) {
        return INTEGER_TOKEN.test(token) ? BigInt(token) : value;
      }
      // No JSON source access on this runtime: fall back to the parsed value.
      // A display float that happens to be whole (`0.0` → `0`) becomes a bigint
      // here, which is harmless — no signed field is read off those two.
      if (!Number.isInteger(value)) return value;
      if (!Number.isSafeInteger(value)) {
        throw new Error(
          `waterx ${what} carries an integer above 2^53 and this runtime lacks JSON ` +
            "source access — cannot preserve u64 precision for the signed payload",
        );
      }
      return BigInt(value);
    },
  );
}

/**
 * Parse a quote-center `/v1/quotes/update` response body into a
 * {@link WaterxSignedEnvelope} with the u64 fields decoded as `bigint`, exact
 * (see {@link parseWithExactIntegers}). `num_sources` (u8) and `intent` are
 * coerced back to `number` — both are tiny.
 */
export function parseSignedEnvelope(text: string): WaterxSignedEnvelope {
  const raw = parseWithExactIntegers(text, "envelope") as {
    intent?: bigint;
    timestamp_ms?: bigint;
    signature?: string;
    payload?: { items?: WaterxBatchItem[] };
  };

  if (typeof raw.signature !== "string" || !Array.isArray(raw.payload?.items)) {
    throw new Error("WaterX quote-center returned a malformed signed envelope");
  }
  return {
    intent: Number(raw.intent),
    timestamp_ms: (raw.timestamp_ms ?? 0n) as bigint,
    signature: raw.signature,
    payload: {
      items: raw.payload.items.map((i) => ({ ...i, num_sources: Number(i.num_sources) })),
    },
  };
}

/**
 * A Merkle proof element must be a 32-byte keccak256 hash, and nothing else.
 *
 * The chain would only reject a malformed one at SUBMISSION, and opaquely: a
 * short/long/garbage sibling folds to a root the enclave never signed, which
 * surfaces as `EInvalidSignature` from `verify_merkle_root` — at that point
 * indistinguishable from a genuinely forged signature. So it is checked twice,
 * at both doors a leaf can come through: on the wire ({@link parseSignedLeaves})
 * and again in the feed leg ({@link feedWaterxRuleWithProof}), which is the last
 * gate for a leaf handed in by a consumer's prefetch cache instead of parsed
 * here. Same reason the keeper's Rust builder checks the length.
 */
function assertHash32(symbol: string, sibling: string): void {
  if (!isHexOfBytes(sibling, 32)) {
    throw new Error(
      `WaterX leaf for ${symbol} carries a proof element that is not a 32-byte hex hash: ` +
        `'${sibling}'`,
    );
  }
}

/**
 * Parse a quote-center `/v1/quotes/leaves` response body (`{ leaves: [...] }`)
 * into {@link WaterxSignedLeaf}s, u64s exact as `bigint`, rejecting a malformed
 * leaf or proof element on the wire — before any PTB is touched.
 */
export function parseSignedLeaves(text: string): WaterxSignedLeaf[] {
  const raw = parseWithExactIntegers(text, "leaf") as { leaves?: unknown };
  if (!Array.isArray(raw.leaves)) {
    throw new Error("WaterX quote-center returned a malformed leaf response (expected { leaves })");
  }
  return raw.leaves.map((leaf, i) => {
    if (!isSignedLeafShape(leaf)) {
      // Name the leaf when it carried a usable symbol — a coverage gap and a
      // malformed field read very differently to whoever is paging through this.
      const named = (leaf as { symbol?: unknown })?.symbol;
      const which = typeof named === "string" && named !== "" ? `'${named}'` : `at index ${i}`;
      throw new Error(`WaterX quote-center returned a malformed signed leaf ${which}`);
    }
    for (const sibling of leaf.proof) assertHash32(leaf.symbol, sibling);
    return { ...leaf, num_sources: Number(leaf.num_sources) };
  });
}

/** The `waterx_rule` deployment entry; throws when the config carries none. */
function requireWaterxPackage(host: OracleHost): WaterxRulePackage {
  const entry = host.config.packages.waterx_rule;
  if (!entry) {
    throw new Error("waterx_rule package is not deployed in this config");
  }
  return entry;
}

/**
 * Resolve the quote-center infra for this host: each field independently from
 * the caller's `client.waterx` access slice (`waterxEndpoint` / `waterxFetch`
 * create options) when set, else this source's own `WATERX_INFRA` default /
 * `fetchWithPolicy`'s built-ins. Deliberately NO fallback onto `pyth.fetch`
 * or any other source's policy — sources stay fully independent.
 *
 * This is the seam a browser consumer needs: the envelope is fetched FROM THE
 * PAGE, so a front end whose origin the quote-center does not allow (CORS)
 * points `endpoint` at a same-origin proxy, or supplies its own `fetchImpl`.
 */
function resolveWaterxInfra(host: OracleHost): { endpoint: string; fetch?: FetchPolicy } {
  return {
    endpoint: host.waterx?.endpoint ?? WATERX_INFRA[host.network].endpoint,
    fetch: host.waterx?.fetch,
  };
}

/**
 * Pull one enclave-signed batch envelope covering `symbols` from the
 * quote-center. Goes through the shared `fetchWithPolicy` (`../update-fetch.ts`)
 * — same retry/timeout policy as the Pyth/Lazer fetches. No auth: the
 * quote-center read surface is public.
 *
 * The URL is built with `joinEndpointPath`, not `new URL(path, endpoint)`: a
 * leading-slash path is ABSOLUTE and silently drops the endpoint's own base
 * path, which is exactly what a `waterxEndpoint` proxy route is (a
 * `https://app.example/api/quote-center` override would have been rewritten to
 * `https://app.example/v1/quotes/update`, bypassing the proxy). Same footgun
 * that 404'd every Pyth Pro feed by dropping its `/hermes` prefix.
 */
async function fetchQuoteCenter(
  endpoint: string,
  path: string,
  symbols: string[],
  what: string,
  fetchOpts?: FetchPolicy,
): Promise<Response> {
  const url = joinEndpointPath(endpoint, path);
  url.searchParams.set("symbols", symbols.join(","));
  try {
    return await fetchWithPolicy(url.toString(), { method: "GET" }, { ...fetchOpts });
  } catch (err) {
    if (err instanceof FetchPolicyError && err.status !== undefined) {
      const body = err.bodySnippet ? ` ${err.bodySnippet}` : "";
      throw new Error(
        `WaterX quote-center ${what} failed: ${err.status}${body} (retries exhausted after ${err.attempts} attempts)`,
        { cause: err },
      );
    }
    throw err;
  }
}

/**
 * Pull one enclave-signed batch envelope covering `symbols` — the fallback
 * update shape AND the read executor's transport
 * (`readQuoteCenterPrices` in `../read-prices.ts`). Public seam (WL-2345):
 * consumers that need the raw envelope (BE prefetch caches, read planes)
 * call this instead of re-rolling the fetch + intent/shape gate.
 * `fellBackFrom`, when set, names the leaf-route failure that sent us here,
 * so a deployment whose quote-center serves NEITHER route reports both
 * statuses instead of only the second one.
 */
export async function fetchWaterxSignedUpdate(
  endpoint: string,
  symbols: string[],
  fetchOpts?: FetchPolicy,
  fellBackFrom?: string,
): Promise<WaterxSignedEnvelope> {
  const context = fellBackFrom ? ` (fell back from ${fellBackFrom})` : "";
  const res = await fetchQuoteCenter(endpoint, "v1/quotes/update", symbols, "fetch", fetchOpts);
  if (!res.ok) {
    throw new Error(
      `WaterX quote-center fetch failed: ${res.status} ${await res.text()}${context}`,
    );
  }
  // Parse from raw text (not res.json()) so the u64 fields are decoded exact as
  // bigint — see parseSignedEnvelope. Malformed-shape check lives there.
  const envelope = parseSignedEnvelope(await res.text());
  if (envelope.intent !== BATCH_PRICE_INTENT) {
    throw new Error(
      `WaterX quote-center returned intent ${envelope.intent}, expected BATCH_PRICE_INTENT ${BATCH_PRICE_INTENT}${context}`,
    );
  }
  return envelope;
}

/** A leaf pull either produced leaves, or the route isn't there to pull from. */
export type LeafPull = { leaves: WaterxSignedLeaf[] } | { unavailable: string };

/**
 * Pull per-symbol signed Merkle leaves — the DEFAULT update-data shape (see the
 * module header for why it beats the indivisible batch envelope on a trade path).
 *
 * Returns `{ unavailable }` on `404` — and ONLY on 404, the one status that
 * means "this route isn't here": a quote-center older than `/v1/quotes/leaves`
 * has no handler registered for the path. That is the version-skew case the
 * caller answers by falling back to the batch envelope, so the SDK and the
 * quote-center can be deployed in either order.
 *
 * Everything else THROWS rather than falling back, INCLUDING 5xx (`501` among
 * them — `fetchWithPolicy` classifies every 5xx as retryable and has already
 * spent its retry budget by the time one surfaces here). A degraded or
 * unreachable quote-center would fail the envelope route the same way — same
 * service, same enclave behind it — so falling back would only double the
 * latency of an already-failing money-path build, and would report an outage as
 * a version skew.
 *
 * A 404 can ALSO mean "unknown symbol" (the quote-center 404s a symbol missing
 * from its feed registry). That is config drift between this SDK's `feeds` and
 * the quote-center's registry, and the fallback surfaces it honestly: the
 * envelope route 404s on the same symbol, and its error names both attempts.
 *
 * Public seam (WL-2345): consumers holding per-symbol leaves (BE prefetch
 * caches) pull through this instead of re-rolling the fetch + parse gate.
 */
export async function fetchWaterxSignedLeaves(
  endpoint: string,
  symbols: string[],
  fetchOpts?: FetchPolicy,
): Promise<LeafPull> {
  const res = await fetchQuoteCenter(
    endpoint,
    "v1/quotes/leaves",
    symbols,
    "leaf fetch",
    fetchOpts,
  );
  if (res.status === 404) {
    return { unavailable: `GET /v1/quotes/leaves → 404 ${(await res.text()).trim()}`.trim() };
  }
  if (!res.ok) {
    throw new Error(`WaterX quote-center leaf fetch failed: ${res.status} ${await res.text()}`);
  }
  // Raw text, not res.json(): u64s must survive as exact bigints.
  return { leaves: parseSignedLeaves(await res.text()) };
}

/**
 * Every requested ticker must be covered by what came back. A 200 whose items
 * omit a requested symbol is a valid, well-signed response — nothing downstream
 * would reject it, and the build would emit a collect call that abstains for the
 * missing symbol, surfacing as an on-chain `EMissingPriceSource` (or a silently
 * thinner weighted set) much later. Same coverage rule
 * {@link WaterxRule.narrowUpdateData} enforces on a cached payload; the
 * difference is disposition — a cache miss falls back to a live fetch, whereas
 * the live source itself coming up short has no fallback left, so it throws.
 */
function assertCoverage(what: string, tickers: string[], covered: Iterable<string>): void {
  const have = new Set(covered);
  const missing = tickers.filter((t) => !have.has(t));
  if (missing.length > 0) {
    throw new Error(
      `WaterX quote-center ${what} does not cover ticker(s): ${missing.join(", ")} ` +
        `(requested ${tickers.join(", ")}; served ${[...have].join(", ") || "none"})`,
    );
  }
}

/**
 * Narrow a `RuleUpdateData` to this rule's payload (either variant), or `null`.
 * Kind/shape mismatches throw — see {@link assertRuleUpdateData}.
 */
function waterxPayloadOf(data: RuleUpdateData): WaterxUpdatePayload | null {
  return assertRuleUpdateData(
    data,
    "waterx_rule",
    isWaterxUpdatePayloadShape,
    "{ leaves: [...] } or { envelope: { intent, timestamp_ms, payload: { items }, signature } }",
  );
}

/**
 * Narrow a `RuleUpdateData` to its per-symbol {@link WaterxSignedLeaf}s, or
 * `null` when it carries a batch envelope instead (the fallback shape).
 */
export function waterxLeavesOf(data: RuleUpdateData): readonly WaterxSignedLeaf[] | null {
  const payload = waterxPayloadOf(data);
  return payload && "leaves" in payload ? payload.leaves : null;
}

/**
 * Narrow a `RuleUpdateData` to its `WaterxSignedEnvelope`, or `null` when it
 * carries per-symbol leaves instead (the default shape).
 */
export function waterxEnvelopeOf(data: RuleUpdateData): WaterxSignedEnvelope | null {
  const payload = waterxPayloadOf(data);
  return payload && "envelope" in payload ? payload.envelope : null;
}

/** Strip an optional `0x` prefix, then decode hex → bytes. */
function decodeHex(hex: string): Uint8Array {
  return fromHex(hex.startsWith("0x") ? hex.slice(2) : hex);
}

/**
 * `new_batch_item` with the item fields passed through VERBATIM: the u64s are
 * already exact bigints (see {@link parseWithExactIntegers}), so the BCS the
 * chain rebuilds matches the bytes the enclave signed — whether it re-verifies
 * them as one item of a batch payload or as a Merkle leaf.
 */
function newItemArg(tx: Transaction, pkg: string, item: WaterxBatchItem): TransactionArgument {
  return newBatchItem({
    package: pkg,
    arguments: {
      symbol: item.symbol,
      ticker: item.ticker,
      sources: item.sources,
      method: item.method,
      priceTimestampMs: item.price_timestamp_ms,
      priceN: item.price_n,
      priceScale: item.price_scale,
      confidenceN: item.confidence_n,
      confidenceScale: item.confidence_scale,
      maxSourceDeviationBps: item.max_source_deviation_bps,
      numSources: item.num_sources,
    },
  })(tx);
}

/**
 * `waterx_rule::collect_single_with_proof(collector, config, clock,
 * enclave_config, enclave, timestamp_ms, item, proof, sig)` — the DEFAULT feed
 * leg. Rebuilds ONE item in-PTB and hands it over with its Merkle proof; on-chain
 * the leaf is hashed, folded through the proof, and the enclave's signature over
 * the resulting root is verified before the price reaches the collector.
 *
 * Cost is what makes this the default: one item + `proof.length` 32-byte hashes
 * (~log2 of the snapshot width — 4 to 5 for the 29-feed mainnet registry),
 * against {@link feedWaterxRule}'s obligation to rebuild every item the batch
 * signature covers.
 *
 * Abort vs abstain is identical to the batch path (see the module header): a
 * mismatched root, a bad signature, a future signed timestamp, or a config
 * mismatch ABORTS; a freshness miss or a replayed signed timestamp abstains. One
 * extra abort of its own — `ECollectorSymbolMismatch` if the leaf's symbol isn't
 * the collector's — which `aggregateTicker` prevents by construction, since it
 * looks the leaf up BY the ticker it just built the collector for.
 */
export function feedWaterxRuleWithProof(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
  leaf: WaterxSignedLeaf,
): void {
  const wr = requireWaterxPackage(host);
  const pkg = wr.published_at;

  const item = newItemArg(tx, pkg, leaf);
  collectSingleWithProof({
    package: pkg,
    arguments: {
      collector,
      config: tx.object(wr.config),
      enclaveConfig: tx.object(wr.enclave_config),
      enclave: tx.object(wr.enclave),
      timestampMs: leaf.signed_timestamp_ms,
      item,
      // vector<vector<u8>>: sibling hashes in fold order, each re-checked as a
      // 32-byte hash (see assertHash32 — a cached leaf never passed the parser).
      proof: leaf.proof.map((sibling) => {
        assertHash32(leaf.symbol, sibling);
        return Array.from(decodeHex(sibling));
      }),
      sig: Array.from(decodeHex(leaf.signature)),
    },
  })(tx);
}

/**
 * `waterx_rule::collect_batch_latest(collector, config, clock, enclave_config,
 * enclave, timestamp_ms, payload, sig)` — the FALLBACK feed leg, for a
 * quote-center with no leaf route (and for callers that hold a whole batch).
 * Rebuilds the enclave-signed batch payload in-PTB (`new_batch_payload` + one
 * `new_batch_item`/`push_batch_item` per item, the exact shape the enclave
 * signed) and contributes the price for `collector.symbol()` to the collector.
 *
 * Every item must be rebuilt, not just this collector's: the signature covers
 * `BCS(IntentMessage)` over the whole vector, so a missing item is a failed
 * verify. That is the cost {@link feedWaterxRuleWithProof} exists to avoid.
 *
 * On-chain it abstains (records `none`) when the symbol is stale, absent from the
 * batch, or already recorded at this signed timestamp; it ABORTS on a bad
 * signature, a signed timestamp ahead of the `Clock`, or a config mismatch.
 */
export function feedWaterxRule(
  tx: Transaction,
  host: OracleHost,
  collector: TransactionArgument,
  envelope: WaterxSignedEnvelope,
): void {
  const wr = requireWaterxPackage(host);
  const pkg = wr.published_at;

  const payload = newBatchPayload({ package: pkg })(tx);
  for (const item of envelope.payload.items) {
    const itemArg = newItemArg(tx, pkg, item);
    pushBatchItem({ package: pkg, arguments: { payload, item: itemArg } })(tx);
  }

  collectBatchLatest({
    package: pkg,
    arguments: {
      collector,
      config: tx.object(wr.config),
      enclaveConfig: tx.object(wr.enclave_config),
      enclave: tx.object(wr.enclave),
      timestampMs: envelope.timestamp_ms,
      payload,
      sig: Array.from(decodeHex(envelope.signature)),
    },
  })(tx);
}

/**
 * THE quote-center pull — the one pipeline both coverage policies share:
 * package guard → own-key feeds partition → leaf route (default) → batch
 * envelope only when this quote-center has no leaf route (see
 * {@link fetchWaterxSignedLeaves} for exactly which statuses mean that, and
 * why nothing else falls back).
 *
 * `coverage` decides only what a GAP means, never how the pull runs:
 *
 * - `"strict"` — every requested ticker must be config-listed AND served, or
 *   this THROWS (the per-ticker unlisted message, before any network call;
 *   then {@link assertCoverage} naming the route). `missing` is always `[]`.
 * - `"partial"` — an unlisted or unserved ticker lands in `missing` and the
 *   payload covers the rest, narrowed through the rule's own
 *   {@link WaterxRule.narrowUpdateData} so leaf-vs-envelope divisibility has
 *   exactly one definition.
 */
async function pullWaterxData(
  host: OracleHost,
  tickers: string[],
  coverage: "strict" | "partial",
): Promise<{ data: RuleUpdateData; missing: string[] }> {
  // Package-level check first: a config without the deployment must say so,
  // not fail per ticker as if only that feed were missing.
  const { feeds } = requireWaterxPackage(host);
  // One partition pass, own-keys-only: a prototype-key ticker ("toString")
  // must read as unlisted, not pass as an inherited Function and reach the
  // network.
  const missing: string[] = [];
  const listed: string[] = [];
  for (const ticker of tickers) {
    (ownEntry(feeds, ticker) === undefined ? missing : listed).push(ticker);
  }
  // Unlisted tickers never reach the network on EITHER policy — the
  // quote-center 404s a whole batch on one unknown symbol. Strict surfaces
  // the per-ticker message; partial just records the gap and pulls the rest.
  if (coverage === "strict" && missing.length > 0) {
    throw new Error(`No waterx_rule feed listed for ticker: ${missing[0]}`);
  }
  if (listed.length === 0) return { data: null, missing };

  const { endpoint, fetch: fetchOpts } = resolveWaterxInfra(host);
  const pulled = await fetchWaterxSignedLeaves(endpoint, listed, fetchOpts);

  let route: "leaves" | "envelope";
  let payload: WaterxUpdatePayload;
  let served: Set<string>;
  if ("leaves" in pulled) {
    route = "leaves";
    payload = { leaves: pulled.leaves };
    served = new Set(pulled.leaves.map((leaf) => leaf.symbol));
  } else {
    const envelope = await fetchWaterxSignedUpdate(endpoint, listed, fetchOpts, pulled.unavailable);
    route = "envelope";
    payload = { envelope };
    served = new Set(envelope.payload.items.map((item) => item.symbol));
  }

  if (coverage === "strict") {
    assertCoverage(route, listed, served);
    return { data: { kind: "waterx_rule", payload }, missing };
  }

  const covered: string[] = [];
  for (const ticker of listed) (served.has(ticker) ? covered : missing).push(ticker);
  // Divisibility is the rule's own knowledge, so the subset decision is
  // delegated rather than re-encoded here: leaves subset per symbol, an
  // envelope is indivisible and passes whole (or `null` when it covers none).
  return {
    data:
      covered.length > 0
        ? WaterxRule.narrowUpdateData(host, { kind: "waterx_rule", payload }, covered)
        : null,
    missing,
  };
}

export const WaterxRule: PriceUpdateRule = {
  kind: "waterx_rule",

  // No credential: the quote-center read surface is public (no `credential`
  // declared — see `PriceUpdateRule.credential`).

  /** Tickers with a `waterx_rule.feeds` entry (keyed by oracle ticker). */
  supportedTickers(host: OracleHost): string[] {
    return Object.keys(host.config.packages.waterx_rule?.feeds ?? {});
  },

  /**
   * Pulls per-symbol Merkle leaves for `tickers`, falling back to one batch
   * envelope only when this quote-center has no leaf route. Returns only what
   * covers ALL of `tickers` — the strict arm of {@link pullWaterxData}.
   */
  async fetchUpdateData(host: OracleHost, tickers: string[]): Promise<RuleUpdateData> {
    if (tickers.length === 0) return null;
    return (await pullWaterxData(host, tickers, "strict")).data;
  },

  /**
   * Divisibility differs by variant, which is the whole reason this method
   * belongs to the rule and not to its consumers:
   *
   * - **Leaves** are per-symbol and independently verifiable (each carries its
   *   own proof + root signature), so a wider payload — e.g. a whole-universe
   *   prefetch cache — is SUBSET to exactly `tickers`. A trade then carries one
   *   leaf instead of the whole cached snapshot.
   * - **A batch envelope** carries a single signature over its whole `payload`
   *   and is indivisible: it is returned whole, or not at all.
   *
   * Either way a ticker this payload cannot serve → `null` (miss), never a
   * silent partial.
   */
  narrowUpdateData(_host: OracleHost, data: RuleUpdateData, tickers: string[]): RuleUpdateData {
    if (tickers.length === 0) return null;
    const leaves = waterxLeavesOf(data);
    if (leaves) {
      // Indexed by symbol, then walked in REQUESTED order: a `filter` would let
      // a payload that repeats one symbol and omits another pass on count alone.
      const bySymbol = new Map(leaves.map((l) => [l.symbol, l]));
      const subset: WaterxSignedLeaf[] = [];
      for (const ticker of tickers) {
        const leaf = bySymbol.get(ticker);
        if (!leaf) return null;
        subset.push(leaf);
      }
      return { kind: "waterx_rule", payload: { leaves: subset } };
    }
    const envelope = waterxEnvelopeOf(data);
    if (!envelope) return null;
    const covered = new Set(envelope.payload.items.map((i) => i.symbol));
    for (const ticker of tickers) {
      if (!covered.has(ticker)) return null;
    }
    return { kind: "waterx_rule", payload: { envelope } };
  },

  /**
   * The on-chain F-014 single-use replay key, rule-owned (see
   * `PriceUpdateRule.updateIdentityBySymbol`): each leaf's identity is its
   * OWN `signed_timestamp_ms`; an envelope's one `timestamp_ms` is the
   * identity of EVERY symbol it covers (one batch signature ⇒ one submission
   * burns the mark for all of them). A consumer's serve-at-most-once cache
   * keys off this map for BOTH payload shapes — including the leaf-first
   * default an envelope-only identity check would miss.
   */
  updateIdentityBySymbol(data: RuleUpdateData): Map<string, bigint> | null {
    // Narrowed ONCE: a serve-at-most-once cache calls this per serve, and the
    // accessors each re-run the full structural payload validation.
    const payload = waterxPayloadOf(data);
    if (!payload) return null;
    return "leaves" in payload
      ? new Map(payload.leaves.map((leaf) => [leaf.symbol, leaf.signed_timestamp_ms]))
      : new Map(
          payload.envelope.payload.items.map((item) => [
            item.symbol,
            payload.envelope.timestamp_ms,
          ]),
        );
  },

  /**
   * No shared verify step: both `waterx_rule` collect entries bundle verify AND
   * feed into one per-collector call, appended by
   * {@link feedWaterxRuleWithProof} / {@link feedWaterxRule} in the per-ticker
   * aggregate leg. So this emits nothing and returns `void` — the signed data
   * reaches the feed leg via `aggregate.ts`'s per-ticker map (built from the
   * group's fetched data), not a `RuleUpdateHandle`.
   */
  buildUpdateCalls(_tx: Transaction, _host: OracleHost, _data: RuleUpdateData): void {
    return;
  },
};

/**
 * Coverage-policy seam over the rule's quote-center pull (WL-2345): fetch
 * signed waterx update data for `tickers` with the caller choosing what a
 * coverage gap means.
 *
 * - `coverage: "strict"` (default) — exactly `WaterxRule.fetchUpdateData`:
 *   every requested ticker must be config-listed AND served, or the fetch
 *   THROWS (`assertCoverage`); `missing` is always `[]`. Trade-path semantics
 *   — `refreshOraclePrices` keeps consuming the rule's own strict fetch, so
 *   `aggregate.ts`'s uncarried-ticker throw (04117a1) still can't be reached
 *   by a payload that under-covers its group.
 * - `coverage: "partial"` — universe-prefetch semantics (a BE cache warming
 *   every known ticker at once): a ticker with no `waterx_rule.feeds` entry,
 *   or one the quote-center response does not serve, lands in `missing`
 *   instead of throwing, and `data` covers the rest. On the leaf route the
 *   payload is the covering leaf SUBSET; on the envelope route the envelope
 *   is kept iff it covers ≥1 requested ticker (it is indivisible — an
 *   envelope serving none is `data: null`). `data: null` + all-missing when
 *   nothing is servable.
 *
 * Consumers must not hand a partial payload to a build for tickers in
 * `missing` — those tickers are simply not servable by waterx right now (log
 * the gap; the chain's weight tables decide whether that starves anything).
 */
export async function fetchWaterxUpdateData(
  host: OracleHost,
  tickers: string[],
  opts?: { coverage?: "strict" | "partial" },
): Promise<{ data: RuleUpdateData; missing: string[] }> {
  if (tickers.length === 0) return { data: null, missing: [] };
  return pullWaterxData(host, tickers, opts?.coverage ?? "strict");
}
