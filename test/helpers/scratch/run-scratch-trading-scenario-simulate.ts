/**
 * E2e simulate runners for {@link ScratchTradingScenario} (testnet dry-run, no signing).
 */
import type { CollateralAsset, WaterXClient } from "@waterx/perp-sdk";
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

import { expectLeverageOpenSizingVsMarket } from "../e2e/e2e-open-sizing-expect.ts";
import { lifecycleOracleUsdOrSkip } from "../e2e/e2e-oracle-context.ts";
import { fetchSimulatedCollateralUsdPrice } from "../e2e/oracle-simulate-multi-asset.ts";
import { maybeWriteScratchOpenSimulateDump } from "../e2e/scratch-open-simulate-dump.ts";
import {
  assertSimulateSuccess,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../e2e/simulate-assertions.ts";
import { assertSimulateOpenFeeMatchesFormula } from "../trading/assert-simulate-open-fee.ts";
import {
  alignExplicitTradingSize,
  computeValidPartialDecreaseSize,
  getMarketTradingSizeConstraints,
} from "../trading/market-trading-size-constraints.ts";
import { SCRATCH_EXPECT, type ScratchTradingScenario } from "./scratch-trading-scenarios.ts";

export type SimulateScratchCtx = { skip: (reason?: string) => void };

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function maxBigInt(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

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
  const result = await simulateWithTransientRetry(() => grpcSimulateWithEvents(client, tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, SCRATCH_EXPECT.simulate.minCommandsOpenStandard, {
    transaction: tx,
  });
  maybeWriteScratchOpenSimulateDump({
    base: scenario.base,
    kind: "approx-oracle",
    result,
  });
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

  let openSize = BigInt(scenario.row.e2ePtb.openSize);
  try {
    const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.marketId);
    const aligned = alignExplicitTradingSize(openSize, minSize, lotSize);
    if (aligned == null) {
      ctx.skip(
        `explicit openSize ${openSize} cannot satisfy min_size=${minSize} lot_size=${lotSize} (${scenario.base})`,
      );
      return;
    }
    openSize = aligned;
  } catch (e) {
    ctx.skip(`market size constraints: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    collateralAmount: scenario.simulateOpen.collateral,
    size: openSize,
  });
  setSender(tx);
  const result = await simulateWithTransientRetry(() => grpcSimulateWithEvents(client, tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, SCRATCH_EXPECT.simulate.minCommandsOpenStandard, {
    transaction: tx,
  });
  maybeWriteScratchOpenSimulateDump({
    base: scenario.base,
    kind: "explicit-size",
    result,
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
): Promise<void> {
  const tx = await buildOpenPositionTx(client, {
    accountId,
    base: scenario.base,
    isLong: scenario.simulateOpen.isLong,
    leverage: scenario.simulateOpen.leverage,
    collateralAmount: scenario.simulateOpen.collateral,
  });
  setSender(tx);
  const result = await simulateWithTransientRetry(() => grpcSimulateWithEvents(client, tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, SCRATCH_EXPECT.simulate.minCommandsOpenResize, {
    transaction: tx,
  });
  maybeWriteScratchOpenSimulateDump({
    base: scenario.base,
    kind: "resize",
    result,
  });
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
  opts: {
    currentSize?: bigint;
    currentCollateralAmount?: bigint;
    collateral?: CollateralAsset;
  } = {},
): Promise<void> {
  const base = scenario.base;
  const st = scenario.statefulSimulate;
  const pid = Number(positionId);
  const collateral = opts.collateral ?? "USDC";

  const incTx = await buildIncreasePositionTx(client, {
    accountId,
    base,
    collateral,
    positionId: pid,
    collateralAmount: st.increaseCollateral,
    size: st.increaseSize,
  });
  setSender(incTx);
  await trySimulate(ctx, incTx, 10);

  let decreaseSize: bigint;
  if (opts.currentSize != null) {
    const mEntry = client.getMarketEntry(base);
    const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, mEntry.marketId);
    const valid = computeValidPartialDecreaseSize(opts.currentSize, minSize, lotSize);
    if (valid == null) {
      ctx.skip(
        `stateful ops: no valid partial decrease (position size=${opts.currentSize}, min_size=${minSize}, lot_size=${lotSize})`,
      );
      return;
    }
    decreaseSize = valid;
  } else {
    decreaseSize = st.decreaseSize;
  }
  const decTx = await buildDecreasePositionTx(client, {
    accountId,
    base,
    collateral,
    positionId: pid,
    size: decreaseSize,
  });
  setSender(decTx);
  await trySimulate(ctx, decTx, 10);

  const depTx = await buildDepositCollateralTx(client, {
    accountId,
    base,
    collateral,
    positionId: pid,
    collateralAmount: st.depositCollateral,
  });
  setSender(depTx);
  await trySimulate(ctx, depTx, 11);

  // Cap withdraw at 1% of discovered collateral so mainnet positions that sit
  // near max leverage don't immediately cross the leverage cap (104).
  const withdrawAmt =
    opts.currentCollateralAmount != null
      ? minBigInt(st.withdrawAmount, maxBigInt(1n, opts.currentCollateralAmount / 100n))
      : st.withdrawAmount;
  const withTx = await buildWithdrawCollateralTx(client, {
    accountId,
    base,
    collateral,
    positionId: pid,
    amount: withdrawAmt,
  });
  setSender(withTx);
  await trySimulate(ctx, withTx, 10);

  const closeTx = await buildClosePositionTx(client, {
    accountId,
    base,
    collateral,
    positionId: pid,
  });
  setSender(closeTx);
  await trySimulate(ctx, closeTx, 10);
}
