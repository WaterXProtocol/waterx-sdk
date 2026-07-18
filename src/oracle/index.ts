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
// `fetchWithPolicy` itself stays module-internal (no external caller yet).
export { FetchPolicyError } from "./update-fetch.ts";
export type { FetchPolicy } from "./update-fetch.ts";

// Pyth source — `OracleFeeSourceUnavailableError` is re-exported (not just
// the type) for the same `instanceof` reason as `FetchPolicyError` above: a
// consumer of `buildPythPriceUpdateCalls` / `updatePythPrices` /
// `refreshOraclePrices` can branch on the fee-source failure directly.
export {
  PythCache,
  fetchPriceFeedsUpdateData,
  buildPythPriceUpdateCalls,
  updatePythPrices,
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

// Pyth Core rule (PriceUpdateRule wrapper over the Pyth source above)
export { PythCoreRule } from "./rules/pyth-core-rule.ts";
export type { PythCoreUpdatePayload } from "./rules/pyth-core-rule.ts";

// Pyth Lazer rule (signed-update generation; `feedLazerRule` stays internal to `aggregate.ts`)
export { PythLazerRule } from "./rules/pyth-lazer-rule.ts";
export type { PythLazerUpdatePayload } from "./rules/pyth-lazer-rule.ts";

// `resolveOracleRule` (rule-registry.ts) is NOT re-exported here — it has one
// production consumer (`refreshOraclePrices` below) and no external caller;
// per repo convention ("no unused exports") it stays module-internal. Tests
// import it directly from `./rule-registry.ts`.

// Aggregation orchestrator
export {
  aggregateTicker,
  aggregateTickerWithPyth,
  aggregateTickerWithConstant,
  refreshOraclePrices,
} from "./aggregate.ts";

// Sponsor rule (fund open / reimburse + witness attach)
export { openPythSponsorFund, reimbursePythSponsor } from "./rules/sponsor.ts";
