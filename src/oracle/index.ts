/**
 * Oracle module — the single source of truth for price freshness.
 *
 * Layering (no cross-imports between siblings except via `aggregate.ts`):
 *   - `host.ts`             — `OracleHost`, the narrow client slice this module reads.
 *   - `pyth.ts`             — Pyth as a price source: Hermes REST + on-chain update PTB.
 *   - `price-update-rule.ts`— `PriceUpdateRule`, the fetch/build strategy port a rule
 *                             implements (routing across rules is not wired yet).
 *   - `rules/*`             — one file per oracle rule (pyth / supra / constant / sponsor).
 *   - `aggregate.ts`        — the orchestrator that feeds rules into a collector + aggregates.
 *
 * `pyth.ts` deliberately imports NO rule package — Pyth-the-source and the
 * rules that consume it are separate concerns.
 */

export type { OracleHost } from "./host.ts";

// Pyth source
export {
  PythCache,
  fetchPriceFeedsUpdateData,
  buildPythPriceUpdateCalls,
  updatePythPrices,
} from "./pyth.ts";

// Price-update-rule port
export type {
  PriceUpdateRule,
  PriceUpdateRuleKind,
  RuleUpdateData,
  BuildUpdateOpts,
} from "./price-update-rule.ts";

// Pyth Core rule (PriceUpdateRule wrapper over the Pyth source above)
export { PythCoreRule } from "./rules/pyth-core-rule.ts";
export type { PythCoreUpdatePayload } from "./rules/pyth-core-rule.ts";

// Aggregation orchestrator
export {
  aggregateTicker,
  aggregateTickerWithPyth,
  aggregateTickerWithConstant,
  refreshOraclePrices,
} from "./aggregate.ts";

// Sponsor rule (fund open / reimburse + witness attach)
export { openPythSponsorFund, reimbursePythSponsor } from "./rules/sponsor.ts";
