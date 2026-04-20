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
  claim as claimCall,
  deposit as depositCall,
  destroyDepositChecker as destroyDepositCheckerCall,
  destroyWithdrawChecker as destroyWithdrawCheckerCall,
  redeem as redeemCall,
  settleRewarderOnDeposit as settleRewarderOnDepositCall,
  settleRewarderOnWithdraw as settleRewarderOnWithdrawCall,
} from "../generated/reward_distributor/reward_distributor.ts";

function resolveRewardDistributorPackageId(client: WaterXClient, packageId?: string): string {
  const resolved = packageId ?? client.config.rewardDistributorPackageId;
  if (!resolved) {
    throw new Error(
      "Reward distributor package ID is required. Pass params.packageId or set client.config.rewardDistributorPackageId.",
    );
  }
  return resolved;
}

function resolveRewardDistributorId(client: WaterXClient, distributorId?: string): string {
  const resolved = distributorId ?? client.config.rewardDistributorId;
  if (!resolved) {
    throw new Error(
      "Reward distributor ID is required. Pass params.distributorId or set client.config.rewardDistributorId.",
    );
  }
  return resolved;
}

function resolveRewardTokenType(client: WaterXClient, rewardTokenType?: string): string {
  const resolved = rewardTokenType ?? client.config.rewardDistributorRewardTokenTypes?.[0];
  if (!resolved) {
    throw new Error(
      "Reward token type is required. Pass params.rewardTokenType or set client.config.rewardDistributorRewardTokenTypes.",
    );
  }
  return resolved;
}

function resolveBucketFrameworkPackageId(client: WaterXClient): string {
  if (!client.config.bucketFrameworkPackageId) {
    throw new Error(
      "Bucket framework package ID is required for reward distributor operations that use AccountRequest.",
    );
  }
  return client.config.bucketFrameworkPackageId;
}

function resolveRewardTokenTypes(client: WaterXClient, rewardTokenTypes?: string[]): string[] {
  return [...new Set(rewardTokenTypes ?? client.config.rewardDistributorRewardTokenTypes ?? [])];
}

function resolveTransferRecipient(tx: Transaction, recipient?: string): string {
  const resolved = recipient ?? tx.getData().sender ?? undefined;
  if (!resolved) {
    throw new Error(
      "Recipient address is required. Pass params.recipient or call tx.setSender(...) before claim/unstake.",
    );
  }
  return resolved;
}

/**
 * Builds the `AccountRequest` consumed by reward_distributor functions.
 * - When `bucketAccount` is omitted: identity is the wallet sender (`account::request`).
 * - When provided: identity is the Bucket Account object address
 *   (`account::request_with_account(&Account)`), letting shared/multi-sig accounts
 *   stake into a different stake position than `tx.sender`.
 *
 * The identity used at deposit/redeem/claim time must match: stakes credited via
 * Bucket Account can only be redeemed/claimed via the same Bucket Account.
 */
function buildAccountRequest(
  tx: Transaction,
  bucketFrameworkPkg: string,
  bucketAccount?: string | TransactionArgument,
): TransactionArgument {
  if (bucketAccount === undefined) {
    const [request] = accountRequestCall({ package: bucketFrameworkPkg })(tx);
    return request;
  }
  const accountArg = typeof bucketAccount === "string" ? tx.object(bucketAccount) : bucketAccount;
  const [request] = accountRequestWithAccountCall({
    package: bucketFrameworkPkg,
    arguments: { account: accountArg },
  })(tx);
  return request;
}

export interface StakeRewardDistributorParams {
  /** Shared RewardDistributor object ID */
  distributorId?: string;
  /** Full coin type string for the staked asset */
  stakeTokenType: string;
  /** Coin<STAKE> object ID or TransactionArgument */
  stakeCoin: string | TransactionArgument;
  /**
   * Reward coin types active on this distributor.
   * Each rewarder must be settled before the deposit checker is destroyed.
   */
  rewardTokenTypes?: string[];
  /** Optional override for the reward_distributor package ID */
  packageId?: string;
  /**
   * Optional `bucket_v2_framework::account::Account` object id (or PTB arg) to use
   * as the staking identity. When omitted, the stake is credited to the tx sender.
   * Must match the identity used for later redeem/claim of the same position.
   */
  bucketAccount?: string | TransactionArgument;
}

/**
 * Stakes a coin into a reward distributor and settles the listed rewarders.
 * `rewardTokenTypes` must cover every active rewarder on the distributor.
 */
export function stakeRewardDistributor(
  client: WaterXClient,
  tx: Transaction,
  params: StakeRewardDistributorParams,
): Transaction {
  const packageId = resolveRewardDistributorPackageId(client, params.packageId);
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const frameworkPackageId = resolveBucketFrameworkPackageId(client);
  const stakeCoinArg =
    typeof params.stakeCoin === "string" ? tx.object(params.stakeCoin) : params.stakeCoin;
  const rewardTokenTypes = resolveRewardTokenTypes(client, params.rewardTokenTypes);
  const senderRequest = buildAccountRequest(tx, frameworkPackageId, params.bucketAccount);

  const [checker] = depositCall({
    package: packageId,
    arguments: {
      self: distributorId,
      coin: stakeCoinArg,
      accReq: senderRequest,
    },
    typeArguments: [params.stakeTokenType],
  })(tx);

  for (const rewardTokenType of rewardTokenTypes) {
    settleRewarderOnDepositCall({
      package: packageId,
      arguments: {
        checker,
        self: distributorId,
      },
      typeArguments: [params.stakeTokenType, rewardTokenType],
    })(tx);
  }

  destroyDepositCheckerCall({
    package: packageId,
    arguments: {
      checker,
    },
    typeArguments: [params.stakeTokenType],
  })(tx);

  return tx;
}

