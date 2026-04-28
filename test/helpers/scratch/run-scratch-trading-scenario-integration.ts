/**
 * Integration runner for {@link ScratchTradingScenario}: full scratch lifecycle on testnet.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { WaterXClient } from "@waterx/perp-sdk";
import { expect } from "vitest";

import { getPosition, positionExists } from "../../../src/fetch.ts";
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildOpenPositionTx,
  buildWithdrawCollateralTx,
} from "../../../src/tx-builders.ts";
import type { IntegrationMarketSnapshotMap } from "../../integration/helpers/integration-market-snapshot.ts";
import { assertMarketSnapshotTradeable } from "../../integration/helpers/integration-market-snapshot.ts";
import {
  expectResizeProbeMatchesSnapshot,
  leverageBpsFromPositionOpened,
  positionIdFromOpened,
  simulateResizeForIntegrationOrSkip,
} from "../../integration/helpers/scratch-lifecycle.ts";
import {
  computeValidPartialDecreaseSize,
  getMarketTradingSizeConstraints,
} from "../trading/market-trading-size-constraints.ts";
import { SCRATCH_EXPECT, type ScratchTradingScenario } from "./scratch-trading-scenarios.ts";

export type IntegrationScratchRunnerDeps = {
  client: WaterXClient;
  trader: Ed25519Keypair;
  execBuiltTxWithCooldownRetries: (
    build: () => Promise<import("@mysten/sui/transactions").Transaction>,
    signer: Ed25519Keypair,
    opts?: {
      cooldownMarketIds?: string[];
      retryDelayMs?: number;
      gasBudget?: number;
      maxAttempts?: number;
    },
  ) => Promise<unknown>;
  execIntegrationOrSkipSupra: (
    ctx: { skip: (reason?: string) => void },
    fn: () => Promise<unknown>,
  ) => Promise<unknown>;
  extractEvent: (result: unknown, eventSubstring: string) => unknown | undefined;
  assertSuccess: (result: unknown) => void;
  marketAtStart: IntegrationMarketSnapshotMap;
};

/**
 * Open → deposit → withdraw → increase → decrease → close; asserts match {@link SCRATCH_EXPECT.integration}.
 */
export async function runScratchTradingScenarioIntegration(
  ctx: { skip: (reason?: string) => void },
  deps: IntegrationScratchRunnerDeps,
  scenario: ScratchTradingScenario,
  accountId: string,
): Promise<void> {
  const {
    client,
    trader,
    execBuiltTxWithCooldownRetries,
    execIntegrationOrSkipSupra,
    extractEvent,
    assertSuccess,
    marketAtStart,
  } = deps;
  const base = scenario.base;
  const entry = client.getMarketEntry(base);
  const cooldownMarketIds = [entry.marketId];
  const snap = marketAtStart[base]!;
  assertMarketSnapshotTradeable(snap, base);

  const openProbe = await simulateResizeForIntegrationOrSkip(ctx, client, base, {
    collateralAmount: scenario.integrationOpen.collateral,
    leverage: scenario.integrationOpen.leverage,
  });
  if (openProbe === undefined) return;
  expectResizeProbeMatchesSnapshot(base, openProbe, snap);

  const openResult = await execIntegrationOrSkipSupra(ctx, () =>
    execBuiltTxWithCooldownRetries(
      () =>
        buildOpenPositionTx(client, {
          accountId,
          base,
          isLong: scenario.integrationOpen.isLong,
          leverage: scenario.integrationOpen.leverage,
          collateralAmount: scenario.integrationOpen.collateral,
        }),
      trader,
      { cooldownMarketIds },
    ),
  );
  if (openResult === undefined) return;
  assertSuccess(openResult);
  const opened = extractEvent(openResult, "PositionOpened");
  if (opened == null) throw new Error("missing PositionOpened");
  const positionId = positionIdFromOpened(opened);
  const openLevBps = leverageBpsFromPositionOpened(opened);
  expect(openLevBps).toBeGreaterThan(SCRATCH_EXPECT.integration.openLeverageBpsMinExclusive);
  expect(openLevBps).toBeLessThanOrEqual(snap.maxLeverageBps);
  expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(true);

  const increaseProbe = await simulateResizeForIntegrationOrSkip(ctx, client, base, {
    collateralAmount: scenario.increase.collateral,
    leverage: scenario.increase.leverage,
  });
  if (increaseProbe === undefined) return;
  expectResizeProbeMatchesSnapshot(base, increaseProbe, snap);

  const beforeDeposit = await getPosition(client, entry.marketId, positionId, entry.baseType);
  const expectedAfterDeposit = beforeDeposit.collateralAmount + scenario.depositCollateral;

  const depCollResult = await execBuiltTxWithCooldownRetries(
    () =>
      buildDepositCollateralTx(client, {
        accountId,
        base,
        positionId,
        collateralAmount: scenario.depositCollateral,
      }),
    trader,
    { cooldownMarketIds },
  );
  assertSuccess(depCollResult);
  const afterDeposit = await getPosition(client, entry.marketId, positionId, entry.baseType);
  expect(afterDeposit.collateralAmount).toBe(expectedAfterDeposit);

  const expectedAfterWithdraw = afterDeposit.collateralAmount - scenario.withdrawCollateral;
  expect(expectedAfterWithdraw).toBeGreaterThan(0n);

  const withCollResult = await execBuiltTxWithCooldownRetries(
    () =>
      buildWithdrawCollateralTx(client, {
        accountId,
        base,
        positionId,
        amount: scenario.withdrawCollateral,
      }),
    trader,
    { cooldownMarketIds },
  );
  assertSuccess(withCollResult);
  const afterWithdraw = await getPosition(client, entry.marketId, positionId, entry.baseType);
  expect(afterWithdraw.collateralAmount).toBe(expectedAfterWithdraw);

  const incResult = await execBuiltTxWithCooldownRetries(
    () =>
      buildIncreasePositionTx(client, {
        accountId,
        base,
        positionId,
        collateralAmount: scenario.increase.collateral,
        leverage: scenario.increase.leverage,
      }),
    trader,
    { cooldownMarketIds },
  );
  assertSuccess(incResult);
  expect(extractEvent(incResult, "PositionModified")).toBeDefined();
  expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(true);

  const info = await getPosition(client, entry.marketId, positionId, entry.baseType);
  const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.marketId);
  const decSize = computeValidPartialDecreaseSize(info.size, minSize, lotSize);
  if (decSize == null) {
    ctx.skip(
      `integration scratch: no valid partial decrease (size=${info.size}, min_size=${minSize}, lot_size=${lotSize})`,
    );
    return;
  }

  const decResult = await execBuiltTxWithCooldownRetries(
    () =>
      buildDecreasePositionTx(client, {
        accountId,
        base,
        positionId,
        size: decSize,
      }),
    trader,
    { cooldownMarketIds },
  );
  assertSuccess(decResult);
  expect(extractEvent(decResult, "PositionModified")).toBeDefined();
  expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(true);

  const closeResult = await execBuiltTxWithCooldownRetries(
    () =>
      buildClosePositionTx(client, {
        accountId,
        base,
        positionId,
        acceptablePrice: 0n,
      }),
    trader,
    { cooldownMarketIds },
  );
  assertSuccess(closeResult);
  expect(extractEvent(closeResult, "PositionClosed")).toBeDefined();
  expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(false);
}
