/**
 * High-level WLP composers: mint, mint+stake, unstake+request-redeem, and
 * cancel-redeem+re-stake. The staking-coupled variants keep the product
 * invariant that user-held WLP is always staked.
 */

import type { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../client.ts";
import { stake, unstake } from "../user/staking.ts";
import {
  cancelRedeemWlp,
  mintWlp,
  requestRedeemWlp,
  type CancelRedeemWlpParams,
  type MintWlpParams,
  type RequestRedeemWlpParams,
} from "../user/wlp.ts";
import { maybeConsolidate, newTx, refreshWlpPoolOracles, type CommonBuildOpts } from "./common.ts";

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
  client: PerpClient,
  params: BuildMintWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [params.depositTicker], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  mintWlp(client, tx, params);
  return tx;
}

// ============================================================================
// WLP mint + stake (atomic)
// ============================================================================

export interface BuildMintAndStakeWlpParams extends BuildMintWlpParams {
  /**
   * Staking pool alias (key into `waterx_staking.pools`). Defaults to `"WLP"`.
   */
  stakeAlias?: string;
  /**
   * Rewarder coin types to settle on the stake deposit. Order must match the
   * pool's on-chain `rewarder_ids`. Defaults to every rewarder configured for
   * the stake pool in `waterx_staking.rewarders[stakeAlias]`.
   */
  rewarderTypes?: string[];
}

/**
 * Mints WLP and immediately stakes the minted amount into the WLP staking pool
 * in the same PTB. The mint's `lp_amount` return is piped directly into the
 * `stake` call so no precision loss / dust can occur.
 *
 * Use this instead of `buildMintWlpTx` when the product flow is "deposit USD
 * and earn rewards" — un-staked WLP sitting in the wxa account's `Balance<WLP>`
 * slot earns nothing.
 */
export async function buildMintAndStakeWlpTx(
  client: PerpClient,
  params: BuildMintAndStakeWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [params.depositTicker], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  const stakeAlias = params.stakeAlias ?? "WLP";
  const lpAmount = mintWlp(client, tx, params);
  stake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    stakeAmount: lpAmount,
    rewarderTypes: params.rewarderTypes ?? client.getRewarderTypes(stakeAlias),
    bucketAccount: params.bucketAccount,
  });
  return tx;
}

// ============================================================================
// WLP unstake + request-redeem (atomic)
// ============================================================================

export interface BuildUnstakeAndRequestRedeemWlpParams
  extends Omit<RequestRedeemWlpParams, "lpAmount">, CommonBuildOpts {
  /** Amount of staked WLP to unstake and enqueue for redemption. */
  withdrawalAmount: bigint | number;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
  /**
   * Rewarder coin types to settle on unstake. Defaults to every rewarder
   * configured for the stake pool in `waterx_staking.rewarders[stakeAlias]`.
   */
  rewarderTypes?: string[];
}

/**
 * Unstakes WLP from the staking pool and immediately enqueues a redeem request
 * in the same PTB. Mirror of `buildMintAndStakeWlpTx` for withdrawals.
 *
 * Refreshes every WLP pool-token oracle by default — `request_redeem` runs
 * `assert_prices_fresh` internally, so a stale oracle would abort the PTB.
 * Pass `skipOraclePriceRefresh: true` only when the caller is composing this
 * into a larger PTB that already pre-pumps prices.
 */
export async function buildUnstakeAndRequestRedeemWlpTx(
  client: PerpClient,
  params: BuildUnstakeAndRequestRedeemWlpParams,
): Promise<Transaction> {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";

  await maybeConsolidate(client, tx, params.accountId, params);

  if (!params.skipOraclePriceRefresh) {
    await refreshWlpPoolOracles(tx, client, [], {
      cache: params.pythCache,
      lpType: params.lpType,
    });
  }

  unstake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    withdrawalAmount: params.withdrawalAmount,
    rewarderTypes: params.rewarderTypes ?? client.getRewarderTypes(stakeAlias),
    bucketAccount: params.bucketAccount,
  });

  requestRedeemWlp(client, tx, {
    accountId: params.accountId,
    redeemTokenType: params.redeemTokenType,
    lpAmount: params.withdrawalAmount,
    lpType: params.lpType,
    bucketAccount: params.bucketAccount,
  });

  return tx;
}

// ============================================================================
// WLP cancel-redeem + re-stake (atomic)
// ============================================================================

export interface BuildCancelRedeemAndStakeWlpParams extends CancelRedeemWlpParams, CommonBuildOpts {
  accountId: string;
  /**
   * WLP amount (base units) that was originally enqueued by `request_redeem`
   * and is being returned to the wxa account by `cancel_redeem` — gets
   * re-staked into the WLP staking pool in the same PTB.
   */
  stakeAmount: bigint | number;
  /** Staking pool alias. Defaults to `"WLP"`. */
  stakeAlias?: string;
  /**
   * Rewarder coin types to settle on stake. Defaults to every rewarder
   * configured for the stake pool in `waterx_staking.rewarders[stakeAlias]`.
   */
  rewarderTypes?: string[];
}

/**
 * Cancels a pending WLP redeem request and re-stakes the returned WLP in the
 * same PTB. Third partner of `buildMintAndStakeWlpTx` /
 * `buildUnstakeAndRequestRedeemWlpTx`; together they keep the product
 * invariant that user-held WLP is always staked.
 */
export function buildCancelRedeemAndStakeWlpTx(
  client: PerpClient,
  params: BuildCancelRedeemAndStakeWlpParams,
): Transaction {
  const tx = newTx(params);
  const stakeAlias = params.stakeAlias ?? "WLP";

  cancelRedeemWlp(client, tx, {
    requestId: params.requestId,
    lpType: params.lpType,
    bucketAccount: params.bucketAccount,
  });

  stake(client, tx, {
    accountId: params.accountId,
    stakeAlias,
    stakeType: params.lpType ?? client.wlpType(),
    stakeAmount: params.stakeAmount,
    rewarderTypes: params.rewarderTypes ?? client.getRewarderTypes(stakeAlias),
    bucketAccount: params.bucketAccount,
  });

  return tx;
}
