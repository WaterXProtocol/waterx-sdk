/**
 * High-level transaction builders that compose oracle refresh + the
 * appropriate `*_request` + `execute` for a single user-side action.
 *
 * Each top-level builder:
 *   1. Creates a fresh `Transaction` (or appends to one you pass in).
 *   2. Refreshes the on-chain `Oracle` for the base + collateral tickers
 *      via Pyth (uses `utils/pyth.ts`).
 *   3. Calls the request builder.
 *   4. If `useSponsor` (default true on testnet): opens a Fund via
 *      `pyth_sponsor_rule::request`, then closes it with `reimburse`
 *      which attaches the `PythSponsorRule` witness to the
 *      TradingRequest so the market's `request_checklist` is satisfied.
 *   5. Executes the trading request via `trading::execute`.
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "./client.ts";
import {
  consumeCreditDeposit,
  enqueueWithdrawal,
  executeWithdrawalNative,
  executeWithdrawalWormhole,
  redeemVaa,
  requestCreditWithdraw,
  routeNative,
  routeWormhole,
  type RedeemVaaParams,
  type RouteWormholeParams,
} from "./user/credit.ts";
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
import { mintWlp, updateTokenValue, type MintWlpParams } from "./user/wlp.ts";
import {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  updatePythPrices,
} from "./utils/pyth.ts";

// ============================================================================
// Common opts
// ============================================================================

export interface CommonBuildOpts {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
  /** Skip oracle refresh entirely (caller manages freshness). Default: false. */
  skipOraclePriceRefresh?: boolean;
  /** Share a `PythCache` across builders to avoid redundant pyth_state reads. */
  pythCache?: PythCache;
  /**
   * Wire the `pyth_sponsor_rule` flow:
   *   - open a Fund via `pyth_sponsor_rule::request(sponsor)`
   *   - pay Pyth update fees from the Fund (instead of `tx.gas`)
   *   - reimburse leftover into the sponsor pool + attach
   *     `PythSponsorRule` witness to the TradingRequest so markets
   *     whose `request_checklist` contains `PythSponsorRule` accept it
   * Default: true (matches the testnet/mainnet checklist config).
   * Pass `false` only when the market checklist is empty.
   */
  useSponsor?: boolean;
}

interface RequestParams {
  ticker: string;
  collateralType: string;
  lpType?: string;
}

function newTx(opts?: CommonBuildOpts): Transaction {
  return opts?.tx ?? new Transaction();
}

/**
 * Build the *Request + execute envelope with optional Pyth sponsor flow:
 *
 *   [fund = sponsor.request()]
 *   refreshOraclePrices(..., sponsorFund?)
 *   req = buildRequest()
 *   [sponsor.reimburse(fund, req)]
 *   trading::execute(req)
 */
async function wrapRequestAndExecute(
  client: WaterXClient,
  tx: Transaction,
  req: RequestParams,
  collateralTicker: string,
  opts: CommonBuildOpts | undefined,
  buildRequest: (sponsorFund?: {
    fund: TransactionArgument;
    packageId: string;
  }) => TransactionArgument,
): Promise<void> {
  const useSponsor = opts?.useSponsor ?? true;
  let sponsorFund: { fund: TransactionArgument; packageId: string } | undefined;
  if (useSponsor) sponsorFund = openPythSponsorFund(tx, client);

  if (!opts?.skipOraclePriceRefresh) {
    // (a) Refresh every pool-token oracle + the base ticker. The pool's
    //     `assert_prices_fresh` walks every TokenPoolInfo and requires each
    //     to have been recently update_token_value'd, so we feed Pyth for
    //     all of them in one PTB. Base ticker is added on top.
    const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
    const oracleTickers = Array.from(new Set([req.ticker, collateralTicker, ...poolTickers]));
    await refreshOraclePrices(tx, client, oracleTickers, {
      cache: opts?.pythCache,
      sponsorFund,
    });
    // (b) Bump each pool token's `last_price_refresh_timestamp` so the
    //     in-execute freshness assertion passes.
    for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
      updateTokenValue(client, tx, { tokenType, lpType: req.lpType });
    }
  }

  const tradingReq = buildRequest(sponsorFund);

  if (sponsorFund) {
    reimbursePythSponsor(tx, client, sponsorFund.fund, tradingReq, req.collateralType);
  }

  executeTrading(client, tx, {
    ticker: req.ticker,
    collateralType: req.collateralType,
    lpType: req.lpType,
    request: tradingReq,
  });
}

// ============================================================================
// Position lifecycle (close / increase / decrease)
// ============================================================================

export interface BuildClosePositionParams extends ClosePositionRequestParams, CommonBuildOpts {
  collateralTicker?: string;
}

