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
 *   - `read-plane.ts` / `read-prices.ts` — per-source READ plans + their executors.
 *   - `validate.ts`         — consumers' boot-time coverage/credential asserts.
 *   - `schedule.ts` / `symbol-catalog.ts` / `pyth-pro-history.ts` — market hours
 *                             (parser + status walker), the Pyth Pro symbol catalog,
 *                             and Pro chart history.
 */

export type { OracleHost } from "./host.ts";

// Shared fetch resilience wrapper — `FetchPolicyError` is re-exported (not
// just the type) so a consumer (e.g. a BE prefetch cache) can `instanceof`
// it off a failed rule fetch / `loadConfig` surface, without a deep import
// of `./update-fetch.ts`. `fetchWithPolicy` + `joinEndpointPath` are exported
// for consumers that hit oracle-adjacent endpoints THEMSELVES: one shared
// Bearer/timeout/retry policy and one base-path-safe URL join, instead of
// each caller re-rolling them (the hand-rolled copies were how base paths
// got dropped and Bearers went missing on sibling fetches).
export { FetchPolicyError, fetchWithPolicy, joinEndpointPath } from "./update-fetch.ts";
export type { FetchPolicy } from "./update-fetch.ts";

// Price-update-rule port
export type {
  PriceUpdateRule,
  PriceUpdateRuleKind,
  RuleUpdateData,
  RuleUpdateHandle,
  OracleCredentialRequirement,
  OracleCredentials,
  OracleSource,
  UpdateDataProvider,
} from "./price-update-rule.ts";
export { oracleCredentialsFromHost } from "./price-update-rule.ts";
// Canonical OracleSource value list + THE env-string parser consumers fold
// onto — semantics and rationale in `source-list.ts`'s header.
export { ORACLE_SOURCES } from "./price-update-rule.ts";
export { isOracleSource, parseOracleSourceList } from "./source-list.ts";

// Per-source READ-plane resolution — which tickers a source can price
// off-chain and with which ids (`resolveOracleReadPlan`; every source reads
// its OWN feeds namespace, so write set == read set), plus the executors that
// run a plan (`readLazerPrices` / `readQuoteCenterPrices`) and decode each
// source's wire scaling in ONE place. `LazerNotEntitledError` is re-exported
// (not just the type) for the same `instanceof` reason as `FetchPolicyError`
// above: a consumer drops unentitled feeds and retries.
export { resolveOracleReadPlan, readPlanTickers } from "./read-plane.ts";
export type { OracleReadPlan } from "./read-plane.ts";
export { LazerNotEntitledError, readLazerPrices, readQuoteCenterPrices } from "./read-prices.ts";
export type { OraclePriceEntry } from "./read-prices.ts";

// Boot-time deployment asserts consumers fold onto (`OracleFedSetError` is
// `instanceof`-able, same rationale as above). Deliberately NOT called at
// client creation — see `validate.ts`'s header.
export {
  OracleFedSetError,
  assertOracleWriteCoverage,
  missingOracleCredentials,
  servableTickers,
} from "./validate.ts";
export type { OracleCredentialKind } from "./validate.ts";

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
// Merkle leaves (default) or one indivisible batch envelope (fallback). The
// WL-2345 seams: the raw fetchers (`fetchWaterxSignedUpdate` /
// `fetchWaterxSignedLeaves`), the coverage-policy fetch
// (`fetchWaterxUpdateData`), and the freshness contract
// (`WATERX_MAX_PRICE_AGE_MS` / `isFreshWaterxEntry`).
export {
  WaterxRule,
  parseSignedEnvelope,
  parseSignedLeaves,
  BATCH_PRICE_INTENT,
  MERKLE_ROOT_INTENT,
  WATERX_INFRA,
  waterxQuoteCenterEndpoint,
  fetchWaterxSignedUpdate,
  fetchWaterxSignedLeaves,
  fetchWaterxUpdateData,
  pullWaterxQuotes,
  WATERX_MAX_PRICE_AGE_MS,
  isFreshWaterxEntry,
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
  LeafPull,
} from "./rules/waterx-rule.ts";

// `resolveOracleRule` is the ONE source→rule registry — exported so external
// consumers (e.g. a BE prefetch cache that keys per source and needs each
// source's `supportedTickers`/`fetchUpdateData`/`updateIdentityBySymbol`)
// resolve through it instead of hand-mirroring the map and drifting.
// `OracleSourceNotImplementedError` is its `instanceof`-able failure (same
// reason as `FetchPolicyError` above).
export { OracleSourceNotImplementedError, resolveOracleRule } from "./rule-registry.ts";

// Aggregation orchestrator
export { aggregateTicker, aggregateTickerWithConstant, refreshOraclePrices } from "./aggregate.ts";

// Market hours: the Pyth schedule-grammar parser + the pure market-status
// walker (the one cross-repo implementation — see `schedule.ts`'s header).
export { PythScheduleParseError, parsePythSchedule, getMarketStatus } from "./schedule.ts";
export type {
  HolidayDate,
  MarketStatusResult,
  ParsedPythSchedule,
  TradingHours,
  TradingSession,
} from "./schedule.ts";

// Pyth Pro symbol catalog (keyless; schedule strings + hex↔integer id map)
// and Bearer-keyed chart history.
export { fetchPythSymbolCatalog } from "./symbol-catalog.ts";
export type { PythSymbolRecord } from "./symbol-catalog.ts";
export { fetchPythProHistory } from "./pyth-pro-history.ts";
