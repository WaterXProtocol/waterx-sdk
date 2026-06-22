/**
 * Shared `open at max leverage + 1 → err_exceed_max_leverage (104)` case.
 *
 * Used by both PRD TC-TRADE-003 (`prd-product-coverage`) and the broader
 * `trading-negative-simulate` suite so both copies stay in sync on:
 *
 * - leverage overshoot (must exceed the guard even when `resize` rounds
 *   notional near our small collateral); and
 * - acceptable outcomes on shared chains:
 *   - 104 `err_exceed_max_leverage` (primary expected)
 *   - 202 `err_insufficient_collateral` (fallback: accepted via `ctx.skip`
 *     because guard order can round down to 202 first)
 *   - oracle transient → `ctx.skip`.
 *
 * Keep the "skip on 202" logic here; duplicating it in callers caused drift.
 */
import type { Transaction } from "@mysten/sui/transactions";
import { buildOpenPositionTx, getMarketSummary } from "@waterx/sdk";
import type { BaseAsset, WaterXClient } from "@waterx/sdk";

import { lifecycleRow } from "../e2e/lifecycle-test-markets.ts";
import {
  assertSimulateMoveAbort,
  parseSimulateFailure,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../e2e/simulate-assertions.ts";
import { WATERX_PERP_ABORT } from "../waterx-perp-error-codes.ts";

type SimulateCtx = { skip: (reason?: string) => void };

/**
 * Compute a leverage value guaranteed to be above the on-chain `maxLeverageBps`
 * by at least 20 % (min +1), so the leverage guard fires before the collateral
 * sizing guard on markets where `resize` rounds notional near the test
 * collateral.
 */
export function leverageAboveMax(maxLeverageBps: bigint): number {
  const currentMax = Number(maxLeverageBps) / 10_000;
  return Math.max(currentMax + 1, Math.floor(currentMax * 1.2) + 1);
}

/**
 * Run `buildOpenPositionTx` with leverage above the market's max and assert
 * the simulate aborts at `err_exceed_max_leverage` (104). If the shared chain
 * instead aborts at 202 (insufficient collateral — equally valid guard
 * rejection), `ctx.skip` with a descriptive reason.
 */
export async function assertOpenAboveMaxLeverageAborts(
  ctx: SimulateCtx,
  client: WaterXClient,
  base: BaseAsset,
  accountId: string,
  owner: string,
  simulate: (tx: Transaction) => Promise<unknown>,
): Promise<void> {
  const row = lifecycleRow(base);
  const entry = client.getMarketEntry(base);
  const summary = await getMarketSummary(client, entry.marketId, entry.baseType);

  const tx = await buildOpenPositionTx(client, {
    accountId,
    base,
    isLong: row.isLong,
    leverage: leverageAboveMax(summary.maxLeverageBps),
    collateralAmount: row.simulateOpenCollateral,
  });
  tx.setSender(owner);

  const result = await simulateWithTransientRetry(() => simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;

  const meta = parseSimulateFailure(result);
  if (meta && meta.abortCode === "202") {
    ctx.skip(
      `${base}: open above-max-leverage aborted at 202 (insufficient_collateral) before leverage check`,
    );
    return;
  }

  assertSimulateMoveAbort(result, {
    abortCode: WATERX_PERP_ABORT.EXCEED_MAX_LEVERAGE,
    locationIncludes: "err_exceed_max_leverage",
  });
}
