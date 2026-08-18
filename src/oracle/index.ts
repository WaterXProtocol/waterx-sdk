/**
 * Oracle module — the single source of truth for price freshness.
 *
 * Layering (no cross-imports between siblings except via `aggregate.ts`):
 *   - `host.ts`             — `OracleHost`, the narrow client slice this module reads.
 *   - `update-fetch.ts`     — `fetchWithPolicy`, the shared retry/timeout/Bearer resilience
 *                             wrapper every off-chain oracle (and config) fetch goes through.
 *   - `pyth.ts`             — Pyth as a price source: Hermes REST + on-chain update PTB.
 *   - `price-update-rule.ts`— `PriceUpdateRule`, the fetch/build strategy port a rule
 *                             implements; `rule-registry.ts` + `aggregate.ts` wire
 *                             routing across rules.
 *   - `rules/*`             — one file per oracle rule (pyth / supra / constant / sponsor).
 *   - `aggregate.ts`        — the orchestrator that feeds rules into a collector + aggregates.
 *
 * `pyth.ts` deliberately imports NO rule package — Pyth-the-source and the
 * rules that consume it are separate concerns.
 */

export type { OracleHost } from "./host.ts";

// Shared fetch resilience wrapper — `FetchPolicyError` is re-exported (not
// just the type) so a consumer (e.g. a BE prefetch cache) can `instanceof`
// it off the failure `fetchPriceFeedsUpdateData` / `PythLazerRule` /
// `loadConfig` surface, without a deep import of `./update-fetch.ts`.
// `fetchWithPolicy` + `joinEndpointPath` are exported for consumers that hit
// Hermes-compatible endpoints THEMSELVES (e.g. the BE's parsed latest-price
// bootstrap and Pyth schedule readers): one shared Bearer/timeout/retry
// policy and one base-path-safe URL join, instead of each caller re-rolling
// them (the hand-rolled copies were how the Pro `/hermes` base path got
// dropped and the Bearer went missing on sibling fetches).
export { FetchPolicyError, fetchWithPolicy, joinEndpointPath } from "./update-fetch.ts";
export type { FetchPolicy } from "./update-fetch.ts";

// Pyth source — `OracleFeeSourceUnavailableError` and
// `HermesEndpointRejectedAllFeedsError` are re-exported (not just the types)
// for the same `instanceof` reason as `FetchPolicyError` above: a consumer of
// `buildPythPriceUpdateCalls` / `updatePythPrices` / `refreshOraclePrices` can
// branch on the fee-source failure directly, and a consumer of
// `fetchPriceFeedsUpdateData` / `probeMissingFeeds` can tell a misconfigured
// or unentitled endpoint apart from feeds that endpoint genuinely lacks.
export {
  PythCache,
  fetchPriceFeedsUpdateData,
  endpointSupportedFeedIds,
  probeMissingFeeds,
  buildPythPriceUpdateCalls,
  // The pyth read-plane endpoint accessors — Core (keyless, per network) and
  // Pro (the documented fixed base; auth via the caller's Bearer key). There
  // is no client-level endpoint field: consumers pick via
  // `resolveHermesReadEndpoint` (pyth_rule listed → Core, else override ??
  // Pro) — never a hand-rolled branch, never a cross-source fallback.
  pythCoreHermesEndpoint,
  pythProHermesEndpoint,
  PYTH_PRO_HERMES_ENDPOINT,
  updatePythPrices,
  HermesEndpointRejectedAllFeedsError,
  MISSING_FEED_MEMO_TTL_MS,
  OracleFeeSourceUnavailableError,
} from "./pyth.ts";
export type { OracleFeeSource } from "./pyth.ts";

// Price-update-rule port
export type {
  PriceUpdateRule,
  PriceUpdateRuleKind,
  RuleUpdateData,
  RuleUpdateHandle,
  BuildUpdateOpts,
  OracleSource,
  UpdateDataProvider,
} from "./price-update-rule.ts";
// Canonical OracleSource value list + THE env-string parser consumers fold
// onto — semantics and rationale in `source-list.ts`'s header.
export { ORACLE_SOURCES } from "./price-update-rule.ts";
export { isOracleSource, parseOracleSourceList } from "./source-list.ts";

// Per-source READ-plane resolution — which tickers a source can price
// off-chain and with which ids (`resolveOracleReadPlan`), and which
// Hermes-compatible base the hermes plans execute against
// (`resolveHermesReadEndpoint`: pyth_rule listed → Core, else override ??
// the documented Pyth Pro base). The one place the "lazer reads through
// `pyth_rule.feeds` hex ids" invariant lives; consumers resolve through
// this instead of hardcoding namespace sharing or endpoint branching.
export { resolveOracleReadPlan, resolveHermesReadEndpoint } from "./read-plane.ts";
export type { OracleReadPlan } from "./read-plane.ts";

// Pyth Core rule (PriceUpdateRule wrapper over the Pyth source above)
export { PythCoreRule } from "./rules/pyth-core-rule.ts";
export type { PythCoreUpdatePayload } from "./rules/pyth-core-rule.ts";

// Pyth Lazer rule (signed-update generation; `feedLazerRule` stays internal to `aggregate.ts`)
// `LazerApiKeyMissingError` is re-exported (not just the type) for the same
// `instanceof` reason as `OracleFeeSourceUnavailableError` above.
export { PythLazerRule, LazerApiKeyMissingError } from "./rules/pyth-lazer-rule.ts";
export type { PythLazerUpdatePayload } from "./rules/pyth-lazer-rule.ts";

// `WATERX_INFRA` / `waterxQuoteCenterEndpoint` are the source's own infra table +
// read-plane accessor (mirrors `pythCoreHermesEndpoint`).
// WaterX quote-center rule (first-party ed25519 signed prices; the `feedWaterxRule*`
// legs stay internal to `aggregate.ts`). Both wire shapes are exported because a
// BE prefetch cache holds whichever one its quote-center serves: per-symbol
// Merkle leaves (default) or one indivisible batch envelope (fallback).
export {
  WaterxRule,
  parseSignedEnvelope,
  parseSignedLeaves,
  BATCH_PRICE_INTENT,
  MERKLE_ROOT_INTENT,
  WATERX_INFRA,
  waterxQuoteCenterEndpoint,
  // Rule-owned payload accessors (kind-check + unwrap in one place) — never
  // hand-cast the payload shape, and never assume which variant it is.
  waterxLeavesOf,
  waterxEnvelopeOf,
} from "./rules/waterx-rule.ts";
export type {
  WaterxUpdatePayload,
  WaterxLeafPayload,
  WaterxEnvelopePayload,
  WaterxSignedEnvelope,
  WaterxSignedLeaf,
  WaterxBatchItem,
} from "./rules/waterx-rule.ts";

// `resolveOracleRule` is the ONE source→rule registry — exported so external
// consumers (e.g. a BE prefetch cache that keys per source and needs each
// source's `supportedTickers`/`fetchUpdateData`) resolve through it instead of
// hand-mirroring the map and drifting. `OracleSourceNotImplementedError` is
// its `instanceof`-able failure (same reason as `OracleFeeSourceUnavailableError`
// above).
export { OracleSourceNotImplementedError, resolveOracleRule } from "./rule-registry.ts";

// Aggregation orchestrator
export {
  aggregateTicker,
  aggregateTickerWithPyth,
  aggregateTickerWithConstant,
  refreshOraclePrices,
} from "./aggregate.ts";

// Sponsor rule (fund open / reimburse + witness attach)
export { openPythSponsorFund, reimbursePythSponsor } from "./rules/sponsor.ts";
