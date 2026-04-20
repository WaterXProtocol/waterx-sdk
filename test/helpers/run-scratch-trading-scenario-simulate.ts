/**
 * E2e simulate runners for {@link ScratchTradingScenario} (testnet dry-run, no signing).
 */
import type { WaterXClient } from "@waterx/perp-sdk";
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildOpenPositionTx,
  buildWithdrawCollateralTx,
  getMarketSummary,
  getPoolSummary,
} from "@waterx/perp-sdk";

import { assertSimulateOpenFeeMatchesFormula } from "./assert-simulate-open-fee.ts";
import { expectLeverageOpenSizingVsMarket } from "./e2e-open-sizing-expect.ts";
import { lifecycleOracleUsdOrSkip } from "./e2e-oracle-context.ts";
import { fetchSimulatedCollateralUsdPrice } from "./oracle-simulate-multi-asset.ts";
import { SCRATCH_EXPECT, type ScratchTradingScenario } from "./scratch-trading-scenarios.ts";
import { assertSimulateSuccess, skipSimulateIfOracleTransient } from "./simulate-assertions.ts";

export type SimulateScratchCtx = { skip: (reason?: string) => void };

async function grpcSimulateWithEvents(
  client: WaterXClient,
  tx: import("@mysten/sui/transactions").Transaction,
): Promise<unknown> {
  return client.grpcClient.simulateTransaction({
    transaction: tx,
    include: { commandResults: true, events: true },
  });
}

/** `buildOpenPositionTx` + `approxPrice` from Hermes/oracle bundle (per-base USD). */
export async function scratchSimulateOpenApproxOracle(
  ctx: SimulateScratchCtx,
  client: WaterXClient,
  accountId: string,
  scenario: ScratchTradingScenario,
  setSender: (tx: import("@mysten/sui/transactions").Transaction) => void,
  trySimulate: (
    ctx: SimulateScratchCtx,
    tx: import("@mysten/sui/transactions").Transaction,
    minCommands: number,
  ) => Promise<void>,
): Promise<void> {
  const prices = await lifecycleOracleUsdOrSkip(client, ctx);
  if (!prices) return;
  const basePrice = prices[scenario.base];
  if (!basePrice) {
    ctx.skip(`No oracle price for ${scenario.base} (aggregator broken on testnet)`);
    return;
  }

  await expectLeverageOpenSizingVsMarket(
    client,
    scenario.base,
    scenario.simulateOpen.collateral,
    scenario.simulateOpen.leverage,
    basePrice,
  );

  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    leverage: scenario.simulateOpen.leverage,
    collateralAmount: scenario.simulateOpen.collateral,
  });
  setSender(tx);
  await trySimulate(ctx, tx, SCRATCH_EXPECT.simulate.minCommandsOpenStandard);
}

