/**
 * E2E simulate (no keys):
 * - Open + increase: one PTB (two ops — new position; cooldown rules differ from same-position chaining).
 * - Decrease / close: **separate** single-op PTBs. Same PTB cannot do decrease then close when
 *   `cooldown_ms > 0` because `Clock::timestamp_ms` is fixed for the whole transaction.
 */
import { Transaction } from "@mysten/sui/transactions";
import {
  getAccountBalance,
  getAccountCoins,
  getAccountsByOwner,
  getMarketCooldownMs,
  getMarketSummary,
  getPosition,
} from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import type { BaseAsset } from "../../src/constants.ts";
import { PYTH_TESTNET_FEED_IDS, TESTNET_COLLATERALS } from "../../src/constants.ts";
import {
  closePosition,
  decreasePosition,
  depositCollateral,
  increasePosition,
  openPosition,
  withdrawCollateral,
} from "../../src/user/trading.ts";
import { updatePythPrices } from "../../src/utils/pyth.ts";
import { buildOracleFeedForSimulate as buildOracleFeed } from "../helpers/build-oracle-feed-simulate.ts";
import { ensureAtLeastFundedTtoUsdcCoinsForSimulate } from "../helpers/ensure-tto-usdc-coins-for-simulate.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS as OWNER } from "../helpers/integration-reference-wallet.ts";
import { activeLifecycleTestBases, lifecycleRow } from "../helpers/lifecycle-test-markets.ts";
import { resolveE2eOpenPosition } from "../helpers/resolve-e2e-open-position.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfOracleTransient,
  type SimulateResult,
} from "../helpers/simulate-assertions.ts";
import { client } from "../helpers/testnet.ts";

const E2E_DEPOSIT_COLLATERAL = 1_000_000n;
const E2E_WITHDRAW_COLLATERAL = 1_000_000n;

function sameAccountAddress(a: string, b: string): boolean {
  return a.replace(/^0x/i, "").toLowerCase() === b.replace(/^0x/i, "").toLowerCase();
}

type ReferenceOpenPosition = {
  positionId: bigint;
  /** From `positionInfo`; `update_timestamp` is ms (same as `Clock::timestamp_ms`). */
  info: Awaited<ReturnType<typeof getPosition>>;
};

async function findReferenceOpenPosition(
  accountId: string,
  base: BaseAsset,
): Promise<ReferenceOpenPosition | null> {
  const hit = await resolveE2eOpenPosition(client, accountId, base);
  return hit ? { positionId: hit.positionId, info: hit.info } : null;
}

/** True when chain clock (approx. `Date.now()` on testnet) is past cooldown after last position touch. */
function tradingCooldownElapsedAfterUpdate(
  updateTimestampMs: bigint,
  cooldownMs: bigint,
  slackMs = 750,
): boolean {
  const eligibleAt = Number(updateTimestampMs) + Number(cooldownMs) + slackMs;
  return Date.now() >= eligibleAt;
}

type VitestTaskCtx = { skip: (reason?: string) => void };

