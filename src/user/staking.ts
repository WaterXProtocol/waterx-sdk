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
 *
 * Each builder takes a `stakeAlias` (e.g. `"WLP"`) that keys into
 * `config.packages.waterx_staking.pools` to find the actual
 * `StakingPool<STAKE>` shared object.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import * as staking from "../generated/waterx_staking/waterx_staking.ts";
import { makeSenderRequest } from "../utils/account-request.ts";

function pool(client: WaterXClient, stakeAlias: string): string {
  const id = client.config.packages.waterx_staking?.pools?.[stakeAlias];
  if (!id) {
    throw new Error(
      `config.packages.waterx_staking.pools[${stakeAlias}] is not set — staking is not deployed for this stake type`,
    );
  }
  return id;
}

function stakingPackage(client: WaterXClient): string {
  const pkg = client.config.packages.waterx_staking?.published_at;
  if (!pkg) throw new Error("config.packages.waterx_staking is not configured");
  return pkg;
}

// ============================================================================
// Stake (deposit) — with optional rewarder settlement
// ============================================================================

export interface StakeParams {
  accountId: string;
  /** Stake-type alias (key into `waterx_staking.pools`, e.g. `"WLP"`). */
  stakeAlias: string;
  /** Fully-qualified `STAKE` coin type for the type argument. */
  stakeType: string;
  /**
   * Amount to take from the wxa account into the staking pool. Accepts a
   * `TransactionArgument` so callers can chain it from a previous PTB call
   * (e.g. the `lp_amount` returned by `mintWlp`).
   */
  stakeAmount: bigint | number | TransactionArgument;
  /** Rewarder types to settle on this deposit. Order matters and must match the pool's `rewarder_ids` set on-chain. */
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

export function stake(client: WaterXClient, tx: Transaction, params: StakeParams): void {
  const pkg = stakingPackage(client);
  const poolId = pool(client, params.stakeAlias);
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [checker] = staking.deposit({
    package: pkg,
    arguments: {
      self: tx.object(poolId),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      accReq: req as unknown as string,
      stakeAmount: params.stakeAmount,
    },
    typeArguments: [params.stakeType],
  })(tx);

  for (const r of params.rewarderTypes ?? []) {
    staking.settleRewarderOnDeposit({
      package: pkg,
      arguments: {
        checker: checker as unknown as string,
        self: tx.object(poolId),
      },
      typeArguments: [params.stakeType, r],
    })(tx);
  }

  staking.destroyDepositChecker({
    package: pkg,
    arguments: { checker: checker as unknown as string },
    typeArguments: [params.stakeType],
  })(tx);
}

// ============================================================================
// Unstake (redeem)
// ============================================================================

export interface UnstakeParams {
  accountId: string;
  stakeAlias: string;
  stakeType: string;
  withdrawalAmount: bigint | number | TransactionArgument;
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

export function unstake(client: WaterXClient, tx: Transaction, params: UnstakeParams): void {
  const pkg = stakingPackage(client);
  const poolId = pool(client, params.stakeAlias);
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [checker] = staking.redeem({
    package: pkg,
    arguments: {
      self: tx.object(poolId),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      accReq: req as unknown as string,
      withdrawalAmount: params.withdrawalAmount,
    },
    typeArguments: [params.stakeType],
  })(tx);

  for (const r of params.rewarderTypes ?? []) {
    staking.settleRewarderOnWithdraw({
      package: pkg,
      arguments: {
        checker: checker as unknown as string,
        self: tx.object(poolId),
      },
      typeArguments: [params.stakeType, r],
    })(tx);
  }

  staking.destroyWithdrawChecker({
    package: pkg,
    arguments: { checker: checker as unknown as string },
    typeArguments: [params.stakeType],
  })(tx);
}

// ============================================================================
// Claim
// ============================================================================

export interface ClaimRewardParams {
  accountId: string;
  stakeAlias: string;
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
  const pkg = stakingPackage(client);
  const poolId = pool(client, params.stakeAlias);
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  staking.claim({
    package: pkg,
    arguments: {
      self: tx.object(poolId),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      request: req as unknown as string,
    },
    typeArguments: [params.stakeType, params.rewardType],
  })(tx);
}