/** `buildOpenPositionTx` + explicit `size`; asserts open fee vs formula when simulate succeeds. */
export async function scratchSimulateOpenExplicitSizeWithFee(
  ctx: SimulateScratchCtx,
  client: WaterXClient,
  accountId: string,
  scenario: ScratchTradingScenario,
  setSender: (tx: import("@mysten/sui/transactions").Transaction) => void,
): Promise<void> {
  const entry = client.getMarketEntry(scenario.base);
  let marketBefore;
  let poolBefore;
  let collateralOracle;
  try {
    [marketBefore, poolBefore, collateralOracle] = await Promise.all([
      getMarketSummary(client, entry.marketId, entry.baseType),
      getPoolSummary(client),
      fetchSimulatedCollateralUsdPrice(client, "USDC"),
    ]);
  } catch (e) {
    ctx.skip(`prefetch for fee assertion failed: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    collateralAmount: scenario.simulateOpen.collateral,
    size: scenario.row.e2ePtb.openSize,
  });
  setSender(tx);
  const result = await grpcSimulateWithEvents(client, tx);
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, SCRATCH_EXPECT.simulate.minCommandsOpenStandard, {
    transaction: tx,
  });

  assertSimulateOpenFeeMatchesFormula(result, {
    tradingFeeBps: marketBefore.tradingFeeBps,
    longOi: marketBefore.longOi,
    shortOi: marketBefore.shortOi,
    poolTvlUsdScaled: poolBefore.tvlUsd,
    sizeDecimal: 9, // Float precision (1e9) — v2 has no per-market sizeDecimal
    collateralDecimal: 6,
    collateralPriceScaled: collateralOracle.scaled,
  });
}

/** On-chain `resize` sizing (no `approxPrice`, no explicit `size`). */
export async function scratchSimulateOpenResize(
  ctx: SimulateScratchCtx,
  client: WaterXClient,
  accountId: string,
  scenario: ScratchTradingScenario,
  setSender: (tx: import("@mysten/sui/transactions").Transaction) => void,
  trySimulate: (
    ctx: SimulateScratchCtx,
    tx: import("@mysten/sui/transactions").Transaction,
    minCommands: number,
  ) => Promise<void>,
): Promise<void> {
  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    leverage: scenario.simulateOpen.leverage,
    collateralAmount: scenario.simulateOpen.collateral,
  });
  setSender(tx);
  await trySimulate(ctx, tx, SCRATCH_EXPECT.simulate.minCommandsOpenResize);
}

/** `approxPrice` = lifecycle table ballpark (integration opt-in parity). */
export async function scratchSimulateOpenTableApproxPrice(
  ctx: SimulateScratchCtx,
  client: WaterXClient,
  accountId: string,
  scenario: ScratchTradingScenario,
  setSender: (tx: import("@mysten/sui/transactions").Transaction) => void,
  trySimulate: (
    ctx: SimulateScratchCtx,
    tx: import("@mysten/sui/transactions").Transaction,
    minCommands: number,
  ) => Promise<void>,
): Promise<void> {
  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    leverage: scenario.simulateOpen.leverage,
    collateralAmount: scenario.simulateOpen.collateral,
  });
  setSender(tx);
  await trySimulate(ctx, tx, SCRATCH_EXPECT.simulate.minCommandsOpenStandard);
}

/**
 * Stateful dry-runs on an **existing** open position (chain state). Skips if none resolved.
 */
export async function scratchSimulateStatefulOps(
  ctx: SimulateScratchCtx,
  client: WaterXClient,
  accountId: string,
  scenario: ScratchTradingScenario,
  positionId: number,
  setSender: (tx: import("@mysten/sui/transactions").Transaction) => void,
  trySimulate: (
    ctx: SimulateScratchCtx,
    tx: import("@mysten/sui/transactions").Transaction,
    minCommands: number,
  ) => Promise<void>,
): Promise<void> {
  const base = scenario.base;
  const st = scenario.statefulSimulate;
  const pid = Number(positionId);

  const incTx = await buildIncreasePositionTx(client, {
    accountId,
    base,
    positionId: pid,
    collateralAmount: st.increaseCollateral,
    size: st.increaseSize,
  });
  setSender(incTx);
  await trySimulate(ctx, incTx, 10);

  const decTx = await buildDecreasePositionTx(client, {
    accountId,
    base,
    positionId: pid,
    size: st.decreaseSize,
  });
  setSender(decTx);
  await trySimulate(ctx, decTx, 10);

  const depTx = await buildDepositCollateralTx(client, {
    accountId,
    base,
    positionId: pid,
    collateralAmount: st.depositCollateral,
  });
  setSender(depTx);
  await trySimulate(ctx, depTx, 11);

  const withTx = await buildWithdrawCollateralTx(client, {
    accountId,
    base,
    positionId: pid,
    amount: st.withdrawAmount,
  });
  setSender(withTx);
  await trySimulate(ctx, withTx, 10);

  const closeTx = await buildClosePositionTx(client, {
    accountId,
    base,
    positionId: pid,
  });
  setSender(closeTx);
  await trySimulate(ctx, closeTx, 10);
}
