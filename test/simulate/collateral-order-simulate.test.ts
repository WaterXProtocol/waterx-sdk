/** E2E: deposit/withdraw collateral, place/cancel order (single-PTB where possible). */
import { Transaction } from "@mysten/sui/transactions";
import { getAccountBalance, getAccountCoins, getMarketSummary, PythCache } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { cancelOrder, placeOrder } from "../../src/user/order.ts";
import {
  depositCollateral,
  increasePosition,
  openPosition,
  withdrawCollateral,
} from "../../src/user/trading.ts";
import { updatePythPrices } from "../../src/utils/pyth.ts";
import { buildOracleFeedForSimulate as buildOracleFeed } from "../helpers/e2e/build-oracle-feed-simulate.ts";
import {
  discoverActivePosition,
  discoverFundedProbeWithoutPositionOnBase,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client, PROBE_MIN_ACCOUNT_USDC, pythFeedIdsForE2e } from "../helpers/e2e/e2e-client.ts";
import { resolveDefaultUsdcCoinProbeAttempts } from "../helpers/e2e/e2e-discovery-caps.ts";
import { warmPythHermesForBases } from "../helpers/e2e/e2e-oracle-context.ts";
import { getMarketMinCollateralRawAmount } from "../helpers/e2e/fetch-read-helpers-for-tests.ts";
import { fetchSimulatedCollateralUsdPrice } from "../helpers/e2e/oracle-simulate-multi-asset.ts";
import {
  assertSimulateSuccess,
  assertSimulateSuccessOrSkipOracleAndState,
  simulateWithTransientRetry,
} from "../helpers/e2e/simulate-assertions.ts";
import {
  alignExplicitTradingSize,
  getMarketTradingSizeConstraints,
} from "../helpers/trading/market-trading-size-constraints.ts";
import {
  simulateResizeDerivedSizesForBases,
  simulateResolveOrderDerivedSize,
} from "../helpers/trading/simulate-resize-size.ts";

/** Leverage passed to on-chain `resolve_size` / `resolve_order_size` when deriving scratch sizes. */
const SPOT_RESOLVE_LEVERAGE = 2;
/** Second leg uses a smaller resolve leverage so `increase` size stays below the open leg when possible. */
const INCREASE_LEG_RESOLVE_LEVERAGE = 1;

const ORDER_TRIGGER_PRICE_USD = 60_000;
const ORDER_TRIGGER_PRICE_SCALED = BigInt(Math.round(ORDER_TRIGGER_PRICE_USD * 1e9));

type BtcUsdcChainCollateralSizing = {
  /** Raw USDC per leg: derived from `MarketData.minCollValue` + oracle USDC price + WLP pool decimals. */
  minRawPerLeg: bigint;
  /** On-chain USD floor (Float 1e9) from `view::market_data`. */
  minCollValueUsdScaled: bigint;
};

let btcUsdcSizingMemo: BtcUsdcChainCollateralSizing | null | undefined;

/**
 * Collateral raw amounts for these PTBs follow **mainnet `min_coll_value`** (via
 * {@link getMarketMinCollateralRawAmount}) and a **live USDC oracle** simulate — not hard-coded
 * USDC micros.
 */
async function btcUsdcChainCollateralSizing(): Promise<BtcUsdcChainCollateralSizing | null> {
  if (btcUsdcSizingMemo !== undefined) return btcUsdcSizingMemo;
  try {
    const m = client.getMarketEntry("BTC");
    const { scaled: usdcScaled } = await fetchSimulatedCollateralUsdPrice(client, "USDC");
    const got = await getMarketMinCollateralRawAmount(client, {
      marketId: m.marketId,
      baseType: m.baseType,
      collateral: "USDC",
      collateralUsdPerTokenScaled: usdcScaled,
    });
    if (got.minCollValueUsdScaled <= 0n || got.minCollateralRaw <= 0n) {
      btcUsdcSizingMemo = null;
      return null;
    }
    btcUsdcSizingMemo = {
      minRawPerLeg: got.minCollateralRaw,
      minCollValueUsdScaled: got.minCollValueUsdScaled,
    };
    return btcUsdcSizingMemo;
  } catch {
    btcUsdcSizingMemo = null;
    return null;
  }
}

/**
 * Spot notionals from on-chain `trading::resolve_size` (same Hermes+aggregate path as tx-builders),
 * then `min_size` / `lot_size` alignment from published Market JSON.
 */
