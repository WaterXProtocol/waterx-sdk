/**
 * High-level perp transaction builders — barrel.
 *
 * Each `build*Tx` composer creates (or appends to) a `Transaction`, refreshes
 * the on-chain `Oracle` via the client's `oracleSource` fed set, optionally
 * pre-sweeps parked balances (`consolidateToUsd`), and calls the matching
 * `*_request` + `execute`. Implementations are split by domain under
 * `tx-builders/`:
 *
 *   common.ts       CommonBuildOpts + request/execute envelope + oracle refresh
 *   consolidate.ts  parked-balance → wxUSD pre-sweep (appendConsolidate*)
 *   trading.ts      position lifecycle + collateral + order lifecycle
 *   wlp.ts          mint / mint+stake / unstake+redeem / cancel-redeem+restake
 *   rewards.ts      claim staking rewards to the wxa account
 *   credit.ts       cross-chain credit / bridge (redeem VAA, withdraw, drain)
 */

export type { CommonBuildOpts } from "./tx-builders/common.ts";
export * from "../account/funding/consolidate.ts";
export * from "./tx-builders/trading.ts";
export * from "./tx-builders/wlp.ts";
export * from "./tx-builders/rewards.ts";
export * from "./tx-builders/credit.ts";

// Oracle helper re-exported for callers composing custom PTBs (the
// shared-refresh composition — see `CommonBuildOpts.skipOraclePriceRefresh`).
export { refreshOraclePrices } from "../oracle/index.ts";