async function referenceAccountId(ctx: VitestTaskCtx): Promise<string | null> {
  const accounts = await getAccountsByOwner(client, OWNER);
  if (!accounts.length) {
    ctx.skip(`No WaterX UserAccount for ${OWNER}. Run pnpm create-testnet-account.`);
    return null;
  }
  try {
    return pickE2eAccountIdForOwner(OWNER, accounts);
  } catch (e) {
    ctx.skip(e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Testnet: oracle feeds/aggregate can transiently fail (source stale/missing/threshold). */
function assertSimulateSuccessOrSkipOracleWeak(
  ctx: VitestTaskCtx,
  result: unknown,
  minCommands: number,
  tx: Transaction,
) {
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

/** Best-effort Hermes → Pyth on-chain update for base + USDC feeds. */
async function appendBestEffortPythUpdates(tx: Transaction, base: BaseAsset) {
  const m = client.getMarketEntry(base);
  const cfg = client.config;
  const pythCfg = cfg.pythConfig!;
  const baseFeedId = PYTH_TESTNET_FEED_IDS[m.feedKey]!.replace(/^0x/, "");
  const usdcFeedId = PYTH_TESTNET_FEED_IDS[TESTNET_COLLATERALS.USDC.feedKey]!.replace(/^0x/, "");
  try {
    await updatePythPrices(tx, client.grpcClient, pythCfg, [baseFeedId, usdcFeedId]);
  } catch {
    /* Hermes down */
  }
}

describe("open + increase (single-PTB simulate, no keys)", () => {
  for (const base of activeLifecycleTestBases()) {
    const row = lifecycleRow(base);
    const ptb = row.e2ePtb;
    const minUsdc = ptb.openCollateral + ptb.increaseCollateral;

    it(`${base} ${row.isLong ? "long" : "short"} open → increase (single PTB dry-run)`, async (ctx) => {
      const accountId = await referenceAccountId(ctx);
      if (!accountId) return;

      const usdc = client.config.collaterals.USDC;
      const usdcBalance = await getAccountBalance(client, accountId, usdc.type);
      if (usdcBalance < minUsdc) {
        ctx.skip(
          `Insufficient USDC: have ${usdcBalance}, need ${minUsdc}. ` +
            `Fund the integration wallet/UserAccount, then run \`pnpm e2e:prepare\` (or deposit manually).`,
        );
        return;
      }

      const minPerCoin =
        ptb.openCollateral >= ptb.increaseCollateral ? ptb.openCollateral : ptb.increaseCollateral;
      const funded = await ensureAtLeastFundedTtoUsdcCoinsForSimulate({
        ctx,
        client,
        accountId,
        usdcType: usdc.type,
        minBalancePerCoin: minPerCoin,
        needCount: 2,
      });
      if (!funded) return;

      const m = client.getMarketEntry(base);
      const btcSummary = await getMarketSummary(client, m.marketId, m.baseType);
      const positionId = btcSummary.nextPositionId;

      const tx = new Transaction();
      tx.setSender(OWNER);
      tx.setGasBudget(300_000_000);

      await appendBestEffortPythUpdates(tx, base);
      const cfg = client.config;
      const tradingBase = {
        collateralTokenType: usdc.type,
        baseTokenType: m.baseType,
        lpTokenType: cfg.wlpType,
        market: m.marketId,
        accountId,
      };

      const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp1 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      openPosition(client, tx, {
        ...tradingBase,
        receivingCoins: [funded[0]!],
        collateralAmount: ptb.openCollateral,
        isLong: row.isLong,
        size: ptb.openSize,
        basePriceResult: bp1,
        collateralPriceResult: cp1,
      });

      const bp2 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp2 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      increasePosition(client, tx, {
        ...tradingBase,
        positionId,
        receivingCoins: [funded[1]!],
        collateralAmount: ptb.increaseCollateral,
        size: ptb.increaseSize,
        basePriceResult: bp2,
        collateralPriceResult: cp2,
      });

      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 22, tx);
    }, 120_000);
  }
});

describe("decrease existing position (single-op PTB simulate, cooldown prechecked)", () => {
  for (const base of activeLifecycleTestBases()) {
    const row = lifecycleRow(base);
    const decSize = row.e2ePtb.decreaseSize;

    it(`${base}: decrease only`, async (ctx) => {
      const accountId = await referenceAccountId(ctx);
      if (!accountId) return;

      const found = await findReferenceOpenPosition(accountId, base);
      if (!found) {
        ctx.skip(
          `No open ${base} position for this UserAccount (${accountId.slice(0, 10)}…). ` +
            "Set `test/helpers/e2e-fixed-positions.ts`, or run `pnpm test:integration` / `pnpm e2e:bootstrap-positions`.",
        );
        return;
      }
      const { positionId: existingPositionId, info } = found;
      if (info.size < decSize) {
        ctx.skip(
          `On-chain size ${info.size} < e2ePtb.decreaseSize ${decSize}; adjust slot or lifecycle-test-markets.`,
        );
        return;
      }

      const m = client.getMarketEntry(base);
      const cooldownMs = await getMarketCooldownMs(client, m.marketId);
      if (cooldownMs > 0n && !tradingCooldownElapsedAfterUpdate(info.updateTimestamp, cooldownMs)) {
        ctx.skip(
          `Trading cooldown not elapsed for ${base} (need ~${cooldownMs}ms after last update). Retry later.`,
        );
        return;
      }

      const usdc = client.config.collaterals.USDC;
      const tx = new Transaction();
      tx.setSender(OWNER);
      tx.setGasBudget(300_000_000);

      await appendBestEffortPythUpdates(tx, base);
      const cfg = client.config;
      const tradingBase = {
        collateralTokenType: usdc.type,
        baseTokenType: m.baseType,
        lpTokenType: cfg.wlpType,
        market: m.marketId,
        accountId,
      };

      const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp1 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      decreasePosition(client, tx, {
        ...tradingBase,
        positionId: existingPositionId,
        size: decSize,
        basePriceResult: bp1,
        collateralPriceResult: cp1,
      });

      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 10, tx);
    }, 120_000);
  }
});

describe("deposit collateral on existing position (single-op PTB simulate, cooldown prechecked)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: deposit collateral only`, async (ctx) => {
      const accountId = await referenceAccountId(ctx);
      if (!accountId) return;

      const found = await findReferenceOpenPosition(accountId, base);
      if (!found) {
        ctx.skip(
          `No open ${base} position for this UserAccount (${accountId.slice(0, 10)}…). ` +
            "Set `test/helpers/e2e-fixed-positions.ts`, or run `pnpm test:integration` / `pnpm e2e:bootstrap-positions`.",
        );
        return;
      }
      const { positionId: existingPositionId, info } = found;

      const m = client.getMarketEntry(base);
      const cooldownMs = await getMarketCooldownMs(client, m.marketId);
      if (cooldownMs > 0n && !tradingCooldownElapsedAfterUpdate(info.updateTimestamp, cooldownMs)) {
        ctx.skip(
          `Trading cooldown not elapsed for ${base} (need ~${cooldownMs}ms after last update). Retry later.`,
        );
        return;
      }

      const usdc = client.config.collaterals.USDC;
      const usdcCoins = await getAccountCoins(client, accountId, usdc.type);
      const funded = usdcCoins
        .filter((c) => BigInt(c.balance) >= E2E_DEPOSIT_COLLATERAL)
        .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));
      if (!funded.length) {
        ctx.skip(`No TTO USDC coin with balance ≥ ${E2E_DEPOSIT_COLLATERAL}.`);
        return;
      }

      const tx = new Transaction();
      tx.setSender(OWNER);
      tx.setGasBudget(300_000_000);

      await appendBestEffortPythUpdates(tx, base);
      const cfg = client.config;
      const tradingBase = {
        collateralTokenType: usdc.type,
        baseTokenType: m.baseType,
        lpTokenType: cfg.wlpType,
        market: m.marketId,
        accountId,
      };

      const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp1 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      depositCollateral(client, tx, {
        ...tradingBase,
        positionId: existingPositionId,
        receivingCoins: [funded[0]!],
        collateralAmount: E2E_DEPOSIT_COLLATERAL,
        basePriceResult: bp1,
        collateralPriceResult: cp1,
      });

      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 11, tx);
    }, 120_000);
  }
});