async function btcUsdcResolvedSpotSize(
  leg: bigint,
  leverage: number,
  pythCache: PythCache,
): Promise<bigint | null> {
  try {
    const sizes = await simulateResizeDerivedSizesForBases(
      client,
      ["BTC"],
      { collateralAmount: leg, leverage, collateral: "USDC" },
      { pythCache },
    );
    const raw = sizes.BTC;
    if (raw == null || raw <= 0n) return null;
    const m = client.getMarketEntry("BTC");
    const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, m.marketId);
    return alignExplicitTradingSize(raw, minSize, lotSize);
  } catch {
    return null;
  }
}

async function appendBestEffortPythUpdates(tx: Transaction) {
  const cfg = client.config;
  const m = client.getMarketEntry("BTC");
  const pythCfg = cfg.pythConfig!;
  const feeds = pythFeedIdsForE2e();
  const baseFeedId = feeds[m.feedKey]!.replace(/^0x/, "");
  const usdcFeedId = feeds[cfg.collaterals.USDC.feedKey]!.replace(/^0x/, "");
  try {
    await updatePythPrices(tx, client.grpcClient, pythCfg, [baseFeedId, usdcFeedId]);
  } catch {
    /* Hermes down */
  }
}

describe("depositCollateral (single-PTB simulate, no keys)", () => {
  it("open → depositCollateral (BTC long)", async (ctx) => {
    const sz = await btcUsdcChainCollateralSizing();
    if (!sz) {
      ctx.skip(
        "Could not derive BTC/USDC collateral sizing from chain (min_coll_value + USDC oracle + WLP pool decimals).",
      );
      return;
    }
    const leg = sz.minRawPerLeg;
    const minAccountUsdc = leg * 2n;
    const maxCoinProbes = resolveDefaultUsdcCoinProbeAttempts();
    const hit = await discoverFundedProbeWithoutPositionOnBase(client, "BTC", {
      minAccountUsdcBalance: minAccountUsdc,
      minUsdcCoinObjects: 2,
      minBalancePerUsdcCoin: leg,
      maxUsdcCoinProbeAttempts: maxCoinProbes,
    });
    if (!hit) {
      ctx.skip(
        `No funded account on a non-BTC lifecycle market (USDC ≥ ${minAccountUsdc}, ≥2 TTO coins ≥ ${leg}, max ${maxCoinProbes} probes/market) — required so compound BTC open+deposit uses a fresh nextPositionId.`,
      );
      return;
    }
    const { accountObjectAddress: accountId, ownerAddress: owner } = hit;

    const m = client.getMarketEntry("BTC");
    const pythCache = new PythCache();
    await warmPythHermesForBases(client, pythCache, ["BTC"]);
    const openSize = await btcUsdcResolvedSpotSize(leg, SPOT_RESOLVE_LEVERAGE, pythCache);
    if (!openSize || openSize <= 0n) {
      ctx.skip("Could not resolve BTC open size from on-chain resolve_size (probe simulate).");
      return;
    }

    const summary = await getMarketSummary(client, m.marketId, m.baseType);
    const positionId = summary.nextPositionId;

    const cfg = client.config;
    const usdcType = cfg.collaterals.USDC.type;
    const usdcCoins = await getAccountCoins(client, accountId, usdcType);
    const funded = usdcCoins
      .filter((c) => BigInt(c.balance) >= leg)
      .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));

    const tx = new Transaction();
    tx.setSender(owner);
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
      collateralAmount: leg,
      isLong: true,
      size: openSize,
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
      collateralAmount: leg,
      basePriceResult: bp2,
      collateralPriceResult: cp2,
    });

    const result = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, result, 22, tx, {
      allowStateDependentSkip: true,
      stateDependentLabel: "BTC open+depositCollateral",
    });
  }, 120_000);

  it("open → increasePosition (BTC long, single PTB)", async (ctx) => {
    const sz = await btcUsdcChainCollateralSizing();
    if (!sz) {
      ctx.skip(
        "Could not derive BTC/USDC collateral sizing from chain (min_coll_value + USDC oracle + WLP pool decimals).",
      );
      return;
    }
    const leg = sz.minRawPerLeg;
    const minProbeAccount = PROBE_MIN_ACCOUNT_USDC > leg * 2n ? PROBE_MIN_ACCOUNT_USDC : leg * 2n;

    const maxCoinProbes = resolveDefaultUsdcCoinProbeAttempts();
    const hit = await discoverFundedProbeWithoutPositionOnBase(client, "BTC", {
      minAccountUsdcBalance: minProbeAccount,
      minUsdcCoinObjects: 2,
      minBalancePerUsdcCoin: leg,
      maxUsdcCoinProbeAttempts: maxCoinProbes,
    });
    if (!hit) {
      ctx.skip(
        `No funded account on a non-BTC lifecycle market (USDC ≥ ${minProbeAccount}, ≥2 TTO coins ≥ ${leg}, max ${maxCoinProbes} probes/market) — cannot fund compound BTC open+increase with a fresh nextPositionId.`,
      );
      return;
    }
    const { accountObjectAddress: accountId, ownerAddress: owner } = hit;

    const m = client.getMarketEntry("BTC");
    const pythCache = new PythCache();
    await warmPythHermesForBases(client, pythCache, ["BTC"]);
    const openSize = await btcUsdcResolvedSpotSize(leg, SPOT_RESOLVE_LEVERAGE, pythCache);
    let incSize = await btcUsdcResolvedSpotSize(leg, INCREASE_LEG_RESOLVE_LEVERAGE, pythCache);
    if (!openSize || !incSize || openSize <= 0n || incSize <= 0n) {
      ctx.skip(
        "Could not resolve BTC open/increase sizes from on-chain resolve_size (probe simulate).",
      );
      return;
    }
    const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, m.marketId);
    if (incSize >= openSize) {
      const half = alignExplicitTradingSize(openSize / 2n, minSize, lotSize);
      if (half && half > 0n && half < openSize) incSize = half;
    }
    if (incSize >= openSize && openSize > minSize) {
      const underOpen = alignExplicitTradingSize(openSize - minSize, minSize, lotSize);
      if (underOpen && underOpen > 0n && underOpen < openSize) incSize = underOpen;
    }
    if (incSize >= openSize || incSize <= 0n) {
      ctx.skip(
        "Could not derive increase size strictly below open size after alignment (avoid err_invalid_size on compound PTB).",
      );
      return;
    }

    const summary = await getMarketSummary(client, m.marketId, m.baseType);
    const positionId = summary.nextPositionId;

    const cfg = client.config;
    const usdcType = cfg.collaterals.USDC.type;
    const usdcCoins = await getAccountCoins(client, accountId, usdcType);
    const funded = usdcCoins
      .filter((c) => BigInt(c.balance) >= leg)
      .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));

    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(300_000_000);

    await appendBestEffortPythUpdates(tx);

    const tradingBase = {
      collateralTokenType: usdcType,
      baseTokenType: m.baseType,
      lpTokenType: cfg.wlpType,
      market: m.marketId,
      accountId,
    };

    const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp1 = buildOracleFeed(
      client,
      tx,
      usdcType,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    openPosition(client, tx, {
      ...tradingBase,
      receivingCoins: [funded[0]!],
      collateralAmount: leg,
      isLong: true,
      size: openSize,
      basePriceResult: bp1,
      collateralPriceResult: cp1,
    });

    const bp2 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp2 = buildOracleFeed(
      client,
      tx,
      usdcType,
      cfg.collaterals.USDC.aggregatorId,
      cfg.collaterals.USDC.priceInfoId,
    );
    increasePosition(client, tx, {
      ...tradingBase,
      positionId,
      receivingCoins: [funded[1]!],
      collateralAmount: leg,
      size: incSize,
      basePriceResult: bp2,
      collateralPriceResult: cp2,
    });

    const result = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, result, 22, tx, {
      allowStateDependentSkip: true,
      stateDependentLabel: "BTC open+increase",
    });
  }, 120_000);
});

