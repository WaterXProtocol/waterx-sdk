import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../client.ts";
import { request as accountRequestCall } from "../generated/bucket_v2_framework/account.ts";
import { fromScaledVal as floatFromScaledValCall } from "../generated/bucket_v2_framework/float.ts";
import { positionId as positionIdCall } from "../generated/waterx_perp/response.ts";
import {
  closePositionRequest as closePositionRequestCall,
  decreasePositionRequest as decreasePositionRequestCall,
  depositCollateralRequest as depositCollateralRequestCall,
  destroyResponse as destroyResponseCall,
  execute as executeCall,
  increasePositionRequest as increasePositionRequestCall,
  liquidateRequest as liquidateRequestCall,
  matchOrders as matchOrdersCall,
  openPositionRequest as openPositionRequestCall,
  placeOrderRequest as placeOrderRequestCall,
  updateFundingRateV2 as updateFundingRateCall,
  withdrawCollateralRequest as withdrawCollateralRequestCall,
} from "../generated/waterx_perp/trading.ts";
import { transferCoin as transferCoinCall } from "../generated/waterx_perp/user_account.ts";
import { buildReceivingVector, type CoinForReceiving } from "../utils/receiving.ts";
import { reimburseSponsorFund } from "../utils/sponsor.ts";

// Re-export CoinForReceiving from utils for backward compat
export type { CoinForReceiving } from "../utils/receiving.ts";

/**
 * Creates an AccountRequest from the transaction sender.
 * All trading and keeper functions require this.
 */
function createAccountRequest(tx: Transaction, bucketFrameworkPkg: string): TransactionArgument {
  const [request] = accountRequestCall({ package: bucketFrameworkPkg })(tx);
  return request;
}

/** Executes a TradingRequest. Returns [changeCoin, response]. */
export function executeTradingRequest(
  client: WaterXClient,
  tx: Transaction,
  params: {
    collateralTokenType: string;
    baseTokenType: string;
    lpTokenType: string;
    market: string;
    request: TransactionArgument;
    basePriceResult: TransactionArgument;
    collateralPriceResult: TransactionArgument;
  },
): [TransactionArgument, TransactionArgument] {
  const [coin, response] = executeCall({
    package: client.config.packageId,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      pool: client.config.wlpPool,
      req: params.request,
      priceResult: params.basePriceResult,
      collateralPriceResult: params.collateralPriceResult,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);
  return [coin, response];
}

/** Destroys a TradingResponse. */
export function destroyTradingResponse(
  client: WaterXClient,
  tx: Transaction,
  params: {
    baseTokenType: string;
    lpTokenType: string;
    market: string;
    response: TransactionArgument;
  },
): void {
  destroyResponseCall({
    package: client.config.packageId,
    arguments: {
      GlobalConfig: client.config.globalConfig,
      market: params.market,
      response: params.response,
    },
    typeArguments: [params.baseTokenType, params.lpTokenType],
  })(tx);
}

/** Common 3-step suffix: reimburse sponsor → execute → destroy_response → transfer coin to account. */
function executeAndDestroy(
  tx: Transaction,
  client: WaterXClient,
  params: {
    collateralTokenType: string;
    baseTokenType: string;
    lpTokenType: string;
    market: string;
    accountId: string;
    request: TransactionArgument;
    basePriceResult: TransactionArgument;
    collateralPriceResult: TransactionArgument;
    isRecipient?: boolean;
    sponsorFund?: TransactionArgument;
  },
): void {
  const pkg = client.config.packageId;

  reimburseSponsorFund(client, tx, params.sponsorFund, params.request, params.collateralTokenType);

  const [coin, response] = executeCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      pool: client.config.wlpPool,
      req: params.request,
      priceResult: params.basePriceResult,
      collateralPriceResult: params.collateralPriceResult,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  destroyResponseCall({
    package: pkg,
    arguments: {
      GlobalConfig: client.config.globalConfig,
      market: params.market,
      response,
    },
    typeArguments: [params.baseTokenType, params.lpTokenType],
  })(tx);

  if (params.isRecipient) {
    tx.transferObjects([coin], params.accountId);
  } else {
    transferCoinCall({
      package: pkg,
      arguments: {
        registry: client.config.accountRegistry,
        accountId: params.accountId,
        coin,
      },
      typeArguments: [params.collateralTokenType],
    })(tx);
  }
}

// ======== Open Position ========

/** TP/SL order params for attaching to an open position in the same PTB. */
export interface TpSlOrderParams {
  /** Trigger price as 1e9-scaled bigint (e.g. 75000_000_000_000n for $75K). */
  triggerPrice: bigint;
  /** Size of the TP/SL order. Uses position size if omitted (full close). */
  size?: bigint | number | TransactionArgument;
  /** Collateral for the order (raw units). Usually 0 for reduce-only. */
  collateralAmount?: bigint | number;
  /** Coins to receive for collateral. Usually empty for reduce-only. */
  receivingCoins?: CoinForReceiving[];
}

export interface OpenPositionParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  receivingCoins: CoinForReceiving[];
  collateralAmount: bigint | number;
  isLong: boolean;
  size: bigint | number | TransactionArgument;
  acceptablePrice?: bigint;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  /** Take-profit order — placed as reduce-only limit order linked to the new position. */
  takeProfit?: TpSlOrderParams;
  /** Stop-loss order — placed as reduce-only stop order linked to the new position. */
  stopLoss?: TpSlOrderParams;
  /** Sponsor fund for Pyth fee reimbursement. */
  sponsorFund?: TransactionArgument;
}