describe("withdraw collateral on existing position (single-op PTB simulate, cooldown prechecked)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: withdraw collateral only`, async (ctx) => {
      const accountId = await referenceAccountId(ctx);
      if (!accountId) return;

      const found = await findReferenceOpenPosition(accountId, base);
      if (!found) {
        ctx.skip(
          `No open ${base} position for this UserAccount (${accountId.slice(0, 10)}…). ` +
            "Set `test/helpers/e2e-fixed-positions.ts`, or run `pnpm test:integration` / `pnpm e2e:bootstrap-positions`.",
        );
        return;
      }
      const { positionId: existingPositionId, info } = found;

      if (info.collateralAmount <= E2E_WITHDRAW_COLLATERAL) {
        ctx.skip(
          `Position collateral ${info.collateralAmount} ≤ withdraw amount ${E2E_WITHDRAW_COLLATERAL}.`,
        );
        return;
      }

      const m = client.getMarketEntry(base);
      const cooldownMs = await getMarketCooldownMs(client, m.marketId);
      if (cooldownMs > 0n && !tradingCooldownElapsedAfterUpdate(info.updateTimestamp, cooldownMs)) {
        ctx.skip(
          `Trading cooldown not elapsed for ${base} (need ~${cooldownMs}ms after last update). Retry later.`,
        );
        return;
      }

      const usdc = client.config.collaterals.USDC;
      const tx = new Transaction();
      tx.setSender(OWNER);
      tx.setGasBudget(300_000_000);

      await appendBestEffortPythUpdates(tx, base);
      const cfg = client.config;
      const tradingBase = {
        collateralTokenType: usdc.type,
        baseTokenType: m.baseType,
        lpTokenType: cfg.wlpType,
        market: m.marketId,
        accountId,
      };

      const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp1 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      withdrawCollateral(client, tx, {
        ...tradingBase,
        positionId: existingPositionId,
        amount: E2E_WITHDRAW_COLLATERAL,
        basePriceResult: bp1,
        collateralPriceResult: cp1,
      });

      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 10, tx);
    }, 120_000);
  }
});

describe("close existing position (single-op PTB simulate, cooldown prechecked)", () => {
  for (const base of activeLifecycleTestBases()) {
    it(`${base}: close only`, async (ctx) => {
      const accountId = await referenceAccountId(ctx);
      if (!accountId) return;

      const found = await findReferenceOpenPosition(accountId, base);
      if (!found) {
        ctx.skip(
          `No open ${base} position for this UserAccount (${accountId.slice(0, 10)}…). ` +
            "Set `test/helpers/e2e-fixed-positions.ts`, or run `pnpm test:integration` / `pnpm e2e:bootstrap-positions`.",
        );
        return;
      }
      const { positionId: existingPositionId, info } = found;

      const m = client.getMarketEntry(base);
      const cooldownMs = await getMarketCooldownMs(client, m.marketId);
      if (cooldownMs > 0n && !tradingCooldownElapsedAfterUpdate(info.updateTimestamp, cooldownMs)) {
        ctx.skip(
          `Trading cooldown not elapsed for ${base} (need ~${cooldownMs}ms after last update). Retry later.`,
        );
        return;
      }

      const usdc = client.config.collaterals.USDC;
      const tx = new Transaction();
      tx.setSender(OWNER);
      tx.setGasBudget(300_000_000);

      await appendBestEffortPythUpdates(tx, base);
      const cfg = client.config;
      const tradingBase = {
        collateralTokenType: usdc.type,
        baseTokenType: m.baseType,
        lpTokenType: cfg.wlpType,
        market: m.marketId,
        accountId,
      };

      const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
      const cp1 = buildOracleFeed(client, tx, usdc.type, usdc.aggregatorId, usdc.priceInfoId);
      closePosition(client, tx, {
        ...tradingBase,
        positionId: existingPositionId,
        basePriceResult: bp1,
        collateralPriceResult: cp1,
      });

      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 10, tx);
    }, 120_000);
  }
});
