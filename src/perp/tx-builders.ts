/**
 * High-level perp transaction builders — barrel.
 *
 * Each `build*Tx` composer creates (or appends to) a `Transaction`, refreshes
 * the on-chain `Oracle` via Pyth, optionally pre-sweeps parked balances
 * (`consolidateToUsd`), wires the `pyth_sponsor_rule` flow when deployed in
 * config, and calls the matching `*_request` + `execute`. Implementations are
 * split by domain under `tx-builders/`:
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

// Oracle helpers re-exported for callers composing custom PTBs.
export {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  updatePythPrices,
} from "../oracle/index.ts";
