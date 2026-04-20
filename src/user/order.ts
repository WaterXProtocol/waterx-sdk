import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../client.ts";
import { request as accountRequestCall } from "../generated/bucket_v2_framework/account.ts";
import { fromScaledVal as floatFromScaledValCall } from "../generated/bucket_v2_framework/float.ts";
import {
  cancelOrderRequest as cancelOrderRequestCall,
  destroyResponse as destroyResponseCall,
  execute as executeCall,
  placeOrderRequest as placeOrderRequestCall,
} from "../generated/waterx_perp/trading.ts";
import { transferCoin as transferCoinCall } from "../generated/waterx_perp/user_account.ts";
import { buildReceivingVector } from "../utils/receiving.ts";
import { reimburseSponsorFund } from "../utils/sponsor.ts";
import { type CoinForReceiving } from "./trading.ts";

function createAccountRequest(tx: Transaction, bucketFrameworkPkg: string): TransactionArgument {
  const [request] = accountRequestCall({ package: bucketFrameworkPkg })(tx);
  return request;
}

// ======== Place Order ========

export interface PlaceOrderParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  receivingCoins: CoinForReceiving[];
  collateralAmount: bigint | number;
  isLong: boolean;
  isStopOrder: boolean;
  reduceOnly: boolean;
  size: bigint | number | TransactionArgument;
  /**
   * Trigger price in scaled format (price * 10^9).
   * E.g., for $65,000: pass 65000_000_000_000n (65000 * 10^9).
   * This is passed to float::from_scaled_val as u128.
   */
  triggerPrice: bigint;
  linkedPositionId?: bigint | number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function placeOrder(
  client: WaterXClient,
  tx: Transaction,
  params: PlaceOrderParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [triggerPriceFloat] = floatFromScaledValCall({
    package: fwPkg,
    arguments: { v: BigInt(params.triggerPrice) },
  })(tx);

  const linkedPositionId =
    params.linkedPositionId !== undefined
      ? tx.pure.option("u64", BigInt(params.linkedPositionId))
      : tx.pure.option("u64", null);

  const receivingVec = buildReceivingVector(tx, params.receivingCoins, params.collateralTokenType);

  const [request] = placeOrderRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      receivings: receivingVec,
      collateralAmount: BigInt(params.collateralAmount),
      isLong: params.isLong,
      isStopOrder: params.isStopOrder,
      reduceOnly: params.reduceOnly,
      size:
        typeof params.size === "bigint" || typeof params.size === "number"
          ? BigInt(params.size)
          : params.size,
      triggerPrice: triggerPriceFloat,
      linkedPositionId,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  reimburseSponsorFund(client, tx, params.sponsorFund, request, params.collateralTokenType);

  // Execute
  const [coin, response] = executeCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      pool: client.config.wlpPool,
      req: request,
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

  transferCoinCall({
    package: pkg,
    arguments: {
      registry: client.config.accountRegistry,
      accountId: params.accountId,
      coin,
    },
    typeArguments: [params.collateralTokenType],
  })(tx);
  return tx;
}

// ======== Cancel Order ========

export interface CancelOrderParams {
  collateralTokenType: string;
  baseTokenType: string;
  lpTokenType: string;
  market: string;
  accountId: string;
  orderId: bigint | number;
  triggerPrice: bigint;
  orderTypeTag: number;
  basePriceResult: TransactionArgument;
  collateralPriceResult: TransactionArgument;
  sponsorFund?: TransactionArgument;
}

export function cancelOrder(
  client: WaterXClient,
  tx: Transaction,
  params: CancelOrderParams,
): Transaction {
  const pkg = client.config.packageId;
  const fwPkg = client.config.bucketFrameworkPackageId!;

  const senderRequest = createAccountRequest(tx, fwPkg);

  const [request] = cancelOrderRequestCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      senderRequest,
      accountObjectAddress: params.accountId,
      orderId: BigInt(params.orderId),
      triggerPrice: BigInt(params.triggerPrice),
      orderTypeTag: params.orderTypeTag,
    },
    typeArguments: [params.collateralTokenType, params.baseTokenType, params.lpTokenType],
  })(tx);

  reimburseSponsorFund(client, tx, params.sponsorFund, request, params.collateralTokenType);

  const [coin, response] = executeCall({
    package: pkg,
    arguments: {
      globalConfig: client.config.globalConfig,
      accountRegistry: client.config.accountRegistry,
      market: params.market,
      pool: client.config.wlpPool,
      req: request,
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

  transferCoinCall({
    package: pkg,
    arguments: {
      registry: client.config.accountRegistry,
      accountId: params.accountId,
      coin,
    },
    typeArguments: [params.collateralTokenType],
  })(tx);
  return tx;
}
