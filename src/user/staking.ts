/**
 * Staking builders for `waterx_staking::waterx_staking`.
 *
 * Deposit / redeem produce a "checker" hot potato keyed by the set of
 * rewarders configured on the pool. The PTB shape is:
 *
 *   checker = deposit(...) | redeem(...)
 *   for each rewarder_R:
 *     settle_rewarder_on_<deposit|withdraw><STAKE, R>(checker, pool, clock)
 *   destroy_<deposit|withdraw>_checker(checker)
 *
 * `claim<STAKE, R>` is single-call (no checker).
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import * as staking from "../generated/waterx_staking/waterx_staking.ts";
import { makeSenderRequest } from "../utils/account-request.ts";

function pool(client: WaterXClient): string {
  const id = client.config.packages.waterx_staking?.staking_pool;
  if (!id) throw new Error("config.objects.stakingPool is not set");
  return id;
}

// ============================================================================
// Stake (deposit) — with optional rewarder settlement
// ============================================================================

export interface StakeParams {
  accountId: string;
  /** Fully-qualified `STAKE` coin type (e.g. WLP). */
  stakeType: string;
  /** Amount to take from the wxa account into the staking pool. */
  stakeAmount: bigint | number;
  /** Rewarder types to settle on this deposit. Order matters and must match the pool's `rewarder_ids` set on-chain. */
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

export function stake(client: WaterXClient, tx: Transaction, params: StakeParams): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [checker] = staking.deposit({
    package: client.config.packages.waterx_staking?.published_at,
    arguments: {
      self: tx.object(pool(client)),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      accReq: req as unknown as string,
      stakeAmount: params.stakeAmount,
    },
    typeArguments: [params.stakeType],
  })(tx);

  for (const r of params.rewarderTypes ?? []) {
    staking.settleRewarderOnDeposit({
      package: client.config.packages.waterx_staking?.published_at,
      arguments: {
        checker: checker as unknown as string,
        self: tx.object(pool(client)),
      },
      typeArguments: [params.stakeType, r],
    })(tx);
  }

  staking.destroyDepositChecker({
    package: client.config.packages.waterx_staking?.published_at,
    arguments: { checker: checker as unknown as string },
    typeArguments: [params.stakeType],
  })(tx);
}

// ============================================================================
// Unstake (redeem)
// ============================================================================

export interface UnstakeParams {
  accountId: string;
  stakeType: string;
  withdrawalAmount: bigint | number;
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

export function unstake(client: WaterXClient, tx: Transaction, params: UnstakeParams): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [checker] = staking.redeem({
    package: client.config.packages.waterx_staking?.published_at,
    arguments: {
      self: tx.object(pool(client)),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      accReq: req as unknown as string,
      withdrawalAmount: params.withdrawalAmount,
    },
    typeArguments: [params.stakeType],
  })(tx);

  for (const r of params.rewarderTypes ?? []) {
    staking.settleRewarderOnWithdraw({
      package: client.config.packages.waterx_staking?.published_at,
      arguments: {
        checker: checker as unknown as string,
        self: tx.object(pool(client)),
      },
      typeArguments: [params.stakeType, r],
    })(tx);
  }

  staking.destroyWithdrawChecker({
    package: client.config.packages.waterx_staking?.published_at,
    arguments: { checker: checker as unknown as string },
    typeArguments: [params.stakeType],
  })(tx);
}

// ============================================================================
// Claim
// ============================================================================

export interface ClaimRewardParams {
  accountId: string;
  stakeType: string;
  /** Reward coin type to claim. */
  rewardType: string;
  bucketAccount?: string | TransactionArgument;
}

export function claimReward(
  client: WaterXClient,
  tx: Transaction,
  params: ClaimRewardParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  staking.claim({
    package: client.config.packages.waterx_staking?.published_at,
    arguments: {
      self: tx.object(pool(client)),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      request: req as unknown as string,
    },
    typeArguments: [params.stakeType, params.rewardType],
  })(tx);
}
