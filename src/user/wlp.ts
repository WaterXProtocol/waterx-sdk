import {
  Transaction,
  type TransactionArgument,
  type TransactionObjectArgument,
} from "@mysten/sui/transactions";

import { WaterXClient } from "../client.ts";
import {
  request as accountRequestCall,
  requestWithAccount as accountRequestWithAccountCall,
} from "../generated/bucket_v2_framework/account.ts";
import {
  cancelRedeem as cancelRedeemCall,
  mintWlp as mintWlpCall,
  requestRedeem as requestRedeemCall,
  settleRedeem as settleRedeemCall,
} from "../generated/waterx_perp/lp_pool.ts";

// ======== Mint WLP ========

export interface MintWlpCoinParams {
  /** Token type being deposited (e.g., USDC type) */
  depositTokenType: string;
  /** LP token type (WLP type) */
  lpTokenType: string;
  /** Coin<TOKEN> object ID or TransactionArgument */
  depositCoin: string | TransactionArgument;
  /** PriceResult<TOKEN> for the deposit token */
  priceResult: TransactionArgument;
  /** Minimum LP tokens to receive (slippage protection) */
  minLpAmount: bigint | number;
}

/**
 * Builds a transaction to mint WLP tokens and returns the minted Coin<LP_TOKEN>
 * so it can be used by later commands in the same PTB.
 */
export function mintWlpCoin(
  client: WaterXClient,
  tx: Transaction,
  params: MintWlpCoinParams,
): TransactionObjectArgument {
  const depositCoinArg =
    typeof params.depositCoin === "string" ? tx.object(params.depositCoin) : params.depositCoin;

  const [lpCoin] = mintWlpCall({
    package: client.config.packageId,
    arguments: {
      pool: client.config.wlpPool,
      globalConfig: client.config.globalConfig,
      deposit: depositCoinArg,
      priceResult: params.priceResult,
      minLpAmount: BigInt(params.minLpAmount),
    },
    typeArguments: [params.lpTokenType, params.depositTokenType],
  })(tx);

  return lpCoin;
}

export interface MintWlpParams extends MintWlpCoinParams {
  /** Recipient address for the minted WLP tokens */
  recipient: string;
}

/**
 * Builds a transaction to mint WLP tokens by depositing a token.
 * Mint is instant. The minted WLP is transferred to the recipient.
 */
export function mintWlp(client: WaterXClient, tx: Transaction, params: MintWlpParams): Transaction {
  const lpCoin = mintWlpCoin(client, tx, params);
  tx.transferObjects([lpCoin], params.recipient);
  return tx;
}

// ======== Request Redeem WLP ========

export interface RequestRedeemWlpParams {
  /** Token type to receive on redeem */
  redeemTokenType: string;
  /** LP token type (WLP type) */
  lpTokenType: string;
  /** Coin<LP_TOKEN> object ID or TransactionArgument */
  lpCoin: string | TransactionArgument;
  /** Recipient address for the redeemed tokens */
  recipient: string;
}

/**
 * Builds a transaction to request a WLP redeem (T+1 settlement).
 * The WLP is burned immediately; the underlying token is claimable after 24h.
 * Returns the redeem request ID.
 */
export function requestRedeemWlp(
  client: WaterXClient,
  tx: Transaction,
  params: RequestRedeemWlpParams,
): Transaction {
  const lpCoinArg = typeof params.lpCoin === "string" ? tx.object(params.lpCoin) : params.lpCoin;

  requestRedeemCall({
    package: client.config.packageId,
    arguments: {
      pool: client.config.wlpPool,
      globalConfig: client.config.globalConfig,
      lpCoin: lpCoinArg,
      recipient: params.recipient,
    },
    typeArguments: [params.lpTokenType, params.redeemTokenType],
  })(tx);
  return tx;
}

// ======== Cancel Redeem WLP ========

export interface CancelRedeemWlpParams {
  /** LP token type (WLP type) */
  lpTokenType: string;
  /** Redeem request ID */
  requestId: bigint | number;
  /**
   * Optional Bucket framework `Account` object ID (or PTB arg). When set, the
   * sender request is built via `account::request_with_account(&Account)` so
   * the identity is the Account object address. Use this when the original
   * `request_redeem` recipient was a Bucket Account (shared / multi-sig).
   * Defaults to wallet sender.
   */
  bucketAccount?: string | TransactionArgument;
}

/**
 * Cancels a pending WLP redeem request and returns the recovered `Coin<WLP>`
 * so it can be re-staked or transferred in the same PTB.
 */
export function cancelRedeemWlp(
  client: WaterXClient,
  tx: Transaction,
  params: CancelRedeemWlpParams,
): TransactionObjectArgument {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const [senderRequest] = params.bucketAccount
    ? accountRequestWithAccountCall({
        package: fwPkg,
        arguments: {
          account:
            typeof params.bucketAccount === "string"
              ? tx.object(params.bucketAccount)
              : params.bucketAccount,
        },
      })(tx)
    : accountRequestCall({ package: fwPkg })(tx);

  const [lpCoin] = cancelRedeemCall({
    package: client.config.packageId,
    arguments: {
      pool: client.config.wlpPool,
      senderRequest,
      requestId: BigInt(params.requestId),
    },
    typeArguments: [params.lpTokenType],
  })(tx);
  return lpCoin;
}

// ======== Settle Redeem WLP ========

export interface SettleRedeemWlpParams {
  /** LP token type (WLP type) */
  lpTokenType: string;
  /** Token type to receive on settlement */
  redeemTokenType: string;
  /** Redeem request ID */
  requestId: bigint | number;
  /** PriceResult<TOKEN> for the redeem token */
  priceResult: TransactionArgument;
}

/**
 * Builds a transaction to settle a pending WLP redeem request.
 * Can only be called after the settlement period (T+1).
 */
export function settleRedeemWlp(
  client: WaterXClient,
  tx: Transaction,
  params: SettleRedeemWlpParams,
): Transaction {
  settleRedeemCall({
    package: client.config.packageId,
    arguments: {
      pool: client.config.wlpPool,
      globalConfig: client.config.globalConfig,
      requestId: BigInt(params.requestId),
      priceResult: params.priceResult,
    },
    typeArguments: [params.lpTokenType, params.redeemTokenType],
  })(tx);
  return tx;
}
