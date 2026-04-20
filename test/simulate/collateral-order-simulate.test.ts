/** E2E: deposit/withdraw collateral, place/cancel order (single-PTB where possible). */
import { Transaction } from "@mysten/sui/transactions";
import {
  getAccountBalance,
  getAccountCoins,
  getAccountsByOwner,
  getMarketSummary,
} from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { PYTH_TESTNET_FEED_IDS, TESTNET_COLLATERALS } from "../../src/constants.ts";
import { cancelOrder, placeOrder } from "../../src/user/order.ts";
import { depositCollateral, openPosition, withdrawCollateral } from "../../src/user/trading.ts";
import { updatePythPrices } from "../../src/utils/pyth.ts";
import { buildOracleFeedForSimulate as buildOracleFeed } from "../helpers/build-oracle-feed-simulate.ts";
import { ensureAtLeastFundedTtoUsdcCoinsForSimulate } from "../helpers/ensure-tto-usdc-coins-for-simulate.ts";
import { INTEGRATION_REFERENCE_WALLET_ADDRESS as OWNER } from "../helpers/integration-reference-wallet.ts";
import { resolveE2eOpenPosition } from "../helpers/resolve-e2e-open-position.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfOracleTransient,
} from "../helpers/simulate-assertions.ts";
import { client } from "../helpers/testnet.ts";

const OPEN_COLLATERAL = 10_000_000n;
const DEP_COLLATERAL = 5_000_000n;
const WITH_AMOUNT = 2_000_000n;
const MIN_USDC_COLLATERAL = OPEN_COLLATERAL + DEP_COLLATERAL;
const OPEN_SIZE = 2_000n;

const ORDER_TRIGGER_PRICE_USD = 60_000;
const ORDER_TRIGGER_PRICE_SCALED = BigInt(Math.round(ORDER_TRIGGER_PRICE_USD * 1e9));
const ORDER_COLLATERAL = 10_000_000n;
const ORDER_SIZE = 2_000n;

async function appendBestEffortPythUpdates(tx: Transaction) {
  const cfg = client.config;
  const m = client.getMarketEntry("BTC");
  const pythCfg = cfg.pythConfig!;
  const baseFeedId = PYTH_TESTNET_FEED_IDS[m.feedKey]!.replace(/^0x/, "");
  const usdcFeedId = PYTH_TESTNET_FEED_IDS[TESTNET_COLLATERALS.USDC.feedKey]!.replace(/^0x/, "");
  try {
    await updatePythPrices(tx, client.grpcClient, pythCfg, [baseFeedId, usdcFeedId]);
  } catch {
    /* Hermes down */
  }
}