describe("withdrawCollateral on existing position (state-dependent, cooldown must have elapsed)", () => {
  it("withdrawCollateral from existing BTC position (simulate)", async (ctx) => {
    const sz = await btcUsdcChainCollateralSizing();
    if (!sz) {
      ctx.skip(
        "Could not derive BTC/USDC collateral sizing from chain (min_coll_value + USDC oracle + WLP pool decimals).",
      );
      return;
    }
    const withdrawCap = sz.minRawPerLeg;
    const hit = await discoverActivePosition(client, "BTC", {
      minCollateralAmount: withdrawCap + 1n,
    });
    if (!hit) {
      ctx.skip("No BTC position with enough collateral for withdraw simulate");
      return;
    }

    const m = client.getMarketEntry("BTC");
    const cfg = client.config;
    const collCfg = cfg.collaterals[hit.collateral];
    const tx = new Transaction();
    tx.setSender(hit.ownerAddress);
    tx.setGasBudget(200_000_000);

    await appendBestEffortPythUpdates(tx);
    const bp1 = buildOracleFeed(client, tx, m.baseType, m.aggregatorId, m.priceInfoId);
    const cp1 = buildOracleFeed(
      client,
      tx,
      collCfg.type,
      collCfg.aggregatorId,
      collCfg.priceInfoId,
    );
    // Cap withdraw amount at 1% of the discovered position's collateral to
    // avoid crossing the leverage cap on positions sitting near max leverage.
    const amount =
      hit.position.collateralAmount / 100n > 0n
        ? hit.position.collateralAmount / 100n < withdrawCap
          ? hit.position.collateralAmount / 100n
          : withdrawCap
        : 1n;
    withdrawCollateral(client, tx, {
      collateralTokenType: collCfg.type,
      baseTokenType: m.baseType,
      lpTokenType: cfg.wlpType,
      market: m.marketId,
      accountId: hit.accountObjectAddress,
      positionId: hit.positionId,
      amount,
      basePriceResult: bp1,
      collateralPriceResult: cp1,
    });

    const result = await simulateWithTransientRetry(() => client.simulate(tx));
    assertSimulateSuccessOrSkipOracleAndState(ctx, result, 11, tx, {
      allowStateDependentSkip: true,
      stateDependentLabel: "BTC withdraw",
    });
  }, 60_000);
});