export async function buildClosePositionTx(
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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
  client: WaterXClient,
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

// ============================================================================
// WLP mint
// ============================================================================

export interface BuildMintWlpParams extends MintWlpParams, CommonBuildOpts {
  /** Oracle ticker for the deposited token (must be a registered pool token). */
  depositTicker: string;
}

/**
 * Mints WLP from a deposit asset already in the wxa account's stored
 * balance. Refreshes every pool-token oracle + bumps each pool token's
 * `last_price_refresh_timestamp` so `assert_prices_fresh` inside
 * `mint_wlp` passes.
 *
 * Does NOT use the pyth_sponsor flow — `mint_wlp` produces no
 * `TradingRequest`, so there's nothing for the sponsor to attach its
 * witness to. Pyth update fees come from `tx.gas`.
 */
export async function buildMintWlpTx(
  client: WaterXClient,
  params: BuildMintWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);

  if (!params.skipOraclePriceRefresh) {
    const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
    const oracleTickers = Array.from(new Set([params.depositTicker, ...poolTickers]));
    await refreshOraclePrices(tx, client, oracleTickers, { cache: params.pythCache });
    for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
      updateTokenValue(client, tx, { tokenType, lpType: params.lpType });
    }
  }

  mintWlp(client, tx, params);
  return tx;
}

// ============================================================================
// Cross-chain credit / bridge
// ============================================================================

export interface BuildRedeemVaaParams extends RedeemVaaParams {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
}

/**
 * Mint (EVM → Sui): `redeem_vaa<CREDIT>` + consume the resulting
 * `DepositRequest<CREDIT>` via the configured wxa deposit policy, in one
 * PTB. The recipient wxa account is encoded in the VAA payload.
 */
export function buildRedeemVaaTx(client: WaterXClient, params: BuildRedeemVaaParams): Transaction {
  const tx = params.tx ?? new Transaction();
  const req = redeemVaa(client, tx, params);
  consumeCreditDeposit(client, tx, { depositRequest: req, creditType: params.creditType });
  return tx;
}

export type CreditWithdrawRoute =
  | ({ kind: "wormhole" } & RouteWormholeParams)
  | { kind: "native"; assetType: string };

export interface BuildRequestCreditWithdrawParams {
  accountId: string;
  amount: bigint | number;
  /** Sui-side recipient (honored for native payouts; ignored for wormhole). */
  recipient: string;
  route: CreditWithdrawRoute;
  creditType?: string;
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/**
 * Withdraw (user side): encode the route, `account::request_withdraw<CREDIT>`,
 * then `withdrawal_queue::enqueue<CREDIT>` — all in one PTB. A keeper later
 * drains the parked entry via {@link buildExecuteWithdrawalTx}.
 */
export function buildRequestCreditWithdrawTx(
  client: WaterXClient,
  params: BuildRequestCreditWithdrawParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  const route =
    params.route.kind === "wormhole"
      ? routeWormhole(client, tx, params.route)
      : routeNative(client, tx, { assetType: params.route.assetType });
  const wreq = requestCreditWithdraw(client, tx, {
    accountId: params.accountId,
    amount: params.amount,
    recipient: params.recipient,
    route,
    creditType: params.creditType,
    bucketAccount: params.bucketAccount,
  });
  enqueueWithdrawal(client, tx, { withdrawRequest: wreq, creditType: params.creditType });
  return tx;
}

export type ExecuteWithdrawalRoute =
  | { kind: "wormhole"; wormholeFeeAmount?: bigint }
  | { kind: "native"; assetType: string };

export interface BuildExecuteWithdrawalParams {
  /** Queue entry key (from the `Enqueued` event). */
  key: bigint | number;
  route: ExecuteWithdrawalRoute;
  creditType?: string;
  /** Executor identity (must be on the queue allowlist). Defaults to tx sender. */
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/**
 * Keeper: drain one parked queue entry. Wormhole route auto-splits the
 * Wormhole message fee off `tx.gas` (`wormholeFeeAmount`, default 0n —
 * raise it if the configured `WormholeState.message_fee` is non-zero).
 */
export function buildExecuteWithdrawalTx(
  client: WaterXClient,
  params: BuildExecuteWithdrawalParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (params.route.kind === "wormhole") {
    const fee = tx.splitCoins(tx.gas, [tx.pure.u64(params.route.wormholeFeeAmount ?? 0n)])[0]!;
    executeWithdrawalWormhole(client, tx, {
      key: params.key,
      wormholeFee: fee,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  } else {
    executeWithdrawalNative(client, tx, {
      key: params.key,
      assetType: params.route.assetType,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  }
  return tx;
}

// ============================================================================
// Re-exports
// ============================================================================

export {
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
  updatePythPrices,
};
