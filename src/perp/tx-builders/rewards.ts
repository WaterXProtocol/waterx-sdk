/**
 * High-level reward composer: claim every accrued staking reward to the wxa
 * account (TTO). The account owner collects each coin via `wxa_account::receive`
 * in a separate user action.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { PerpClient } from "../client.ts";
import { claimReward } from "../user/staking.ts";
import { newTx, type CommonBuildOpts } from "./common.ts";

export interface BuildClaimRewardsToAccountParams extends CommonBuildOpts {
  accountId: string;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
  /** Fully-qualified stake coin type. Defaults to `client.wlpType()`. */
  stakeType?: string;
  /**
   * Reward coin types to claim. Defaults to every rewarder configured for the
   * stake pool in `waterx_staking.rewarders[stakeAlias]`.
   */
  rewarderTypes?: string[];
  bucketAccount?: string | TransactionArgument;
}

/**
 * Claims every accrued reward for `accountId` on the given stake pool. Each
 * resulting `Coin<R>` is TTO'd to the wxa account's UID address via
 * `wxa_account::transfer_coin<R>` (the default behaviour of the Move
 * `staking::claim` entry — no deposit-policy registration required for the
 * reward token). The account owner collects each coin via
 * `wxa_account::receive` in a separate user action.
 */
export function buildClaimRewardsToAccountTx(
  client: PerpClient,
  params: BuildClaimRewardsToAccountParams,
): Transaction {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";
  const stakeType = params.stakeType ?? client.wlpType();
  const rewarderTypes = params.rewarderTypes ?? client.getRewarderTypes(stakeAlias);
  if (rewarderTypes.length === 0) {
    throw new Error(
      `buildClaimRewardsToAccountTx: no rewarders configured for stakeAlias=${stakeAlias}`,
    );
  }

  for (const rewardType of rewarderTypes) {
    claimReward(client, tx, {
      accountId: params.accountId,
      stakeAlias,
      stakeType,
      rewardType,
      bucketAccount: params.bucketAccount,
    });
  }

  return tx;
}
