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
 *   - `rules/*`             — one file per oracle rule (lazer / waterx / constant).
 *   - `aggregate.ts`        — the orchestrator that feeds rules into a collector + aggregates.
 *   - `canonical.ts` (+ `canonical/*`) — THE price read: the quote-center's canonical
 *                             plane (off-chain replica of the on-chain weighted aggregate),
 *                             REST seed + WebSocket stream.
 *   - `read-plane.ts` / `read-prices.ts` — per-source READ plans + their LEG executors
 *                             (deprecated for price reads — see `canonical.ts`).
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
// Canonical OracleSource value list + THE fed-set derivation (config in,
// sources out) — semantics and rationale in `source-list.ts`'s header. There
// is no `oracleSource` option and no `ORACLE_SOURCE` env var to parse.
export { ORACLE_SOURCES } from "./price-update-rule.ts";
export { deriveOracleSources } from "./source-list.ts";

// THE price read. What goes on chain as a leg reads its raw source (the
// signed leaves / the Lazer update, below); everything else reads the
// quote-center's CANONICAL plane — the off-chain replica of `oracle::aggregate`
// over the per-ticker weight tables, so the only off-chain price with the
// settlement's definition. Signatures fixed by the cross-repo plan
// (`readCanonicalPrices`, `openCanonicalStream`, `CanonicalQuote`); the rest is
// the shared wire contract for consumers' own tests.
export * from "./canonical.ts";

// The quote-center's error contract (numeric code table, body parser, the
// shared 404 classifier) — one home for the leaf fetch and the canonical reads.
// Public so a consumer rendering a quote's `reason` can name the vocabulary.
export {
  QUOTE_CENTER_ERROR_CODES,
  parseQuoteCenterError,
  quoteCenterErrorMeaning,
} from "./quote-center-error.ts";
export type { QuoteCenterError, QuoteCenterErrorMeaning } from "./quote-center-error.ts";

// Per-source READ-plane resolution — which tickers a source can price
// off-chain and with which ids (`resolveOracleReadPlan`; every source reads
// its OWN feeds namespace, so write set == read set), plus the executors that
// run a plan (`readLazerPrices` / `readQuoteCenterPrices`) and decode each
// source's wire scaling in ONE place. Both executors read ONE LEG and are
// `@deprecated` for price reads — see `canonical/frame.ts` for why.
// `LazerNotEntitledError` is re-exported (not just the type) for the same
// `instanceof` reason as `FetchPolicyError` above: a consumer drops
// unentitled feeds and retries.
export { resolveOracleReadPlan, readPlanTickers } from "./read-plane.ts";
export type { OracleReadPlan } from "./read-plane.ts";
export { LazerNotEntitledError, readLazerPrices, readQuoteCenterPrices } from "./read-prices.ts";
export type { OraclePriceEntry } from "./read-prices.ts";

// Boot-time deployment asserts consumers fold onto (`OracleTickerUnservedError`
// is `instanceof`-able, same rationale as above — and is the SAME type the
// per-build composers raise). Deliberately NOT called at client creation —
// see `validate.ts`'s header.
export {
  OracleTickerUnservedError,
  assertOracleWriteCoverage,
  missingOracleCredentials,
  partitionServableTickers,
  servableTickers,
} from "./validate.ts";
export type { OracleCredentialKind } from "./validate.ts";

// The ON-CHAIN half of the same question. `validate.ts` reasons from config
// alone (necessary, not sufficient); this reads the aggregator weights, which
// is the only way to catch a ticker that is servable by config yet weighted to
// a rule the fed set cannot supply — the shape that aborts a WHOLE PTB.
export {
  assertOracleWeightCoverage,
  readOracleWeightCoverage,
  OracleWeightCoverageError,
  OracleWeightUnreadableError,
} from "./weight-coverage.ts";
export type { TickerWeightCoverage } from "./weight-coverage.ts";

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
export type { OracleRefreshSummary } from "./aggregate.ts";

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
// and Bearer-keyed chart history. `PythProHistoryError` is re-exported for
// the same `instanceof` reason as `FetchPolicyError` above.
export { fetchPythSymbolCatalog } from "./symbol-catalog.ts";
export type { PythSymbolRecord } from "./symbol-catalog.ts";
export { fetchPythProHistory, PythProHistoryError } from "./pyth-pro-history.ts";
