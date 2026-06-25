/**
 * Order builders for `waterx_perp::trading`.
 *
 * `placeOrderRequest` accepts a main `PlaceOrderArgument` plus an optional
 * `preOrder: PlaceOrderArgument[]` of reduce-only TP/SL legs to reserve
 * against the freshly opened position.
 *
 * Use `triggerPrice === undefined` (market form) to park an order at
 * tick 0 in the limit book; a keeper picks it up via `match_orders`.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { newPlaceOrderArgument } from "../../generated/waterx_perp/request.ts";
import * as trading from "../../generated/waterx_perp/trading.ts";
import { makeSenderRequest } from "../../utils/account-request.ts";
import type { PerpClient } from "../client.ts";
import { ORDER_TAG_WILDCARD } from "../constants.ts";

// ============================================================================
// PlaceOrderArgument struct constructor
// ============================================================================

export interface PlaceOrderArgumentParams {
  isLong: boolean;
  isStopOrder: boolean;
  reduceOnly: boolean;
  /** Raw 1e9-scaled `Float` size. */
  size: bigint | number;
  /** Raw 1e9-scaled `Float` trigger price. `undefined` = market form. */
  triggerPrice?: bigint | number;
  linkedPositionId?: bigint | number;
  /** Raw 1e9-scaled `Float` slippage cap (only used by market form). */
  acceptablePrice?: bigint | number;
  collateralAmount: bigint | number;
}

/** Build a `request::PlaceOrderArgument` Move struct in the PTB. */
export function buildPlaceOrderArgument(
  client: PerpClient,
  tx: Transaction,
  p: PlaceOrderArgumentParams,
): TransactionArgument {
  const [arg] = newPlaceOrderArgument({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      isLong: p.isLong,
      isStopOrder: p.isStopOrder,
      reduceOnly: p.reduceOnly,
      size: p.size,
      triggerPrice: p.triggerPrice ?? null,
      linkedPositionId: p.linkedPositionId ?? null,
      acceptablePrice: p.acceptablePrice ?? null,
      collateralAmount: p.collateralAmount,
    },
  })(tx);
  return arg as unknown as TransactionArgument;
}

// ============================================================================
// place_order_request
// ============================================================================

export interface PlaceOrderRequestParams {
  ticker: string;
  accountId: string;
  collateralType: string;
  lpType?: string;
  /** Main order. */
  main: PlaceOrderArgumentParams;
  /** Optional TP/SL legs (length ≤ market.config.max_pre_orders). */
  preOrders?: PlaceOrderArgumentParams[];
  bucketAccount?: string | TransactionArgument;
}

/** Build `trading::place_order_request`. Returns the `TradingRequest<C_TOKEN>` argument. */
export function placeOrderRequest(
  client: PerpClient,
  tx: Transaction,
  params: PlaceOrderRequestParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const mainArg = buildPlaceOrderArgument(client, tx, params.main);
  const preArgs = (params.preOrders ?? []).map((p) => buildPlaceOrderArgument(client, tx, p));

  const preOrderType = `${client.config.packages.waterx_perp.published_at}::request::PlaceOrderArgument`;
  const preVec = tx.makeMoveVec({
    type: preOrderType,
    elements: preArgs as unknown as Parameters<typeof tx.makeMoveVec>[0]["elements"],
  });

  const [tr] = trading.placeOrderRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: params.ticker,
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      main: mainArg as unknown as TransactionArgument,
      preOrder: preVec as unknown as TransactionArgument,
    },
    typeArguments: [params.collateralType, params.lpType ?? client.wlpType()],
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// cancel_order_request
// ============================================================================

export interface CancelOrderRequestParams {
  ticker: string;
  accountId: string;
  collateralType: string;
  lpType?: string;
  orderId: bigint | number;
  /** Raw 1e9-scaled `Float`. `0n` scans all trigger price buckets in the selected book(s). */
  triggerPrice?: bigint | number;
  /** Defaults to `ORDER_TAG_WILDCARD` (255) — scans all 4 books by `orderId`. */
  orderTypeTag?: number;
  bucketAccount?: string | TransactionArgument;
}

export function cancelOrderRequest(
  client: PerpClient,
  tx: Transaction,
  params: CancelOrderRequestParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [tr] = trading.cancelOrderRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: params.ticker,
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      orderId: params.orderId,
      triggerPrice: params.triggerPrice ?? 0n,
      orderTypeTag: params.orderTypeTag ?? ORDER_TAG_WILDCARD,
    },
    typeArguments: [params.collateralType, params.lpType ?? client.wlpType()],
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// update_order_request
// ============================================================================

export interface UpdateOrderRequestParams {
  ticker: string;
  accountId: string;
  collateralType: string;
  lpType?: string;
  orderId: bigint | number;
  /** Existing trigger price (raw 1e9-scaled), used to locate the order. */
  currentTriggerPrice: bigint | number;
  orderTypeTag: number;
  /** New raw 1e9-scaled size. */
  newSize: bigint | number;
  /** New raw 1e9-scaled trigger price. */
  newTriggerPrice: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function updateOrderRequest(
  client: PerpClient,
  tx: Transaction,
  params: UpdateOrderRequestParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [tr] = trading.updateOrderRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: params.ticker,
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      orderId: params.orderId,
      currentTriggerPrice: params.currentTriggerPrice,
      orderTypeTag: params.orderTypeTag,
      newSize: params.newSize,
      newTriggerPrice: params.newTriggerPrice,
    },
    typeArguments: [params.collateralType, params.lpType ?? client.wlpType()],
  })(tx);
  return tr as unknown as TransactionArgument;
}

// ============================================================================
// cancel_pre_order_request / add_pre_order_request
// ============================================================================

export interface CancelPreOrderRequestParams {
  ticker: string;
  accountId: string;
  collateralType: string;
  lpType?: string;
  mainOrderId: bigint | number;
  preOrderId: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function cancelPreOrderRequest(
  client: PerpClient,
  tx: Transaction,
  params: CancelPreOrderRequestParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [tr] = trading.cancelPreOrderRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: params.ticker,
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      mainOrderId: params.mainOrderId,
      preOrderId: params.preOrderId,
    },
    typeArguments: [params.collateralType, params.lpType ?? client.wlpType()],
  })(tx);
  return tr as unknown as TransactionArgument;
}

export interface AddPreOrderRequestParams {
  ticker: string;
  accountId: string;
  collateralType: string;
  lpType?: string;
  mainOrderId: bigint | number;
  preOrder: PlaceOrderArgumentParams;
  bucketAccount?: string | TransactionArgument;
}

export function addPreOrderRequest(
  client: PerpClient,
  tx: Transaction,
  params: AddPreOrderRequestParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const preArg = buildPlaceOrderArgument(client, tx, params.preOrder);
  const [tr] = trading.addPreOrderRequest({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: params.ticker,
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      mainOrderId: params.mainOrderId,
      preOrder: preArg as unknown as TransactionArgument,
    },
    typeArguments: [params.collateralType, params.lpType ?? client.wlpType()],
  })(tx);
  return tr as unknown as TransactionArgument;
}
