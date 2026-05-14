/**
 * Trading builders for `waterx_perp`.
 *
 * Each user-side flow has two phases:
 *   1. `*Request(...)` constructs a `TradingRequest<C_TOKEN>` hot potato
 *      and returns the raw transaction argument.
 *   2. `executeTrading(...)` consumes the hot potato via `trading::execute`.
 *
 * Keeper flows (`liquidate`, `batchLiquidate`, `matchOrders`,
 * `updateFundingRate`, `openByKeeper`, `closeByKeeper`) are single-call:
 * they do the work inline and return `()`.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import { ORDER_TAG_WILDCARD } from "../constants.ts";
import {
  request as accountRequest,
  requestWithAccount as accountRequestWithAccount,
} from "../generated/bucket_v2_framework/account.ts";
import * as trading from "../generated/waterx_perp/trading.ts";

// ============================================================================
// Common helpers
// ============================================================================

type BucketAccount = string | TransactionArgument | undefined;

function senderRequest(tx: Transaction, bucketAccount: BucketAccount): TransactionArgument {
  if (bucketAccount === undefined) {
    return accountRequest({})(tx) as unknown as TransactionArgument;
  }
  const accArg = typeof bucketAccount === "string" ? tx.object(bucketAccount) : bucketAccount;
  return accountRequestWithAccount({
    arguments: { account: accArg as unknown as string },
  })(tx) as unknown as TransactionArgument;
}

export interface TradingTypeArgs {
  /** Collateral coin type (e.g. `0x…::usdc::USDC`). */
  collateralType: string;
  /** Defaults to `client.wlpType()`. */
  lpType?: string;
}

function typeArgs(client: WaterXClient, t: TradingTypeArgs): [string, string] {
  return [t.collateralType, t.lpType ?? client.wlpType()];
}

export interface CommonTradingParams extends TradingTypeArgs {
  /** Market ticker (e.g. `"BTC/USD"`). */
  ticker: string;
  /** wxa `Account` ID acting as sender / collateral source. */
  accountId: string;
  /** Optional Bucket Account to act through (`request_with_account(&Account)`). */
  bucketAccount?: string | TransactionArgument;
}

function commonObjects(client: WaterXClient) {
  const perp = client.config.packages.waterx_perp;
  return {
    perpPackage: perp.published_at,
    globalConfig: perp.global_config,
    wxaRegistry: client.config.packages.waterx_account.account_registry,
    marketRegistry: perp.market_registry_wlp,
    wlpPool: client.config.packages.wlp.wlp_pool,
    oracle: client.config.packages.waterx_oracle.oracle,
  };
}

// ============================================================================
// Close position
// ============================================================================

export interface ClosePositionRequestParams extends CommonTradingParams {
  positionId: bigint | number;
  /** Raw scaled `Float` (1e9). Use `rawPrice(usd)` to convert. */
  acceptablePrice: bigint | number;
}