describe("placeOrder / cancelOrder (single-PTB simulate, no keys)", () => {
  it("BTC limit-buy → cancelOrder (single PTB dry-run)", async (ctx) => {
    const sz = await btcUsdcChainCollateralSizing();
    if (!sz) {
      ctx.skip(
        "Could not derive BTC/USDC collateral sizing from chain (min_coll_value + USDC oracle + WLP pool decimals).",
      );
      return;
    }
    const orderCollateral = sz.minRawPerLeg;

    const hit = await discoverFundedProbeWithoutPositionOnBase(client, "BTC", {
      minAccountUsdcBalance: orderCollateral,
      maxPages: 24,
      requireCooldownElapsed: false,
    });
    if (!hit) {
      ctx.skip(
        `No funded account on a non-BTC lifecycle market (USDC ≥ ${orderCollateral}) for BTC limit-order PTB — avoids err_invalid_size when existing BTC margin skews collateral vs resolve_order_size.`,
      );
      return;
    }
    const accountId = hit.accountObjectAddress;
    const owner = hit.ownerAddress;

    const usdcBalance = await getAccountBalance(
      client,
      accountId,
      client.config.collaterals.USDC.type,
    );
    if (usdcBalance < orderCollateral) {
      ctx.skip(
        `Insufficient USDC: have ${usdcBalance}, need ≥ min_coll_value-derived ${orderCollateral}.`,
      );
      return;
    }

    const m = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, m.marketId, m.baseType);
    const orderId = summary.nextOrderId;

    const cfg = client.config;
    const usdcCoins = await getAccountCoins(client, accountId, cfg.collaterals.USDC.type);
    const funded = usdcCoins
      .filter((c) => BigInt(c.balance) >= orderCollateral)
      .map((c) => ({ objectId: c.objectId, version: BigInt(c.version), digest: c.digest }));
    if (!funded.length) {
      ctx.skip(`No TTO USDC coin with balance ≥ min_coll_value-derived ${orderCollateral}.`);
      return;
    }

    const pythCache = new PythCache();
    await warmPythHermesForBases(client, pythCache, ["BTC"]);
    let orderSize: bigint;
    try {
      const raw = await simulateResolveOrderDerivedSize(
        client,
        "BTC",
        {
          collateralAmount: orderCollateral,
          leverage: SPOT_RESOLVE_LEVERAGE,
          triggerPriceScaled: ORDER_TRIGGER_PRICE_SCALED,
          collateral: "USDC",
        },
        { pythCache },
      );
      const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, m.marketId);
      const aligned = alignExplicitTradingSize(raw, minSize, lotSize);
      orderSize = aligned ?? raw;
    } catch {
      ctx.skip(
        "Could not resolve BTC order size from on-chain resolve_order_size (probe simulate).",
      );
      return;
    }
    if (orderSize <= 0n) {
      ctx.skip(
        "On-chain resolve_order_size returned non-positive size for this trigger/collateral.",
      );
      return;
    }

    const tx = new Transaction();
    tx.setSender(owner);
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
      collateralAmount: orderCollateral,
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: orderSize,
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
      const result = await simulateWithTransientRetry(() => client.simulate(tx));
      assertSimulateSuccessOrSkipOracleAndState(ctx, result, 22, tx, {
        allowStateDependentSkip: true,
        stateDependentLabel: "BTC placeOrder+cancelOrder",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("err_order_not_found") || msg.includes("300")) {
        ctx.skip("orderId prediction stale on shared chain");
        return;
      }
      throw e;
    }
  }, 120_000);
});
