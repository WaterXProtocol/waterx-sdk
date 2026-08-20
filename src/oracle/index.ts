/**
 * Oracle module — the single source of truth for price freshness.
 *
 * Layering (no cross-imports between siblings except via `aggregate.ts`):
 *   - `host.ts`             — `OracleHost`, the narrow client slice this module reads.
 *   - `update-fetch.ts`     — `fetchWithPolicy`, the shared retry/timeout/Bearer resilience
 *                             wrapper every off-chain oracle (and config) fetch goes through.
 *   - `price-update-rule.ts`— `PriceUpdateRule`, the fetch/build strategy port a rule
 *                             implements; `rule-registry.ts` + `aggregate.ts` wire
 *                             routing across rules.
 *   - `rules/*`             — one file per oracle rule (lazer / waterx / supra / constant).
 *   - `aggregate.ts`        — the orchestrator that feeds rules into a collector + aggregates.
 *
 * Pyth Core (`pyth_rule`) used to sit under this module as a price source of
 * its own; it was removed outright, together with its rule, its sponsor fee
 * flow, and its Hermes read plane.
 */

export type { OracleHost } from "./host.ts";

// Shared fetch resilience wrapper — `FetchPolicyError` is re-exported (not
// just the type) so a consumer (e.g. a BE prefetch cache) can `instanceof`
// it off the failure `PythLazerRule` /
// `loadConfig` surface, without a deep import of `./update-fetch.ts`.
// `fetchWithPolicy` + `joinEndpointPath` are exported for consumers that hit
// Hermes-compatible endpoints THEMSELVES (e.g. the BE's parsed latest-price
// bootstrap and Pyth schedule readers): one shared Bearer/timeout/retry
// policy and one base-path-safe URL join, instead of each caller re-rolling
// them (the hand-rolled copies were how the Pro `/hermes` base path got
// dropped and the Bearer went missing on sibling fetches).
export { FetchPolicyError, fetchWithPolicy, joinEndpointPath } from "./update-fetch.ts";
export type { FetchPolicy } from "./update-fetch.ts";

// NOTE: Pyth Core (`pyth_rule`) is GONE — the source module (`pyth.ts`), its
// rule (`PythCoreRule`), its collector-feed leg, the sponsor rule, and the
// whole update-fee apparatus (`OracleFeeSource`,
// `OracleFeeSourceUnavailableError`, `PythCache`, `buildPythPriceUpdateCalls`,
// `fetchPriceFeedsUpdateData`, the Hermes endpoint accessors) were removed
// with it. Nothing here replaces them: the remaining sources charge no update
// fee and read no Pyth on-chain state.

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
// off-chain (`resolveOracleReadPlan`). Only the quote-center plane is left:
// `pyth_lazer_rule` is write-only now that Core's hex feed ids are gone from
// the config, and reports every ticker it writes as `unreadable`.
export { resolveOracleReadPlan } from "./read-plane.ts";
export type { OracleReadPlan } from "./read-plane.ts";

// Pyth Lazer rule (signed-update generation; `feedLazerRule` stays internal to `aggregate.ts`)
// `LazerApiKeyMissingError` is re-exported (not just the type) for the same
// `instanceof` reason as `FetchPolicyError` above.
export { PythLazerRule, LazerApiKeyMissingError } from "./rules/pyth-lazer-rule.ts";
export type { PythLazerUpdatePayload } from "./rules/pyth-lazer-rule.ts";

// `WATERX_INFRA` / `waterxQuoteCenterEndpoint` are the source's own infra table +
// read-plane accessor.
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
// its `instanceof`-able failure (same reason as `FetchPolicyError`
// above).
export { OracleSourceNotImplementedError, resolveOracleRule } from "./rule-registry.ts";

// Aggregation orchestrator
export { aggregateTicker, aggregateTickerWithConstant, refreshOraclePrices } from "./aggregate.ts";
export type { OracleRefreshSummary } from "./aggregate.ts";
// `instanceof`-able for the same reason as `FetchPolicyError` above: a
// consumer branches on "the build refused to trade an unpriced ticker".
export { OracleTickerUnservedError } from "./aggregate.ts";

// Config-only feed introspection — which rules a ticker is WIRED for, before
// any fed-set/`oracleSource` consideration. Consumers that need to know
// whether a deployment can price a ticker at all (boot checks, market
// listings, collateral filters) read this instead of hardcoding `pyth_rule`.
export { configuredOracleRules, hasConfiguredOracleFeed } from "./feeds.ts";
export type { ConfiguredOracleRule } from "./feeds.ts";