export function closePositionRequest(
  client: WaterXClient,
  tx: Transaction,
  params: ClosePositionRequestParams,
): TransactionArgument {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  const [tr] = trading.closePositionRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      positionId: params.positionId,
      acceptablePrice: params.acceptablePrice,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// Increase / decrease position
// ============================================================================

export interface IncreasePositionRequestParams extends CommonTradingParams {
  positionId: bigint | number;
  collateralAmount: bigint | number;
  /** Raw 1e9-scaled `Float` size. */
  size: bigint | number;
  /** Raw 1e9-scaled `Float` slippage cap. */
  acceptablePrice: bigint | number;
  /** Optional opener order id (rare). */
  orderId?: bigint | number;
}

export function increasePositionRequest(
  client: WaterXClient,
  tx: Transaction,
  params: IncreasePositionRequestParams,
): TransactionArgument {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  const [tr] = trading.increasePositionRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      orderId: params.orderId ?? null,
      positionId: params.positionId,
      collateralAmount: params.collateralAmount,
      size: params.size,
      acceptablePrice: params.acceptablePrice,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
  return tr as unknown as TransactionArgument;
}

export interface DecreasePositionRequestParams extends CommonTradingParams {
  positionId: bigint | number;
  /** Raw 1e9-scaled `Float` size to reduce by. */
  size: bigint | number;
  acceptablePrice: bigint | number;
}

export function decreasePositionRequest(
  client: WaterXClient,
  tx: Transaction,
  params: DecreasePositionRequestParams,
): TransactionArgument {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  const [tr] = trading.decreasePositionRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      positionId: params.positionId,
      size: params.size,
      acceptablePrice: params.acceptablePrice,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// Deposit / withdraw collateral
// ============================================================================

export interface DepositCollateralRequestParams extends CommonTradingParams {
  positionId: bigint | number;
  collateralAmount: bigint | number;
}

export function depositCollateralRequest(
  client: WaterXClient,
  tx: Transaction,
  params: DepositCollateralRequestParams,
): TransactionArgument {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  const [tr] = trading.depositCollateralRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      positionId: params.positionId,
      collateralAmount: params.collateralAmount,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
  return tr as unknown as TransactionArgument;
}

export interface WithdrawCollateralRequestParams extends CommonTradingParams {
  positionId: bigint | number;
  amount: bigint | number;
}

export function withdrawCollateralRequest(
  client: WaterXClient,
  tx: Transaction,
  params: WithdrawCollateralRequestParams,
): TransactionArgument {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  const [tr] = trading.withdrawCollateralRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      positionId: params.positionId,
      amount: params.amount,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// Execute (consumes the TradingRequest hot potato)
// ============================================================================

export interface ExecuteTradingParams extends TradingTypeArgs {
  ticker: string;
  request: TransactionArgument;
}

export function executeTrading(
  client: WaterXClient,
  tx: Transaction,
  params: ExecuteTradingParams,
): void {
  const obj = commonObjects(client);
  trading.execute({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      req: params.request as unknown as string,
      oracle: tx.object(obj.oracle),
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

// ============================================================================
// Keeper paths — single-call (no request/execute split)
// ============================================================================

export interface LiquidateParams extends TradingTypeArgs {
  ticker: string;
  positionId: bigint | number;
  /** Optional Bucket Account to act through. */
  bucketAccount?: string | TransactionArgument;
}

export function liquidate(client: WaterXClient, tx: Transaction, params: LiquidateParams): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.liquidate({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      senderRequest: req as unknown as string,
      positionId: params.positionId,
      oracle: tx.object(obj.oracle),
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

export interface BatchLiquidateParams extends TradingTypeArgs {
  ticker: string;
  pageSize: bigint | number;
  pageIndex: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function batchLiquidate(
  client: WaterXClient,
  tx: Transaction,
  params: BatchLiquidateParams,
): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.batchLiquidate({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      senderRequest: req as unknown as string,
      oracle: tx.object(obj.oracle),
      pageSize: params.pageSize,
      pageIndex: params.pageIndex,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

export interface MatchOrdersParams extends TradingTypeArgs {
  ticker: string;
  /** Order book to scan: `ORDER_LIMIT_BUY` / `ORDER_LIMIT_SELL` / etc. */
  orderTypeTag: number;
  /** Raw 1e9-scaled trigger price to start from (`0` = scan from best). */
  triggerPrice: bigint | number;
  maxFills: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function matchOrders(
  client: WaterXClient,
  tx: Transaction,
  params: MatchOrdersParams,
): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.matchOrders({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      senderRequest: req as unknown as string,
      oracle: tx.object(obj.oracle),
      orderTypeTag: params.orderTypeTag,
      triggerPrice: params.triggerPrice,
      maxFills: params.maxFills,
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

export interface UpdateFundingRateParams {
  ticker: string;
  /** Defaults to `client.wlpType()`. */
  lpType?: string;
  bucketAccount?: string | TransactionArgument;
}

export function updateFundingRate(
  client: WaterXClient,
  tx: Transaction,
  params: UpdateFundingRateParams,
): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.updateFundingRate({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      oracle: tx.object(obj.oracle),
      senderRequest: req as unknown as string,
    },
    typeArguments: [params.lpType ?? client.wlpType()],
  })(tx);
}

export interface OpenPositionByKeeperParams extends TradingTypeArgs {
  ticker: string;
  /** Address of the user-side account (the position will be owned by this address). */
  accountObjectAddress: string;
  /** Collateral `Coin<C_TOKEN>` argument the keeper is funding from its treasury. */
  collateralCoin: TransactionArgument;
  isLong: boolean;
  /** Raw 1e9-scaled `Float`. */
  size: bigint | number;
  acceptablePrice: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function openPositionByKeeper(
  client: WaterXClient,
  tx: Transaction,
  params: OpenPositionByKeeperParams,
): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.openPositionByKeeper({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      keeperRequest: req as unknown as string,
      accountObjectAddress: params.accountObjectAddress,
      collateralCoin: params.collateralCoin as unknown as string,
      isLong: params.isLong,
      size: params.size,
      acceptablePrice: params.acceptablePrice,
      oracle: tx.object(obj.oracle),
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

export interface ClosePositionByKeeperParams extends TradingTypeArgs {
  ticker: string;
  positionId: bigint | number;
  acceptablePrice: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function closePositionByKeeper(
  client: WaterXClient,
  tx: Transaction,
  params: ClosePositionByKeeperParams,
): void {
  const obj = commonObjects(client);
  const req = senderRequest(tx, params.bucketAccount);
  trading.closePositionByKeeper({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(obj.globalConfig),
      wxaRegistry: tx.object(obj.wxaRegistry),
      marketRegistry: tx.object(obj.marketRegistry),
      ticker: params.ticker,
      pool: tx.object(obj.wlpPool),
      keeperRequest: req as unknown as string,
      positionId: params.positionId,
      acceptablePrice: params.acceptablePrice,
      oracle: tx.object(obj.oracle),
    },
    typeArguments: typeArgs(client, params),
  })(tx);
}

// ============================================================================
// Cancel order wildcard helper (re-exported for symmetry with v2)
// ============================================================================

export const ORDER_TAG_WILDCARD_VALUE = ORDER_TAG_WILDCARD;
