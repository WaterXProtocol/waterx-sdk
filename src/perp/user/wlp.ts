/**
 * WLP pool builders for `waterx_perp::lp_pool`.
 *
 * Auth + collateral flow goes through `waterx_account::take`/`put` —
 * the user must have already deposited the input asset into their wxa
 * account (use `requestDeposit` from `./account.ts`).
 *
 * `mintWlp` / `settleRedeem` require fresh oracle prices; call
 * `refreshOraclePrices` (see `oracle/`) for every pool token
 * before invoking these builders in the same PTB.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import { makeSenderRequest } from "../../account/account-request.ts";
import * as lp from "../../generated/waterx_perp/lp_pool.ts";
import type { PerpClient } from "../client.ts";

// ============================================================================
// mint_wlp
// ============================================================================

export interface MintWlpParams {
  /** wxa account holding the input balance and receiving the minted WLP. */
  accountId: string;
  /** Input asset coin type (e.g. USDC). */
  depositTokenType: string;
  /** Defaults to `client.wlpType()`. */
  lpType?: string;
  /** Amount of `depositTokenType` to draw from the wxa account. */
  depositAmount: bigint | number;
  /** Slippage floor for minted LP amount. */
  minLpAmount: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

/** Returns the minted `lp_amount` so it can be chained into e.g. `stake`. */
export function mintWlp(
  client: PerpClient,
  tx: Transaction,
  params: MintWlpParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const lpAmount = lp.mintWlp({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      aum: tx.object(requireWlpAum(client)),
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      depositAmount: params.depositAmount,
      minLpAmount: params.minLpAmount,
      oracle: tx.object(client.config.packages.waterx_oracle.oracle),
    },
    typeArguments: [params.lpType ?? client.wlpType(), params.depositTokenType],
  })(tx);
  return lpAmount;
}

function requireWlpAum(client: PerpClient): string {
  const aum = client.config.packages.wlp.wlp_aum;
  if (!aum) {
    throw new Error("wlp.wlp_aum is not configured — mintWlp/settleRedeem require WlpAum");
  }
  return aum;
}

// ============================================================================
// request_redeem
// ============================================================================

export interface RequestRedeemWlpParams {
  accountId: string;
  /** Defaults to `client.wlpType()`. */
  lpType?: string;
  /** Token type to settle the redeem into (must match `lp_pool` settings). */
  redeemTokenType: string;
  /** Amount of LP tokens to enqueue. */
  lpAmount: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function requestRedeemWlp(
  client: PerpClient,
  tx: Transaction,
  params: RequestRedeemWlpParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  lp.requestRedeem({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as TransactionArgument,
      accountId: params.accountId,
      lpAmount: params.lpAmount,
    },
    typeArguments: [params.lpType ?? client.wlpType(), params.redeemTokenType],
  })(tx);
}

// ============================================================================
// cancel_redeem
// ============================================================================

export interface CancelRedeemWlpParams {
  requestId: bigint | number;
  lpType?: string;
  bucketAccount?: string | TransactionArgument;
}

export function cancelRedeemWlp(
  client: PerpClient,
  tx: Transaction,
  params: CancelRedeemWlpParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  lp.cancelRedeem({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as TransactionArgument,
      requestId: params.requestId,
    },
    typeArguments: [params.lpType ?? client.wlpType()],
  })(tx);
}

// ============================================================================
// settle_redeem (operator-side)
// ============================================================================

export interface SettleRedeemWlpParams {
  requestId: bigint | number;
  redeemTokenType: string;
  lpType?: string;
  /** Optional Bucket Account for the operator caller. */
  bucketAccount?: string | TransactionArgument;
}

export function settleRedeemWlp(
  client: PerpClient,
  tx: Transaction,
  params: SettleRedeemWlpParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  lp.settleRedeem({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      globalConfig: tx.object(client.config.packages.waterx_perp.global_config),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      operatorRequest: req as unknown as TransactionArgument,
      aum: tx.object(requireWlpAum(client)),
      requestId: params.requestId,
      oracle: tx.object(client.config.packages.waterx_oracle.oracle),
    },
    typeArguments: [params.lpType ?? client.wlpType(), params.redeemTokenType],
  })(tx);
}

// ============================================================================
// update_token_value (housekeeping — refresh per-token TVL)
// ============================================================================

/** Recompute one token pool's TVL using the current Oracle price. */
export function updateTokenValue(
  client: PerpClient,
  tx: Transaction,
  args: { tokenType: string; lpType?: string },
): void {
  lp.updateTokenValue({
    package: client.config.packages.waterx_perp.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      oracle: tx.object(client.config.packages.waterx_oracle.oracle),
    },
    typeArguments: [args.lpType ?? client.wlpType(), args.tokenType],
  })(tx);
}
