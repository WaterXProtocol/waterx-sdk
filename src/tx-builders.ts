/**
 * High-level transaction builders that compose oracle refresh + the
 * appropriate `*_request` + `execute` for a single user-side action.
 *
 * Each top-level builder:
 *   1. Creates a fresh `Transaction` (or appends to one you pass in).
 *   2. Refreshes the on-chain `Oracle` for the base + collateral tickers
 *      via Pyth (uses `utils/pyth.ts`). Pass `updatePythPrice: true` to
 *      additionally pre-update Pyth on-chain from Hermes — otherwise the
 *      caller is assumed to have done this in a sibling PTB.
 *   3. Calls the request builder, then `executeTrading` to consume the
 *      hot potato.
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "./client.ts";
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
} from "./user/order.ts";
import {
  closePositionRequest,
  decreasePositionRequest,
  depositCollateralRequest,
  executeTrading,
  increasePositionRequest,
  withdrawCollateralRequest,
  type ClosePositionRequestParams,
  type DecreasePositionRequestParams,
  type DepositCollateralRequestParams,
  type IncreasePositionRequestParams,
  type WithdrawCollateralRequestParams,
} from "./user/trading.ts";
import { PythCache, refreshOraclePrices, updatePythPrices } from "./utils/pyth.ts";

// ============================================================================
// Common opts
// ============================================================================

export interface CommonBuildOpts {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
  /** Refresh Pyth on-chain via Hermes before feeding the rule. Default: false. */
  updatePythPrice?: boolean;
  /** Share a `PythCache` across builders to avoid redundant pyth_state reads. */
  pythCache?: PythCache;
  /** Optional sponsored Pyth update fund (from `pyth_sponsor_rule::request`). */
  sponsorFund?: { fund: TransactionArgument; packageId: string };
}

function newTx(opts?: CommonBuildOpts): Transaction {
  return opts?.tx ?? new Transaction();
}

async function refreshForAction(
  client: WaterXClient,
  tx: Transaction,
  tickers: string[],
  opts?: CommonBuildOpts,
): Promise<void> {
  if (opts?.updatePythPrice === false) {
    // Skip even on-chain feed — caller manages oracle freshness elsewhere.
    return;
  }
  await refreshOraclePrices(tx, client, tickers, {
    cache: opts?.pythCache,
    sponsorFund: opts?.sponsorFund,
  });
}

// ============================================================================
// Close / increase / decrease position
// ============================================================================

export interface BuildClosePositionParams extends ClosePositionRequestParams, CommonBuildOpts {
  /** Collateral ticker (e.g. `"USDC/USD"`); defaults to client.config.collaterals.USDC.ticker */
  collateralTicker?: string;
}

export async function buildClosePositionTx(
  client: WaterXClient,
  params: BuildClosePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const baseTicker = params.ticker;
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [baseTicker, colTicker], params);
  const req = closePositionRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildIncreasePositionParams
  extends IncreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildIncreasePositionTx(
  client: WaterXClient,
  params: BuildIncreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = increasePositionRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildDecreasePositionParams
  extends DecreasePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildDecreasePositionTx(
  client: WaterXClient,
  params: BuildDecreasePositionParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = decreasePositionRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
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
  client: WaterXClient,
  params: BuildDepositCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = depositCollateralRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildWithdrawCollateralParams
  extends WithdrawCollateralRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildWithdrawCollateralTx(
  client: WaterXClient,
  params: BuildWithdrawCollateralParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = withdrawCollateralRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

// ============================================================================
// Place / cancel / update order
// ============================================================================

export interface BuildPlaceOrderParams extends PlaceOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildPlaceOrderTx(
  client: WaterXClient,
  params: BuildPlaceOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = placeOrderRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildCancelOrderParams extends CancelOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelOrderTx(
  client: WaterXClient,
  params: BuildCancelOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = cancelOrderRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildUpdateOrderParams extends UpdateOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildUpdateOrderTx(
  client: WaterXClient,
  params: BuildUpdateOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = updateOrderRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildCancelPreOrderParams extends CancelPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildCancelPreOrderTx(
  client: WaterXClient,
  params: BuildCancelPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = cancelPreOrderRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

export interface BuildAddPreOrderParams extends AddPreOrderRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildAddPreOrderTx(
  client: WaterXClient,
  params: BuildAddPreOrderParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const colTicker = params.collateralTicker ?? "USDC/USD";
  await refreshForAction(client, tx, [params.ticker, colTicker], params);
  const req = addPreOrderRequest(client, tx, params);
  executeTrading(client, tx, {
    ticker: params.ticker,
    collateralType: params.collateralType,
    lpType: params.lpType,
    request: req,
  });
  return tx;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { PythCache, refreshOraclePrices, updatePythPrices };