async function referenceAccountId(ctx: {
  skip: (reason?: string) => void;
}): Promise<string | null> {
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

function assertSimulateSuccessOrSkipOracleWeak(
  ctx: { skip: (reason?: string) => void },
  result: unknown,
  minCommands: number,
  tx: Transaction,
) {
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

describe("depositCollateral (single-PTB simulate, no keys)", () => {
  it("open → depositCollateral (BTC long)", async (ctx) => {
    const accountId = await referenceAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(
      client,
      accountId,
      client.config.collaterals.USDC.type,
    );
    if (usdcBalance < MIN_USDC_COLLATERAL) {
      ctx.skip(`Insufficient USDC: have ${usdcBalance}, need ${MIN_USDC_COLLATERAL}.`);
      return;
    }

    const m = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, m.marketId, m.baseType);
    const positionId = summary.nextPositionId;

    const cfg = client.config;
    const minPerCoin = OPEN_COLLATERAL >= DEP_COLLATERAL ? OPEN_COLLATERAL : DEP_COLLATERAL;
    const funded = await ensureAtLeastFundedTtoUsdcCoinsForSimulate({
      ctx,
      client,
      accountId,
      usdcType: cfg.collaterals.USDC.type,
      minBalancePerCoin: minPerCoin,
      needCount: 2,
    });
    if (!funded) return;

    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(300_000_000);

    await appendBestEffortPythUpdates(tx);
    const tradingBase = {
      collateralTokenType: cfg.collaterals.USDC.type,
      baseTokenType: m.baseType,
      lpTokenType: cfg.wlpType,
      market: m.marketId,
      accountId,
    };

    const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp1 = buildOracleFeed(
      client,
      tx,
      cfg.collaterals.USDC.type,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    openPosition(client, tx, {
      ...tradingBase,
      receivingCoins: [funded[0]!],
      collateralAmount: OPEN_COLLATERAL,
      isLong: true,
      size: OPEN_SIZE,
      basePriceResult: bp1,
      collateralPriceResult: cp1,
    });

    const bp2 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp2 = buildOracleFeed(
      client,
      tx,
      cfg.collaterals.USDC.type,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    depositCollateral(client, tx, {
      ...tradingBase,
      positionId,
      receivingCoins: [funded[1]!],
      collateralAmount: DEP_COLLATERAL,
      basePriceResult: bp2,
      collateralPriceResult: cp2,
    });

    const result = await client.simulate(tx);
    assertSimulateSuccessOrSkipOracleWeak(ctx, result, 22, tx);
  }, 120_000);
});

describe("withdrawCollateral on existing position (state-dependent, cooldown must have elapsed)", () => {
  it("withdrawCollateral from existing BTC position (simulate)", async (ctx) => {
    const accountId = await referenceAccountId(ctx);
    if (!accountId) return;

    const m = client.getMarketEntry("BTC");
    const resolved = await resolveE2eOpenPosition(client, accountId, "BTC", {
      minCollateralExclusive: WITH_AMOUNT,
    });
    const existingPositionId = resolved?.positionId ?? null;
    if (existingPositionId === null) {
      ctx.skip(
        "No withdrawable BTC position (fixed id / bootstrap / integration). See test/helpers/e2e-fixed-positions.ts.",
      );
      return;
    }

    const cfg = client.config;
    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(200_000_000);

    await appendBestEffortPythUpdates(tx);
    const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp1 = buildOracleFeed(
      client,
      tx,
      cfg.collaterals.USDC.type,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    withdrawCollateral(client, tx, {
      collateralTokenType: cfg.collaterals.USDC.type,
      baseTokenType: m.baseType,
      lpTokenType: cfg.wlpType,
      market: m.marketId,
      accountId,
      positionId: existingPositionId,
      amount: WITH_AMOUNT,
      basePriceResult: bp1,
      collateralPriceResult: cp1,
    });

    const result = await client.simulate(tx);
    assertSimulateSuccessOrSkipOracleWeak(ctx, result, 11, tx);
  }, 60_000);
});

describe("placeOrder / cancelOrder (single-PTB simulate, no keys)", () => {
  it("BTC limit-buy → cancelOrder (single PTB dry-run)", async (ctx) => {
    const accountId = await referenceAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(
      client,
      accountId,
      client.config.collaterals.USDC.type,
    );
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}.`);
      return;
    }

    const m = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, m.marketId, m.baseType);
    const orderId = summary.nextOrderId;

    const cfg = client.config;
    const usdcCoins = await getAccountCoins(client, accountId, cfg.collaterals.USDC.type);
    const funded = usdcCoins
      .filter((c) => BigInt(c.balance) >= ORDER_COLLATERAL)
      .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));
    if (!funded.length) {
      ctx.skip(`No TTO USDC coin with balance ≥ ${ORDER_COLLATERAL}.`);
      return;
    }

    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(300_000_000);

    await appendBestEffortPythUpdates(tx);
    const tradingBase = {
      collateralTokenType: cfg.collaterals.USDC.type,
      baseTokenType: m.baseType,
      lpTokenType: cfg.wlpType,
      market: m.marketId,
      accountId,
    };

    const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp1 = buildOracleFeed(
      client,
      tx,
      cfg.collaterals.USDC.type,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    placeOrder(client, tx, {
      ...tradingBase,
      receivingCoins: [funded[0]!],
      collateralAmount: ORDER_COLLATERAL,
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: ORDER_SIZE,
      triggerPrice: ORDER_TRIGGER_PRICE_SCALED,
      basePriceResult: bp1,
      collateralPriceResult: cp1,
    });

    const bp2 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp2 = buildOracleFeed(
      client,
      tx,
      cfg.collaterals.USDC.type,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    cancelOrder(client, tx, {
      ...tradingBase,
      orderId,
      triggerPrice: ORDER_TRIGGER_PRICE_SCALED,
      orderTypeTag: 255,
      basePriceResult: bp2,
      collateralPriceResult: cp2,
    });

    try {
      const result = await client.simulate(tx);
      assertSimulateSuccessOrSkipOracleWeak(ctx, result, 22, tx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("err_order_not_found") || msg.includes("300")) {
        ctx.skip("orderId prediction stale on shared testnet");
        return;
      }
      throw e;
    }
  }, 120_000);
});