export function openPosition(
  client: WaterXClient,
  tx: Transaction,
  params: OpenPositionParams,
): Transaction {
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);
  const receivingVec = buildReceivingVector(tx, params.receivingCoins, params.collateralTokenType);

  const [request] = openPositionRequestCall({
    package: client.config.packageId,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      receivings: receivingVec,
      collateralAmount: BigInt(params.collateralAmount),
      isLong: params.isLong,
      size:
        typeof params.size === "bigint" || typeof params.size === "number"
          ? BigInt(params.size)
          : params.size,
      acceptablePrice: params.acceptablePrice ?? 0n,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  reimburseSponsorFund(client, tx, params.sponsorFund, request, params.collateralTokenType);

  const [coin, response] = executeTradingRequest(client, tx, { ...params, request });

  const [positionIdOpt] = positionIdCall({
    package: client.config.packageId,
    arguments: {
      self: response,
    },
  })(tx);
  const [positionId] = tx.moveCall({
    target: `0x1::option::destroy_some`,
    typeArguments: ["u64"],
    arguments: [positionIdOpt],
  });

  destroyTradingResponse(client, tx, {
    baseTokenType: params.baseTokenType,
    lpTokenType: params.lpTokenType,
    market: params.market,
    response,
  });

  transferCoinCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      accountId: params.accountId,
      coin,
    },
    typeArguments: [params.collateralTokenType],
  })(tx);

  // Place TP/SL orders linked to the new position
  if (params.takeProfit) {
    placeTpSlOrder(client, tx, params, positionId, params.takeProfit, false);
  }
  if (params.stopLoss) {
    placeTpSlOrder(client, tx, params, positionId, params.stopLoss, true);
  }

  return tx;
}

/** Internal: places a TP or SL order linked to a position. */
function placeTpSlOrder(
  client: WaterXClient,
  tx: Transaction,
  positionParams: OpenPositionParams,
  linkedPositionId: TransactionArgument,
  order: TpSlOrderParams,
  isStopOrder: boolean,
): void {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);
  const [triggerPriceFloat] = floatFromScaledValCall({
    package: fwPkg,
    arguments: { v: order.triggerPrice },
  })(tx);

  const receivingCoins = order.receivingCoins ?? [];
  const receivingVec = buildReceivingVector(tx, receivingCoins, positionParams.collateralTokenType);

  const size =
    order.size !== undefined
      ? typeof order.size === "bigint" || typeof order.size === "number"
        ? BigInt(order.size)
        : order.size
      : positionParams.size;

  const [request] = placeOrderRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: positionParams.market,
      senderRequest,
      accountObjectAddress: positionParams.accountId,
      receivings: receivingVec,
      collateralAmount: BigInt(order.collateralAmount ?? 0),
      isLong: !positionParams.isLong,
      isStopOrder,
      reduceOnly: true,
      size,
      triggerPrice: triggerPriceFloat,
      linkedPositionId: tx.moveCall({
        target: "0x1::option::some",
        typeArguments: ["u64"],
        arguments: [linkedPositionId],
      })[0],
    },
    typeArguments: [
      positionParams.collateralTokenType,
      positionParams.baseTokenType,
      positionParams.lpTokenType,
    ],
  })(tx);

  const [orderCoin, orderResponse] = executeTradingRequest(client, tx, {
    ...positionParams,
    request,
  });

  destroyTradingResponse(client, tx, {
    baseTokenType: positionParams.baseTokenType,
    lpTokenType: positionParams.lpTokenType,
    market: positionParams.market,
    response: orderResponse,
  });

  transferCoinCall({
    package: pkg,
    arguments: {
      registry: client.config.accountRegistry,
      accountId: positionParams.accountId,
      coin: orderCoin,
    },
    typeArguments: [positionParams.collateralTokenType],
  })(tx);
}

// ======== Open Position By Manager (Keeper) ========

export interface OpenPositionByManagerParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  /** The user account address the position will belong to */
  accountId: string;
  /** A Coin<C_TOKEN> object ID or TransactionArgument — the entire coin is consumed as collateral */
  collateralCoin: string | TransactionArgument;
  isLong: boolean;
  size: bigint | number | TransactionArgument;
  acceptablePrice?: bigint;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function openPositionByManager(
  client: WaterXClient,
  tx: Transaction,
  params: OpenPositionByManagerParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);
  const collateralCoinArg =
    typeof params.collateralCoin === "string"
      ? tx.object(params.collateralCoin)
      : params.collateralCoin;

  const [request] = tx.moveCall({
    target: `${pkg}::trading::open_position_request_by_keeper`,
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
    arguments: [
      tx.object(client.config.globalConfig),
      tx.object(client.config.accountRegistry),
      tx.object(params.market),
      senderRequest,
      tx.pure.address(params.accountId),
      collateralCoinArg,
      tx.pure.bool(params.isLong),
      typeof params.size === "bigint" || typeof params.size === "number"
        ? tx.pure.u64(BigInt(params.size))
        : params.size,
      tx.pure.u64(params.acceptablePrice ?? 0n),
    ],
  });

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Close Position ========