export interface UnstakeRewardDistributorParams {
  /** Shared RewardDistributor object ID */
  distributorId?: string;
  /** Full coin type string for the staked asset */
  stakeTokenType: string;
  /** Requested unstake amount in raw units */
  withdrawalAmount: bigint | number;
  /**
   * Reward coin types active on this distributor.
   * Each rewarder must be settled before the withdraw checker is destroyed.
   */
  rewardTokenTypes?: string[];
  /**
   * Recipient for the redeemed stake coin.
   * If omitted, `tx.getData().sender` must already be set.
   */
  recipient?: string;
  /** Optional override for the reward_distributor package ID */
  packageId?: string;
  /**
   * Optional `bucket_v2_framework::account::Account` object id (or PTB arg) — must
   * match the identity used to stake into this position. Omit to redeem under the
   * wallet sender's identity.
   */
  bucketAccount?: string | TransactionArgument;
}

export type RedeemRewardDistributorCoinParams = Omit<UnstakeRewardDistributorParams, "recipient">;

/**
 * Redeems stake immediately from the reward distributor and returns the
 * Coin<STAKE> so later PTB commands can consume it.
 * `rewardTokenTypes` must cover every active rewarder on the distributor.
 */
export function redeemRewardDistributorCoin(
  client: WaterXClient,
  tx: Transaction,
  params: RedeemRewardDistributorCoinParams,
): TransactionObjectArgument {
  const packageId = resolveRewardDistributorPackageId(client, params.packageId);
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const frameworkPackageId = resolveBucketFrameworkPackageId(client);
  const rewardTokenTypes = resolveRewardTokenTypes(client, params.rewardTokenTypes);
  const senderRequest = buildAccountRequest(tx, frameworkPackageId, params.bucketAccount);

  const [stakeCoin, checker] = redeemCall({
    package: packageId,
    arguments: {
      self: distributorId,
      withdrawalAmount: BigInt(params.withdrawalAmount),
      accReq: senderRequest,
    },
    typeArguments: [params.stakeTokenType],
  })(tx);

  for (const rewardTokenType of rewardTokenTypes) {
    settleRewarderOnWithdrawCall({
      package: packageId,
      arguments: {
        checker,
        self: distributorId,
      },
      typeArguments: [params.stakeTokenType, rewardTokenType],
    })(tx);
  }

  destroyWithdrawCheckerCall({
    package: packageId,
    arguments: {
      checker,
    },
    typeArguments: [params.stakeTokenType],
  })(tx);

  return stakeCoin;
}

/**
 * Redeems stake immediately from the reward distributor.
 * `rewardTokenTypes` must cover every active rewarder on the distributor.
 */
export function unstakeRewardDistributor(
  client: WaterXClient,
  tx: Transaction,
  params: UnstakeRewardDistributorParams,
): Transaction {
  const recipient = resolveTransferRecipient(tx, params.recipient);
  const stakeCoin = redeemRewardDistributorCoin(client, tx, params);
  tx.transferObjects([stakeCoin], recipient);

  return tx;
}

export interface ClaimRewardDistributorParams {
  /** Shared RewardDistributor object ID */
  distributorId?: string;
  /** Full coin type string for the staked asset */
  stakeTokenType: string;
  /** Full coin type string for the reward asset */
  rewardTokenType?: string;
  /**
   * Recipient for the claimed reward coin.
   * If omitted, `tx.getData().sender` must already be set.
   */
  recipient?: string;
  /** Optional override for the reward_distributor package ID */
  packageId?: string;
  /**
   * Optional `bucket_v2_framework::account::Account` object id (or PTB arg) — must
   * match the identity used to stake the position whose rewards are being claimed.
   */
  bucketAccount?: string | TransactionArgument;
}

/**
 * Claims accrued rewards for the transaction sender.
 */
export function claimRewardDistributor(
  client: WaterXClient,
  tx: Transaction,
  params: ClaimRewardDistributorParams,
): Transaction {
  const packageId = resolveRewardDistributorPackageId(client, params.packageId);
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const rewardTokenType = resolveRewardTokenType(client, params.rewardTokenType);
  const frameworkPackageId = resolveBucketFrameworkPackageId(client);
  const recipient = resolveTransferRecipient(tx, params.recipient);
  const senderRequest = buildAccountRequest(tx, frameworkPackageId, params.bucketAccount);

  const [rewardCoin] = claimCall({
    package: packageId,
    arguments: {
      self: distributorId,
      request: senderRequest,
    },
    typeArguments: [params.stakeTokenType, rewardTokenType],
  })(tx);

  tx.transferObjects([rewardCoin], recipient);

  return tx;
}
