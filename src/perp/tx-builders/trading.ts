/**
 * High-level trading composers: position lifecycle (close / increase /
 * decrease), collateral deposit / withdraw, and order lifecycle (place /
 * cancel / update / pre-order). Each wraps the matching `*_request` builder in
 * the shared request+execute envelope.
 */

import type { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../client.ts";
import {
  addPreOrderRequest,
  cancelOrderRequest,
  cancelPreOrderRequest,
  placeOrderRequest,
  updateOrderRequest,
  type AddPreOrderRequestParams,
  type CancelOrderRequestParams,
  type CancelPreOrderRequestParams,
  type PlaceOrderRequestParams,
  type UpdateOrderRequestParams,
} from "../user/order.ts";
import {
  closePositionRequest,
  decreasePositionRequest,
  depositCollateralRequest,
  increasePositionRequest,
  withdrawCollateralRequest,
  type ClosePositionRequestParams,
  type DecreasePositionRequestParams,
  type DepositCollateralRequestParams,
  type IncreasePositionRequestParams,
  type WithdrawCollateralRequestParams,
} from "../user/trading.ts";
import { newTx, wrapRequestAndExecute, type CommonBuildOpts } from "./common.ts";

// ============================================================================
// Position lifecycle (close / increase / decrease)
// ============================================================================

export interface BuildClosePositionParams extends ClosePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildClosePositionTx(
  client: PerpClient,
  params: BuildClosePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => closePositionRequest(client, tx, params),
  );
  return tx;
}

export interface BuildIncreasePositionParams
  extends IncreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildIncreasePositionTx(
  client: PerpClient,
  params: BuildIncreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => increasePositionRequest(client, tx, params),
  );
  return tx;
}

export interface BuildDecreasePositionParams
  extends DecreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildDecreasePositionTx(
  client: PerpClient,
  params: BuildDecreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => decreasePositionRequest(client, tx, params),
  );
  return tx;
}

// ============================================================================
// Deposit / withdraw collateral
// ============================================================================

export interface BuildDepositCollateralParams
  extends DepositCollateralRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildDepositCollateralTx(
  client: PerpClient,
  params: BuildDepositCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => depositCollateralRequest(client, tx, params),
  );
  return tx;
}

export interface BuildWithdrawCollateralParams
  extends WithdrawCollateralRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildWithdrawCollateralTx(
  client: PerpClient,
  params: BuildWithdrawCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => withdrawCollateralRequest(client, tx, params),
  );
  return tx;
}

// ============================================================================
// Order lifecycle (place / cancel / update / pre-order)
// ============================================================================

export interface BuildPlaceOrderParams extends PlaceOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildPlaceOrderTx(
  client: PerpClient,
  params: BuildPlaceOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => placeOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildCancelOrderParams extends CancelOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelOrderTx(
  client: PerpClient,
  params: BuildCancelOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => cancelOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildUpdateOrderParams extends UpdateOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildUpdateOrderTx(
  client: PerpClient,
  params: BuildUpdateOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => updateOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildCancelPreOrderParams extends CancelPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelPreOrderTx(
  client: PerpClient,
  params: BuildCancelPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => cancelPreOrderRequest(client, tx, params),
  );
  return tx;
}

export interface BuildAddPreOrderParams extends AddPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildAddPreOrderTx(
  client: PerpClient,
  params: BuildAddPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await wrapRequestAndExecute(
    client,
    tx,
    params,
    params.collateralTicker ?? "USDCUSD",
    params,
    () => addPreOrderRequest(client, tx, params),
  );
  return tx;
}
