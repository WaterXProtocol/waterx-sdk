/**
 * High-level transaction builders for WaterX Perp.
 *
 * These functions return a ready-to-sign Transaction — the caller only needs
 * to provide simple, human-readable parameters (accountId, base asset,
 * direction, collateral amount, etc.).  All oracle, aggregator, token-type,
 * and Pyth plumbing is handled internally.
 *
 * Usage:
 *   const client = WaterXClient.testnet();
 *   const tx = await buildOpenPositionTx(client, {
 *       accountId: "0x...",
 *       base: "BTC",
 *       isLong: true,
 *       leverage: 10,
 *       collateralAmount: 1_000_000_000, // 1000 USDC (6 decimals)
 *   });
 *   // sign & execute tx
 */

import { coinWithBalance, Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "./client.ts";
import {
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  type BaseAsset,
  type CollateralAsset,
  type Network,
} from "./constants.ts";
import { getAccountCoins } from "./fetch.ts";
import { request as accountRequestCall } from "./generated/bucket_v2_framework/account.ts";
import { aggregate as aggregateCall } from "./generated/bucket_v2_oracle/aggregator.ts";
import { _new as collectorNewCall } from "./generated/bucket_v2_oracle/collector.ts";
import { request as pythSponsorRequestCall } from "./generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";
import { updateTokenValue as updateTokenValueCall } from "./generated/waterx_perp/lp_pool.ts";
import {
  batchDestroyResponse as batchDestroyResponseCall,
  batchExecute as batchExecuteCall,
  batchLiquidateRequest as batchLiquidateRequestCall,
  resolveOrderSize as resolveOrderSizeCall,
  resolveSize as resolveSizeCall,
} from "./generated/waterx_perp/trading.ts";
import { receiveCoinWithAmountTo as receiveCoinWithAmountToCall } from "./generated/waterx_perp/user_account.ts";
import {
  cancelOrder,
  cancelRedeemWlp,
  claimRewardDistributor,
  closePosition,
  decreasePosition,
  depositCollateral,
  increasePosition,
  liquidate,
  matchOrders,
  mintWlp,
  mintWlpCoin,
  openPosition,
  openPositionByManager,
  placeOrder,
  redeemRewardDistributorCoin,
  requestRedeemWlp,
  settleRedeemWlp,
  stakeRewardDistributor,
  transferToAccount,
  unstakeRewardDistributor,
  updateFundingRate,
  withdrawCollateral,
} from "./user/index.ts";
import { feedPythRule, PythCache, updatePythPrices } from "./utils/pyth.ts";
import type { CoinForReceiving } from "./utils/receiving.ts";
import { buildReceivingVector } from "./utils/receiving.ts";

// ============================================================================
// Shared Helpers
// ============================================================================

export type { BaseAsset, CollateralAsset } from "./constants.ts";

// TODO(mainnet): verify PYTH_PRICE_FEED_IDS entries cover all BaseAsset + CollateralAsset before mainnet deploy
const PYTH_FEED_IDS_BY_NETWORK: Record<Network, Record<string, string>> = {
  TESTNET: PYTH_TESTNET_FEED_IDS,
  MAINNET: PYTH_PRICE_FEED_IDS,
};

/** Resolve base asset → token type, market, aggregator, priceInfo, feed. */
function resolveMarket(client: WaterXClient, base: BaseAsset) {
  const entry = client.getMarketEntry(base);
  const feedIds = PYTH_FEED_IDS_BY_NETWORK[client.config.network];
  return {
    baseType: entry.baseType,
    market: entry.marketId,
    baseAgg: entry.aggregatorId,
    basePriceInfo: entry.priceInfoId,
    baseFeed: feedIds[entry.feedKey]!.replace(/^0x/, ""),
  };
}

/** Resolve collateral asset → type, aggregator, priceInfo, pyth feed. */
function resolveCollateral(client: WaterXClient, collateral: CollateralAsset = "USDC") {
  const entry = client.getCollateral(collateral);
  const feedIds = PYTH_FEED_IDS_BY_NETWORK[client.config.network];
  const pythFeed = feedIds[entry.feedKey]?.replace(/^0x/, "");
  return { ...entry, pythFeed };
}

/** Global PythCache instance — reused across calls. */
const globalPythCache = new PythCache();

/**
 * Creates a PriceCollector, feeds all configured sources (Pyth + Supra when
 * `WaterXConfig` includes Supra IDs), and aggregates into a `PriceResult`.
 * Always feeds Pyth (on-chain price may still be fresh); the contract filters staleness.
 *
 * Use this for custom PTBs that mirror `build*Tx` oracle wiring. For Hermes refresh,
 * call `updatePythPrices` on the same `Transaction` first (best-effort).
 */
export function buildOracleFeed(
  client: WaterXClient,
  tx: Transaction,
  tokenType: string,
  aggregatorId: string,
  priceInfoObjectId: string,
): TransactionArgument {
  const cfg = client.config;
  const oraclePkg = cfg.bucketOraclePackageId!;

  const [collector] = collectorNewCall({
    package: oraclePkg,
    typeArguments: [tokenType],
  })(tx);

  feedPythRule(tx, collector, {
    pythRulePackageId: cfg.pythRulePackageId,
    pythRuleConfigId: cfg.pythRuleConfigId,
    pythStateId: cfg.pythConfig!.pythStateId,
    tokenType,
    priceInfoObjectId,
  });

  const [priceResult] = aggregateCall({
    package: oraclePkg,
    arguments: { self: aggregatorId, collector },
    typeArguments: [tokenType],
  })(tx);

  return priceResult;
}

export { reimburseSponsorFund } from "./utils/sponsor.ts";

/**
 * Computes position size on-chain using `trading::resolve_size`.
 * Uses live oracle base price + collateral price for accurate sizing
 * with non-dollar-pegged collateral. Returns the size as a TransactionArgument (u128).
 */
export function buildResolveSize(
  client: WaterXClient,
  tx: Transaction,
  params: {
    base: BaseAsset;
    collateral?: CollateralAsset;
    priceResult: TransactionArgument;
    collateralPriceResult: TransactionArgument;
    collateralAmount: bigint | number;
    /** Leverage multiplier (e.g. 5 = 5x) */
    leverage: number;
  },
): TransactionArgument {
  const m = resolveMarket(client, params.base);
  const cfg = client.config;
  const coll = params.collateral ?? "USDC";
  const collateral = client.getCollateral(coll);

  const [size] = resolveSizeCall({
    package: cfg.packageId,
    arguments: {
      pool: cfg.wlpPool,
      priceResult: params.priceResult,
      collateralPriceResult: params.collateralPriceResult,
      collateralAmount: BigInt(params.collateralAmount),
      leverageBps: BigInt(Math.round(params.leverage * 10_000)),
    },
    typeArguments: [collateral.type, m.baseType, cfg.wlpType],
  })(tx);

  return size;
}

/**
 * Computes order size on-chain using `trading::resolve_order_size`.
 * Uses the trigger price instead of the base oracle price, so the derived
 * size matches the intended leverage at the order's fill price.
 */
export function buildResolveOrderSize(
  client: WaterXClient,
  tx: Transaction,
  params: {
    collateral?: CollateralAsset;
    collateralPriceResult: TransactionArgument;
    /** Trigger price as 1e9-scaled bigint (same as `triggerPrice` in place order). */
    triggerPrice: bigint;
    collateralAmount: bigint | number;
    /** Leverage multiplier (e.g. 5 = 5x) */
    leverage: number;
  },
): TransactionArgument {
  const cfg = client.config;
  const coll = params.collateral ?? "USDC";
  const collateral = client.getCollateral(coll);

  const [size] = resolveOrderSizeCall({
    package: cfg.packageId,
    arguments: {
      pool: cfg.wlpPool,
      collateralPriceResult: params.collateralPriceResult,
      triggerPrice: params.triggerPrice,
      collateralAmount: BigInt(params.collateralAmount),
      leverageBps: BigInt(Math.round(params.leverage * 10_000)),
    },
    typeArguments: [collateral.type, cfg.wlpType],
  })(tx);

  return size;
}

/**
 * Adds oracle feed calls to tx for base + collateral tokens.
 *
 * By default (`selfPayPyth` unset), creates a `PythSponsor::Fund` to pay Pyth
 * update fees (no split from `tx.gas`). The returned `sponsorFund` must be
 * consumed by calling `reimburseSponsorFund()` with a `TradingRequest`.
 *
 * When `selfPayPyth`, falls back to the legacy path (Hermes update only
 * when `updatePythPrice: true`, paid from `tx.gas`).
 */
export async function addPriceFeeds(
  client: WaterXClient,
  tx: Transaction,
  base: BaseAsset,
  collateral: CollateralAsset = "USDC",
  cache?: PythCache,
  updatePythPrice?: boolean,
  selfPayPyth?: boolean,
) {
  const m = resolveMarket(client, base);
  const c = resolveCollateral(client, collateral);
  const cfg = client.config;

  const useSponsor = !selfPayPyth && !!cfg.pythSponsorRulePackageId && !!cfg.pythSponsorId;

  let sponsorFund: TransactionArgument | undefined;

  if (useSponsor) {
    // Create sponsor Fund — pays for Pyth update fees
    const [fund] = pythSponsorRequestCall({
      package: cfg.pythSponsorRulePackageId!,
      arguments: { self: cfg.pythSponsorId! },
    })(tx);
    sponsorFund = fund;

    const pythCfg = cfg.pythConfig!;
    const pythFeeds = new Set([m.baseFeed]);
    if (c.pythFeed) pythFeeds.add(c.pythFeed);

    try {
      await updatePythPrices(
        tx,
        client.grpcClient,
        pythCfg,
        [...pythFeeds],
        cache ?? globalPythCache,
        { fund: sponsorFund, packageId: cfg.pythSponsorRulePackageId! },
      );
    } catch {
      // Hermes down — Pyth on-chain price still fed; contract tolerance handles staleness
    }
  } else if (updatePythPrice) {
    const pythCfg = cfg.pythConfig!;
    const pythFeeds = new Set([m.baseFeed]);
    if (c.pythFeed) pythFeeds.add(c.pythFeed);

    try {
      await updatePythPrices(
        tx,
        client.grpcClient,
        pythCfg,
        [...pythFeeds],
        cache ?? globalPythCache,
      );
    } catch {
      // Hermes down — Pyth on-chain price still fed; contract tolerance handles staleness
    }
  }

  const basePR = buildOracleFeed(client, tx, m.baseType, m.baseAgg, m.basePriceInfo);
  const collPR = buildOracleFeed(client, tx, c.type, c.aggregatorId, c.priceInfoId);

  return {
    basePriceResult: basePR,
    collateralPriceResult: collPR,
    market: m,
    collateral: c,
    sponsorFund,
  };
}

/**
 * Refreshes `last_price_refresh_timestamp` on every pool token by calling
 * `lp_pool::update_token_value` for each configured collateral. This is
 * required before `mint_wlp` / `settle_redeem` because
 * `assert_prices_fresh` checks ALL pool tokens (not just the one being
 * deposited/redeemed). Returns the `PriceResult` for `depositCollateral`
 * so the caller can reuse it for the subsequent `mint_wlp` / `settle_redeem`.
 *
 * Hermes Pyth refresh is best-effort; if it fails, the on-chain Pyth price
 * is still fed (Pyth tolerance check in pyth_rule handles staleness).
 */
export async function refreshAllPoolTokensAndGetDepositPriceResult(
  client: WaterXClient,
  tx: Transaction,
  depositCollateral: CollateralAsset,
  cache?: PythCache,
  updatePythPrice?: boolean,
): Promise<TransactionArgument> {
  const cfg = client.config;
  const pythCfg = cfg.pythConfig;
  const feedIds = PYTH_FEED_IDS_BY_NETWORK[cfg.network];
  let depositPriceResult: TransactionArgument | undefined;

  for (const [asset, coll] of Object.entries(cfg.collaterals)) {
    if (updatePythPrice && pythCfg && coll.feedKey) {
      const feedId = feedIds[coll.feedKey];
      if (feedId) {
        try {
          await updatePythPrices(
            tx,
            client.grpcClient,
            pythCfg,
            [feedId.replace(/^0x/, "")],
            cache ?? globalPythCache,
          );
        } catch {
          // Hermes down — Pyth on-chain price still fed
        }
      }
    }

    const priceResult = buildOracleFeed(client, tx, coll.type, coll.aggregatorId, coll.priceInfoId);

    // Refresh this token pool's `last_price_refresh_timestamp` so the mint/redeem
    // call's `assert_prices_fresh` passes.
    updateTokenValueCall({
      package: cfg.packageId,
      arguments: { pool: cfg.wlpPool, priceResult },
      typeArguments: [cfg.wlpType, coll.type],
    })(tx);

    if (asset === depositCollateral) {
      depositPriceResult = priceResult;
    }
  }

  if (!depositPriceResult) {
    throw new Error(
      `Deposit collateral ${depositCollateral} not found in client.config.collaterals`,
    );
  }
  return depositPriceResult;
}

/**
 * Resolves position size from params — 2 modes:
 * 1. Explicit `size` (bigint/number/TransactionArgument) — pass through
 * 2. `leverage` — on-chain `resolve_size()` using live oracle price
 */
function resolveSizeFromParams(
  client: WaterXClient,
  tx: Transaction,
  params: {
    base: BaseAsset;
    collateral?: CollateralAsset;
    collateralAmount: bigint | number;
    size?: bigint | number | TransactionArgument;
    leverage?: number;
  },
  basePriceResult: TransactionArgument,
  collateralPriceResult: TransactionArgument,
): bigint | number | TransactionArgument {
  if (params.size !== undefined) return params.size;
  if (params.leverage !== undefined) {
    return buildResolveSize(client, tx, {
      base: params.base,
      collateral: params.collateral,
      priceResult: basePriceResult,
      collateralPriceResult,
      collateralAmount: params.collateralAmount,
      leverage: params.leverage,
    });
  }
  throw new Error("Either `size` or `leverage` must be provided");
}

/**
 * Resolves order size on-chain using `trading::resolve_order_size`.
 * Uses the trigger price (instead of oracle price) so effective leverage
 * at fill matches the user's intent.
 */
function resolveOrderSizeFromParams(
  client: WaterXClient,
  tx: Transaction,
  params: {
    collateral?: CollateralAsset;
    collateralAmount: bigint | number;
    size?: bigint | number;
    leverage?: number;
    triggerPrice: bigint;
  },
  collateralPriceResult: TransactionArgument,
): bigint | number | TransactionArgument {
  if (params.size !== undefined) return params.size;
  if (params.leverage !== undefined) {
    return buildResolveOrderSize(client, tx, {
      collateral: params.collateral,
      collateralPriceResult,
      triggerPrice: params.triggerPrice,
      collateralAmount: params.collateralAmount,
      leverage: params.leverage,
    });
  }
  throw new Error("Either `size` or `leverage` must be provided");
}

/**
 * Fetch collateral coins owned by a UserAccount as CoinForReceiving[].
 */
async function fetchAccountCoins(
  client: WaterXClient,
  accountId: string,
  collateral: CollateralAsset = "USDC",
): Promise<CoinForReceiving[]> {
  const coinType = client.getCollateral(collateral).type;
  const coins = await getAccountCoins(client, accountId, coinType);
  if (!coins.length) throw new Error(`No ${collateral} coins found in account ${accountId}`);
  return coins.map((c) => ({
    objectId: c.objectId,
    version: c.version,
    digest: c.digest,
  }));
}

// ============================================================================
// Open Position
// ============================================================================

export interface BuildOpenPositionParams {
  accountId: string;
  base: BaseAsset;
  /** Collateral token to use (default: "USDC") */
  collateral?: CollateralAsset;
  isLong: boolean;
  collateralAmount: bigint | number;
  /** Leverage multiplier (e.g. 5 = 5x). When `size` is omitted, computes size on-chain via `resolve_size`. */
  leverage?: number;
  size?: bigint | number | TransactionArgument;
  acceptablePrice?: bigint;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
  /** Take-profit order — placed as reduce-only limit order linked to the new position. */
  takeProfit?: { triggerPrice: bigint; size?: bigint | number };
  /** Stop-loss order — placed as reduce-only stop order linked to the new position. */
  stopLoss?: { triggerPrice: bigint; size?: bigint | number };
}

export async function buildOpenPositionTx(
  client: WaterXClient,
  params: BuildOpenPositionParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );

  const size = resolveSizeFromParams(
    client,
    tx,
    { ...params, collateral: coll },
    basePriceResult,
    collateralPriceResult,
  );

  const receivingCoins = await fetchAccountCoins(client, params.accountId, coll);
  const cfg = client.config;

  openPosition(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    receivingCoins,
    collateralAmount: params.collateralAmount,
    isLong: params.isLong,
    size,
    acceptablePrice: params.acceptablePrice,
    basePriceResult,
    collateralPriceResult,
    takeProfit: params.takeProfit,
    stopLoss: params.stopLoss,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Open Position By Manager (Keeper)
// ============================================================================

/**
 * Params for {@link buildOpenPositionByManagerTx}.
 *
 * Unlike {@link BuildOpenPositionParams}, collateral is supplied as an
 * **external coin** (not received from a UserAccount via TTO).  The contract
 * entry point `open_position_request_by_keeper` consumes the entire coin as
 * collateral — there is no partial-amount split.
 *
 * "Manager" in the SDK maps to the on-chain `keeper` role
 * (`trading::open_position_request_by_keeper`).  The sender must be a
 * registered keeper in `GlobalConfig`.
 */
export interface BuildOpenPositionByManagerParams {
  /** The user account address the position will belong to */
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  isLong: boolean;
  /**
   * The collateral coin (TransactionArgument or string object ID).
   * The entire coin value is consumed as collateral by the contract —
   * ensure the coin's balance matches the intended collateral amount.
   */
  collateralCoin: string | TransactionArgument;
  /**
   * Collateral amount in raw units (e.g. 6-decimal USDC).
   * Only used for leverage-based size calculation when `size` is omitted.
   * **Must match the actual coin balance** for the derived size to be correct.
   */
  collateralAmount?: bigint | number;
  leverage?: number;
  size?: bigint | number;
  acceptablePrice?: bigint;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildOpenPositionByManagerTx(
  client: WaterXClient,
  params: BuildOpenPositionByManagerParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );

  const size = resolveSizeFromParams(
    client,
    tx,
    {
      ...params,
      collateral: coll,
      collateralAmount: params.collateralAmount ?? 0,
    },
    basePriceResult,
    collateralPriceResult,
  );

  const cfg = client.config;

  openPositionByManager(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    collateralCoin: params.collateralCoin,
    isLong: params.isLong,
    size,
    acceptablePrice: params.acceptablePrice,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Close Position
// ============================================================================

export interface BuildClosePositionParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  positionId: number;
  acceptablePrice?: bigint;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildClosePositionTx(
  client: WaterXClient,
  params: BuildClosePositionParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      params.collateral,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const cfg = client.config;

  closePosition(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    positionId: params.positionId,
    acceptablePrice: params.acceptablePrice,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Deposit Collateral
// ============================================================================

export interface BuildDepositCollateralParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  positionId: number;
  collateralAmount: bigint | number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildDepositCollateralTx(
  client: WaterXClient,
  params: BuildDepositCollateralParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const receivingCoins = await fetchAccountCoins(client, params.accountId, coll);
  const cfg = client.config;

  depositCollateral(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    positionId: params.positionId,
    receivingCoins,
    collateralAmount: params.collateralAmount,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Withdraw Collateral
// ============================================================================

export interface BuildWithdrawCollateralParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  positionId: number;
  amount: bigint | number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildWithdrawCollateralTx(
  client: WaterXClient,
  params: BuildWithdrawCollateralParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      params.collateral,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const cfg = client.config;

  withdrawCollateral(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    positionId: params.positionId,
    amount: params.amount,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Place Order
// ============================================================================

export interface BuildPlaceOrderParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  isLong: boolean;
  isStopOrder?: boolean;
  reduceOnly?: boolean;
  collateralAmount: bigint | number;
  leverage?: number;
  size?: bigint | number;
  /** Trigger price in USD (e.g. 65000 for $65,000). Auto-scaled to 10^9. */
  triggerPrice: bigint;
  /** Link to an existing position ID for reduce-only or position-linked orders. */
  linkedPositionId?: bigint | number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildPlaceOrderTx(
  client: WaterXClient,
  params: BuildPlaceOrderParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const receivingCoins = !params.collateralAmount
    ? []
    : await fetchAccountCoins(client, params.accountId, coll);
  const cfg = client.config;

  const size = resolveOrderSizeFromParams(
    client,
    tx,
    { ...params, collateral: coll },
    collateralPriceResult,
  );

  placeOrder(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    receivingCoins,
    collateralAmount: params.collateralAmount,
    isLong: params.isLong,
    isStopOrder: params.isStopOrder ?? false,
    reduceOnly: params.reduceOnly ?? false,
    size,
    triggerPrice: params.triggerPrice,
    linkedPositionId: params.linkedPositionId,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Place TP/SL on Existing Position
// ============================================================================

export interface BuildPlaceTpSlParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  /** The position's direction (true = long position). */
  positionIsLong: boolean;
  /** Position ID to link the order to. */
  positionId: bigint | number;
  /** Size of the TP/SL order in raw base units. If omitted, uses `positionSize`. */
  size?: bigint | number;
  /** Current position size in raw base units. Required when `size` is omitted (full close). */
  positionSize?: bigint | number;
  /** Trigger price in USD (e.g. 65000). Auto-scaled to 10^9. */
  triggerPrice: bigint;
  /** `'tp'` for take-profit (limit), `'sl'` for stop-loss (stop). */
  type: "tp" | "sl";
  gasBudget?: number;
  pythCache?: PythCache;
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  tx?: Transaction;
}

/**
 * Place a take-profit or stop-loss order linked to an existing position.
 * Automatically sets `isLong` to opposite of position direction,
 * `reduceOnly = true`, and `isStopOrder` based on TP/SL type.
 */
export async function buildPlaceTpSlTx(
  client: WaterXClient,
  params: BuildPlaceTpSlParams,
): Promise<Transaction> {
  const orderSize = params.size ?? params.positionSize;
  if (orderSize == null) {
    throw new Error("buildPlaceTpSlTx: provide `size` or `positionSize`");
  }

  return buildPlaceOrderTx(client, {
    accountId: params.accountId,
    base: params.base,
    collateral: params.collateral,
    isLong: !params.positionIsLong,
    isStopOrder: params.type === "sl",
    reduceOnly: true,
    collateralAmount: 0,
    size: orderSize,
    triggerPrice: params.triggerPrice,
    linkedPositionId: params.positionId,
    gasBudget: params.gasBudget,
    pythCache: params.pythCache,
    selfPayPyth: params.selfPayPyth,
    tx: params.tx,
  });
}

// ============================================================================
// Cancel Order
// ============================================================================

export interface BuildCancelOrderParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  orderId: number;
  /**
   * Trigger price as 1e9-scaled bigint. `0` scans all price buckets.
   * Only needed when `orderTypeTag` is 0–3 (specific book).
   * Defaults to 0 — ignored when `orderTypeTag` is 255 (wildcard).
   */
  triggerPrice?: bigint;
  /**
   * Order type tag: 0=limit_buy, 1=limit_sell, 2=stop_buy, 3=stop_sell.
   * Defaults to 255 (wildcard — scans all 4 books by `orderId`).
   */
  orderTypeTag?: number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildCancelOrderTx(
  client: WaterXClient,
  params: BuildCancelOrderParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      params.collateral,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const cfg = client.config;

  cancelOrder(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    orderId: params.orderId,
    triggerPrice: params.triggerPrice ?? 0n,
    orderTypeTag: params.orderTypeTag ?? 255,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Mint WLP
// ============================================================================

export interface BuildMintWlpParams {
  /** Collateral token to deposit (default: "USDC") */
  collateral?: CollateralAsset;
  /** The coin object to deposit (TransactionArgument from splitCoins, or object ID string) */
  depositCoin: any;
  /** Minimum LP tokens to receive (slippage protection). Default: 0 */
  minLpAmount?: bigint | number;
  /** Recipient address for LP tokens */
  recipient: string;
  /**
   * If true, fetch fresh price update data from Hermes and append
   * `pyth::update_single_price_feed` to the PTB before reading the on-chain
   * Pyth price. Defaults to false (relies on the Pyth tolerance window).
   */
  updatePythPrice?: boolean;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildMintWlpTx(
  client: WaterXClient,
  params: BuildMintWlpParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);
  const cfg = client.config;
  const coll = params.collateral ?? "USDC";

  // Refresh every pool token before mint — `assert_prices_fresh` inside
  // `mint_wlp` checks ALL configured tokens, not just the deposit one.
  const priceResult = await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    coll,
    params.pythCache,
    params.updatePythPrice,
  );
  const collateral = client.getCollateral(coll);

  mintWlp(client, tx, {
    depositTokenType: collateral.type,
    lpTokenType: cfg.wlpType,
    depositCoin: params.depositCoin,
    priceResult,
    minLpAmount: params.minLpAmount ?? 0,
    recipient: params.recipient,
  });

  return tx;
}

export interface BuildMintAndStakeWlpTxParams {
  /** Collateral token to deposit (default: "USDC") */
  collateral?: CollateralAsset;
  /** The coin object to deposit (TransactionArgument from splitCoins, or object ID string) */
  depositCoin: any;
  /** Minimum LP tokens to receive (slippage protection). Default: 0 */
  minLpAmount?: bigint | number;
  distributorId?: string;
  rewardTokenTypes?: string[];
  rewardDistributorPackageId?: string;
  /**
   * Optional Bucket `Account` object id (or PTB arg) used as the staking identity.
   * Omit to credit the stake to the wallet sender.
   */
  bucketAccount?: string | TransactionArgument;
  /** See `BuildMintWlpParams.updatePythPrice`. */
  updatePythPrice?: boolean;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildMintAndStakeWlpTx(
  client: WaterXClient,
  params: BuildMintAndStakeWlpTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 250_000_000);
  const cfg = client.config;
  const coll = params.collateral ?? "USDC";

  const priceResult = await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    coll,
    params.pythCache,
    params.updatePythPrice,
  );
  const collateral = client.getCollateral(coll);
  const lpCoin = mintWlpCoin(client, tx, {
    depositTokenType: collateral.type,
    lpTokenType: cfg.wlpType,
    depositCoin: params.depositCoin,
    priceResult,
    minLpAmount: params.minLpAmount ?? 0,
  });

  stakeRewardDistributor(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: cfg.wlpType,
    stakeCoin: lpCoin,
    rewardTokenTypes: params.rewardTokenTypes,
    packageId: params.rewardDistributorPackageId,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

// ============================================================================
// Redeem WLP
// ============================================================================

export interface BuildRequestRedeemWlpParams {
  /** Collateral token to receive (default: "USDC") */
  collateral?: CollateralAsset;
  lpCoin: any;
  /** Recipient address for the redeemed tokens */
  recipient: string;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildRequestRedeemWlpTx(
  client: WaterXClient,
  params: BuildRequestRedeemWlpParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);
  const cfg = client.config;

  await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    params.collateral ?? "USDC",
    params.pythCache,
    params.updatePythPrice,
  );

  const collateral = client.getCollateral(params.collateral ?? "USDC");
  requestRedeemWlp(client, tx, {
    redeemTokenType: collateral.type,
    lpTokenType: cfg.wlpType,
    lpCoin: params.lpCoin,
    recipient: params.recipient,
  });

  return tx;
}

export interface BuildCancelRedeemWlpParams {
  requestId: bigint | number;
  /**
   * Collateral token used to select the deposit pool entry when refreshing
   * pool token prices. `cancel_redeem` does not pay out a collateral coin —
   * this only steers `refreshAllPoolTokensAndGetDepositPriceResult` (default:
   * "USDC").
   */
  collateral?: CollateralAsset;
  /**
   * Optional Bucket framework `Account` object ID. Set this when the original
   * `request_redeem` recipient was the Account object address (shared /
   * multi-sig scenario). Defaults to wallet sender.
   */
  bucketAccount?: string | TransactionArgument;
  /** Reward token types active on the distributor (for settle on re-stake). */
  rewardTokenTypes?: string[];
  /** Override for the reward_distributor package ID. */
  rewardDistributorPackageId?: string;
  /** Override for the shared RewardDistributor object ID. */
  distributorId?: string;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  pythCache?: PythCache;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

/**
 * Cancels a pending WLP redeem and re-stakes the recovered WLP into
 * the reward distributor in one atomic PTB.
 */
export async function buildCancelRedeemWlpTx(
  client: WaterXClient,
  params: BuildCancelRedeemWlpParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);
  const cfg = client.config;

  // `cancel_redeem` internally calls `assert_prices_fresh` which checks every
  // pool token, not just the deposit one — refresh all before the cancel.
  await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    params.collateral ?? "USDC",
    params.pythCache,
    params.updatePythPrice,
  );

  const lpCoin = cancelRedeemWlp(client, tx, {
    lpTokenType: cfg.wlpType,
    requestId: params.requestId,
    bucketAccount: params.bucketAccount,
  });

  stakeRewardDistributor(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: cfg.wlpType,
    stakeCoin: lpCoin,
    rewardTokenTypes: params.rewardTokenTypes,
    packageId: params.rewardDistributorPackageId,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

export interface BuildSettleRedeemWlpParams {
  /** Collateral token to receive (default: "USDC") */
  collateral?: CollateralAsset;
  requestId: bigint | number;
  /** See `BuildMintWlpParams.updatePythPrice`. */
  updatePythPrice?: boolean;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildSettleRedeemWlpTx(
  client: WaterXClient,
  params: BuildSettleRedeemWlpParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);
  const cfg = client.config;

  const coll = params.collateral ?? "USDC";
  const priceResult = await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    coll,
    params.pythCache,
    params.updatePythPrice,
  );
  const collateral = client.getCollateral(coll);

  settleRedeemWlp(client, tx, {
    lpTokenType: cfg.wlpType,
    redeemTokenType: collateral.type,
    requestId: params.requestId,
    priceResult,
  });

  return tx;
}

// ============================================================================
// Reward Distributor
// ============================================================================

export interface BuildStakeRewardDistributorTxParams {
  distributorId?: string;
  stakeTokenType: string;
  stakeCoin: string | TransactionArgument;
  rewardTokenTypes?: string[];
  packageId?: string;
  /**
   * Optional Bucket `Account` object id (or PTB arg) used as the staking identity.
   * Omit to credit the stake to the wallet sender.
   */
  bucketAccount?: string | TransactionArgument;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export function buildStakeRewardDistributorTx(
  client: WaterXClient,
  params: BuildStakeRewardDistributorTxParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 100_000_000);

  stakeRewardDistributor(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: params.stakeTokenType,
    stakeCoin: params.stakeCoin,
    rewardTokenTypes: params.rewardTokenTypes,
    packageId: params.packageId,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

export interface BuildUnstakeRewardDistributorTxParams {
  distributorId?: string;
  stakeTokenType: string;
  withdrawalAmount: bigint | number;
  rewardTokenTypes?: string[];
  /** Recipient for the redeemed stake coin. */
  recipient: string;
  packageId?: string;
  /**
   * Optional Bucket `Account` object id (or PTB arg) — must match the identity
   * used to stake into the position being redeemed.
   */
  bucketAccount?: string | TransactionArgument;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export function buildUnstakeRewardDistributorTx(
  client: WaterXClient,
  params: BuildUnstakeRewardDistributorTxParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 50_000_000);

  unstakeRewardDistributor(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: params.stakeTokenType,
    withdrawalAmount: params.withdrawalAmount,
    rewardTokenTypes: params.rewardTokenTypes,
    recipient: params.recipient,
    packageId: params.packageId,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

export interface BuildClaimRewardDistributorTxParams {
  distributorId?: string;
  stakeTokenType: string;
  rewardTokenType?: string;
  /** Recipient for the claimed reward coin. */
  recipient: string;
  packageId?: string;
  /**
   * Optional Bucket `Account` object id (or PTB arg) — must match the identity
   * used to stake the position whose rewards are being claimed.
   */
  bucketAccount?: string | TransactionArgument;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export function buildClaimRewardDistributorTx(
  client: WaterXClient,
  params: BuildClaimRewardDistributorTxParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 50_000_000);

  claimRewardDistributor(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: params.stakeTokenType,
    rewardTokenType: params.rewardTokenType,
    recipient: params.recipient,
    packageId: params.packageId,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

export interface BuildUnstakeAndRequestRedeemWlpTxParams {
  /** Collateral token to receive (default: "USDC") */
  collateral?: CollateralAsset;
  distributorId?: string;
  withdrawalAmount: bigint | number;
  rewardTokenTypes?: string[];
  rewardDistributorPackageId?: string;
  /** Recipient address for the redeem request output token */
  recipient: string;
  /**
   * Optional Bucket `Account` object id (or PTB arg) — must match the identity
   * used to stake into the position being redeemed.
   */
  bucketAccount?: string | TransactionArgument;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  pythCache?: PythCache;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildUnstakeAndRequestRedeemWlpTx(
  client: WaterXClient,
  params: BuildUnstakeAndRequestRedeemWlpTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 250_000_000);
  const cfg = client.config;
  const coll = params.collateral ?? "USDC";

  // Both `settle_rewarder_on_withdraw` and `request_redeem` call
  // `assert_prices_fresh` against every pool token — refresh them all first.
  await refreshAllPoolTokensAndGetDepositPriceResult(
    client,
    tx,
    coll,
    params.pythCache,
    params.updatePythPrice,
  );

  const collateral = client.getCollateral(coll);

  const lpCoin = redeemRewardDistributorCoin(client, tx, {
    distributorId: params.distributorId,
    stakeTokenType: cfg.wlpType,
    withdrawalAmount: params.withdrawalAmount,
    rewardTokenTypes: params.rewardTokenTypes,
    packageId: params.rewardDistributorPackageId,
    bucketAccount: params.bucketAccount,
  });

  requestRedeemWlp(client, tx, {
    redeemTokenType: collateral.type,
    lpTokenType: cfg.wlpType,
    lpCoin,
    recipient: params.recipient,
  });

  return tx;
}

// ============================================================================
// Deposit to Account (TTO)
// ============================================================================

export interface BuildTransferToAccountParams {
  /** UserAccount object address (deposit target), or a PTB result from `createAccount` */
  accountObjectAddress: string | TransactionArgument;
  /** Coin object ID to transfer. Omit if using `amount`. */
  coinObjectId?: string;
  /** Amount in raw units. Uses `tx.coinWithBalance()` to create the coin from gas. Omit if using `coinObjectId`. */
  amount?: bigint | number;
  /** Full coin type string */
  coinType: string;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

/**
 * Builds a transaction to transfer a coin into a UserAccount.
 * Either pass `coinObjectId` (existing coin) or `amount` (creates coin from gas via coinWithBalance).
 */
export function buildTransferToAccountTx(
  client: WaterXClient,
  params: BuildTransferToAccountParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 50_000_000);

  let coin: string | TransactionArgument;
  if (params.coinObjectId) {
    coin = params.coinObjectId;
  } else if (params.amount !== undefined) {
    coin = coinWithBalance({ type: params.coinType, balance: BigInt(params.amount) })(tx);
  } else {
    throw new Error("Either `coinObjectId` or `amount` must be provided");
  }

  transferToAccount(client, tx, {
    accountObjectAddress: params.accountObjectAddress,
    coin,
    coinType: params.coinType,
  });

  return tx;
}

// ============================================================================
// Receive Coin from Account (TTO)
// ============================================================================

export interface BuildReceiveCoinParams {
  /** UserAccount object address */
  accountObjectAddress: string;
  /** Collateral asset to receive (default: "USDC") */
  collateral?: CollateralAsset;
  /** Amount to receive in raw units. Omit to receive all. */
  amount?: bigint | number;
  /** Recipient address for the received coins */
  recipient: string;
  gasBudget?: number;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

/**
 * Builds a transaction to receive coins from a UserAccount via
 * `receive_coin_with_amount_to`. Fetches account coins and builds
 * the receiving vector automatically.
 * Pass `amount` to withdraw a specific amount (remainder stays in account),
 * or omit to receive all.
 */
export async function buildReceiveCoinTx(
  client: WaterXClient,
  params: BuildReceiveCoinParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 50_000_000);

  const coll = params.collateral ?? "USDC";
  const coinType = client.getCollateral(coll).type;
  const coins = await getAccountCoins(client, params.accountObjectAddress, coinType);
  if (!coins.length)
    throw new Error(`No ${coll} coins found in account ${params.accountObjectAddress}`);

  const receivingVec = buildReceivingVector(
    tx,
    coins.map((c) => ({ objectId: c.objectId, version: c.version, digest: c.digest })),
    coinType,
  );

  const fwPkg = client.config.bucketFrameworkPackageId!;
  const [senderRequest] = accountRequestCall({ package: fwPkg })(tx);

  const amountOpt =
    params.amount !== undefined
      ? tx.pure.option("u64", BigInt(params.amount))
      : tx.pure.option("u64", null);

  receiveCoinWithAmountToCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      accountId: params.accountObjectAddress,
      toReceives: receivingVec,
      amountOpt,
      recipient: params.recipient,
    },
    typeArguments: [coinType],
  })(tx);

  return tx;
}

// ============================================================================
// Increase Position
// ============================================================================

export interface BuildIncreasePositionParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  positionId: number;
  collateralAmount: bigint | number;
  leverage?: number;
  size?: bigint | number | TransactionArgument;
  acceptablePrice?: bigint;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildIncreasePositionTx(
  client: WaterXClient,
  params: BuildIncreasePositionParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const size = resolveSizeFromParams(
    client,
    tx,
    { ...params, collateral: coll },
    basePriceResult,
    collateralPriceResult,
  );
  const receivingCoins = await fetchAccountCoins(client, params.accountId, coll);
  const cfg = client.config;

  increasePosition(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    positionId: params.positionId,
    receivingCoins,
    collateralAmount: params.collateralAmount,
    size,
    acceptablePrice: params.acceptablePrice,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Decrease Position
// ============================================================================

export interface BuildDecreasePositionParams {
  accountId: string;
  base: BaseAsset;
  collateral?: CollateralAsset;
  positionId: number;
  size: bigint | number;
  acceptablePrice?: bigint;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildDecreasePositionTx(
  client: WaterXClient,
  params: BuildDecreasePositionParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const cfg = client.config;

  decreasePosition(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.accountId,
    positionId: params.positionId,
    size: params.size,
    acceptablePrice: params.acceptablePrice,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Liquidate (single position)
// ============================================================================

export interface BuildLiquidateTxParams {
  base: BaseAsset;
  collateral?: CollateralAsset;
  /** Keeper's account address that receives the liquidation reward */
  rewardRecipient: string;
  positionId: number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildLiquidateTx(
  client: WaterXClient,
  params: BuildLiquidateTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 200_000_000);

  const coll = params.collateral ?? "USDC";
  const { basePriceResult, collateralPriceResult, market, collateral, sponsorFund } =
    await addPriceFeeds(
      client,
      tx,
      params.base,
      coll,
      params.pythCache,
      params.updatePythPrice,
      params.selfPayPyth,
    );
  const cfg = client.config;

  liquidate(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    accountId: params.rewardRecipient,
    positionId: params.positionId,
    basePriceResult,
    collateralPriceResult,
    sponsorFund,
  });

  return tx;
}

// ============================================================================
// Batch Liquidate (paginated scan + execute + destroy)
// ============================================================================

export interface BuildBatchLiquidateTxParams {
  base: BaseAsset;
  collateral?: CollateralAsset;
  pageSize: number;
  pageIndex: number;
  rewardRecipient: string;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

/**
 * Builds a full batch liquidation PTB:
 * batch_liquidate_request → batch_execute → batch_destroy_response
 */
export async function buildBatchLiquidateTx(
  client: WaterXClient,
  params: BuildBatchLiquidateTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 500_000_000);

  const coll = params.collateral ?? "USDC";
  // Batch liquidate cannot use sponsor — vector<TradingRequest> has no single request to reimburse
  const { basePriceResult, collateralPriceResult, market, collateral } = await addPriceFeeds(
    client,
    tx,
    params.base,
    coll,
    params.pythCache,
    params.updatePythPrice,
    /* selfPayPyth: */ true,
  );
  const cfg = client.config;
  const pkg = cfg.packageId;
  const fwPkg = cfg.bucketFrameworkPackageId!;
  const typeArgs: [string, string, string] = [collateral.type, market.baseType, cfg.wlpType];

  const [senderRequest] = accountRequestCall({ package: fwPkg })(tx);

  const [requests] = batchLiquidateRequestCall({
    package: pkg,
    arguments: {
      globalConfig: cfg.globalConfig,
      market: market.market,
      pool: cfg.wlpPool,
      senderRequest,
      priceResult: basePriceResult,
      collateralPriceResult,
      pageSize: BigInt(params.pageSize),
      pageIndex: BigInt(params.pageIndex),
    },
    typeArguments: typeArgs,
  })(tx);

  const [changeCoin, responses] = batchExecuteCall({
    package: pkg,
    arguments: {
      globalConfig: cfg.globalConfig,
      accountRegistry: cfg.accountRegistry,
      market: market.market,
      pool: cfg.wlpPool,
      requests,
      priceResult: basePriceResult,
      collateralPriceResult,
    },
    typeArguments: typeArgs,
  })(tx);

  batchDestroyResponseCall({
    package: pkg,
    arguments: {
      globalConfig: cfg.globalConfig,
      market: market.market,
      responses,
    },
    typeArguments: [market.baseType, cfg.wlpType],
  })(tx);

  tx.transferObjects([changeCoin], params.rewardRecipient);

  return tx;
}

// ============================================================================
// Match Orders (Keeper)
// ============================================================================

export interface BuildMatchOrdersTxParams {
  base: BaseAsset;
  collateral?: CollateralAsset;
  orderTypeTag: number;
  triggerPrice: bigint;
  maxFills: bigint | number;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildMatchOrdersTx(
  client: WaterXClient,
  params: BuildMatchOrdersTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 500_000_000);

  const coll = params.collateral ?? "USDC";
  // matchOrders creates requests internally — cannot use sponsor reimburse
  const { basePriceResult, collateralPriceResult, market, collateral } = await addPriceFeeds(
    client,
    tx,
    params.base,
    coll,
    params.pythCache,
    params.updatePythPrice,
    /* selfPayPyth: */ true,
  );
  const cfg = client.config;

  matchOrders(client, tx, {
    collateralTokenType: collateral.type,
    baseTokenType: market.baseType,
    lpTokenType: cfg.wlpType,
    market: market.market,
    orderTypeTag: params.orderTypeTag,
    triggerPrice: params.triggerPrice,
    maxFills: params.maxFills,
    basePriceResult,
    collateralPriceResult,
  });

  return tx;
}

// ============================================================================
// Update Funding Rate (Keeper)
// ============================================================================

export interface BuildUpdateFundingRateTxParams {
  base: BaseAsset;
  gasBudget?: number;
  pythCache?: PythCache;
  /** Fetch fresh Hermes update before feeding Pyth on-chain (default false). */
  updatePythPrice?: boolean;
  /** Pay Pyth update fees from tx.gas instead of sponsor (default false). */
  selfPayPyth?: boolean;
  /** Optional existing Transaction to append commands to. */
  tx?: Transaction;
}

export async function buildUpdateFundingRateTx(
  client: WaterXClient,
  params: BuildUpdateFundingRateTxParams,
): Promise<Transaction> {
  const tx = params.tx ?? new Transaction();
  if (!params.tx) tx.setGasBudget(params.gasBudget ?? 50_000_000);

  const entry = client.getMarketEntry(params.base);
  const cfg = client.config;
  const m = resolveMarket(client, params.base);

  const basePriceResult = buildOracleFeed(client, tx, m.baseType, m.baseAgg, m.basePriceInfo);

  updateFundingRate(client, tx, {
    baseTokenType: entry.baseType,
    lpTokenType: cfg.wlpType,
    market: entry.marketId,
    basePriceResult,
  });

  return tx;
}