export interface ClosePositionParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  positionId: bigint | number;
  acceptablePrice?: bigint;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function closePosition(
  client: WaterXClient,
  tx: Transaction,
  params: ClosePositionParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [request] = closePositionRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      positionId: BigInt(params.positionId),
      acceptablePrice: params.acceptablePrice ?? 0n,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Increase Position (add collateral + increase size) ========

export interface IncreasePositionParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  positionId: bigint | number;
  receivingCoins: CoinForReceiving[];
  collateralAmount: bigint | number;
  size: bigint | number | TransactionArgument;
  acceptablePrice?: bigint;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function increasePosition(
  client: WaterXClient,
  tx: Transaction,
  params: IncreasePositionParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);
  const receivingVec = buildReceivingVector(tx, params.receivingCoins, params.collateralTokenType);

  const [request] = increasePositionRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      positionId: BigInt(params.positionId),
      receivings: receivingVec,
      collateralAmount: BigInt(params.collateralAmount),
      size:
        typeof params.size === "bigint" || typeof params.size === "number"
          ? BigInt(params.size)
          : params.size,
      acceptablePrice: params.acceptablePrice ?? 0n,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Decrease Position (reduce size) ========

export interface DecreasePositionParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  positionId: bigint | number;
  size: bigint | number;
  acceptablePrice?: bigint;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function decreasePosition(
  client: WaterXClient,
  tx: Transaction,
  params: DecreasePositionParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [request] = decreasePositionRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      positionId: BigInt(params.positionId),
      size:
        typeof params.size === "bigint" || typeof params.size === "number"
          ? BigInt(params.size)
          : params.size,
      acceptablePrice: params.acceptablePrice ?? 0n,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Deposit Collateral (add collateral without changing size) ========

export interface DepositCollateralParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  positionId: bigint | number;
  receivingCoins: CoinForReceiving[];
  collateralAmount: bigint | number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function depositCollateral(
  client: WaterXClient,
  tx: Transaction,
  params: DepositCollateralParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);
  const receivingVec = buildReceivingVector(tx, params.receivingCoins, params.collateralTokenType);

  const [request] = depositCollateralRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      positionId: BigInt(params.positionId),
      receivings: receivingVec,
      collateralAmount: BigInt(params.collateralAmount),
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Withdraw Collateral (remove collateral without changing size) ========

export interface WithdrawCollateralParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  positionId: bigint | number;
  amount: bigint | number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function withdrawCollateral(
  client: WaterXClient,
  tx: Transaction,
  params: WithdrawCollateralParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [request] = withdrawCollateralRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      positionId: BigInt(params.positionId),
      amount: BigInt(params.amount),
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, { ...params, request, sponsorFund: params.sponsorFund });
  return tx;
}

// ======== Liquidate ========

export interface LiquidateParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  /** Account that receives the liquidation reward (keeper's account) */
  accountId: string;
  positionId: bigint | number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function liquidate(
  client: WaterXClient,
  tx: Transaction,
  params: LiquidateParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [request] = liquidateRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      market: params.market,
      senderRequest,
      positionId: BigInt(params.positionId),
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  executeAndDestroy(tx, client, {
    ...params,
    request,
    isRecipient: true,
    sponsorFund: params.sponsorFund,
  });
  return tx;
}

// ======== Match Orders (Keeper) ========

export interface MatchOrdersParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  orderTypeTag: number;
  triggerPrice: bigint;
  maxFills: bigint | number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
}

export function matchOrders(
  client: WaterXClient,
  tx: Transaction,
  params: MatchOrdersParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  matchOrdersCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      pool: client.config.wlpPool,
      senderRequest,
      priceResult: params.basePriceResult,
      collateralPriceResult: params.collateralPriceResult,
      orderTypeTag: params.orderTypeTag,
      triggerPrice: BigInt(params.triggerPrice),
      maxFills: BigInt(params.maxFills),
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  return tx;
}

// ======== Update Funding Rate (Keeper) ========

export interface UpdateFundingRateParams {
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  basePriceResult: TransactionArgument;
}

export function updateFundingRate(
  client: WaterXClient,
  tx: Transaction,
  params: UpdateFundingRateParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  updateFundingRateCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      market: params.market,
      pool: client.config.wlpPool,
      priceResult: params.basePriceResult,
      senderRequest,
    },
    typeArguments: [params.baseTokenType, params.lpTokenType],
  })(tx);
  return tx;
}
