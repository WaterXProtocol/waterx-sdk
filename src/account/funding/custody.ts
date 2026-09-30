/**
 * Builders for `native_custody::custody_vault` — the Sui-native PSM that
 * mints the protocol CREDIT CoinType 1:1 against backing stable assets `T`
 * (CCTP USDC, USDT, …).
 *
 * `mintCredit` / `mintCreditFromRequest` return a `DepositRequest<CREDIT>`
 * hot potato — it must be consumed in the same PTB by the deposit policy
 * registered for CREDIT (the canonical policy is `direct_rule::DirectRule`).
 * `mintCreditToAccount` chains that consume for you.
 *
 * There is no direct burn builder: the contract removed witness-free
 * `custody_vault::burn` (audit L03/M14). CREDIT redemption routes through
 * requestCreditWithdraw -> enqueueWithdrawal -> keeper executeWithdrawalNative.
 *
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";

import { assertFeaturePackage } from "../../config.ts";
import * as custody from "../../generated/native_custody/custody_vault.ts";
import { consumeDepositDirect } from "../../generated/waterx_account/direct_rule.ts";
import type { AccountClientLike } from "../client.ts";
import { resolveCreditStack } from "../credit-stack.ts";

// ============================================================================
// mint — raw Coin<T> → DepositRequest<CREDIT>
// ============================================================================

export interface MintCreditParams {
  /** wxa account ID the minted CREDIT is deposited into (also the partner-fee key). */
  accountId: string;
  /** `Coin<T>` of the backing asset to convert. */
  assetCoin: TransactionArgument;
  /** Fully-qualified backing-asset Move type `T` (must be registered on the vault). */
  assetType: string;
  /** Credit to mint — an alias (`"SUI"`) or the CREDIT Move type; selects that credit's vault + registry. Default: the default credit (USD). */
  creditType?: string;
  /** Opaque bytes forwarded onto the returned `DepositRequest<CREDIT>`. */
  extraData?: Uint8Array;
}

/**
 * Build `custody_vault::mint<T, CREDIT>`. Returns the `DepositRequest<CREDIT>`
 * argument — consume it in the same PTB (see `mintCreditToAccount`).
 */
export function mintCredit(
  client: AccountClientLike,
  tx: Transaction,
  params: MintCreditParams,
): TransactionArgument {
  const stack = resolveCreditStack(client.config, params.creditType);
  const [req] = custody.mint({
    package:
      (assertFeaturePackage(client.config, "native_custody", "the native custody PSM"),
      client.config.packages.native_custody.published_at),
    arguments: {
      vault: tx.object(stack.vault),
      registry: tx.object(stack.registry),
      accountRegistry: tx.object(client.config.objects.account.registry),
      accountId: params.accountId,
      assetCoin: params.assetCoin as unknown as TransactionArgument,
      extraData: Array.from(params.extraData ?? new Uint8Array()),
    },
    typeArguments: [normalizeStructTag(params.assetType), stack.creditType],
  })(tx);
  return req as unknown as TransactionArgument;
}

// ============================================================================
// mint_from_request — DepositRequest<T> → DepositRequest<CREDIT>
// ============================================================================

export interface MintCreditFromRequestParams {
  /** `DepositRequest<T>` from `account::request_deposit<T>` (T must have `NativeCustody` as its deposit policy). */
  depositRequest: TransactionArgument;
  /** Fully-qualified backing-asset Move type `T`. */
  assetType: string;
  /** Credit to mint — an alias (`"SUI"`) or the CREDIT Move type; selects that credit's vault + registry. Default: the default credit (USD). */
  creditType?: string;
}

/**
 * Build `custody_vault::mint_from_request<T, CREDIT>`. The returned
 * `DepositRequest<CREDIT>` inherits the input request's `accountId` /
 * `extraData`. Consume it in the same PTB.
 */
export function mintCreditFromRequest(
  client: AccountClientLike,
  tx: Transaction,
  params: MintCreditFromRequestParams,
): TransactionArgument {
  const stack = resolveCreditStack(client.config, params.creditType);
  const [req] = custody.mintFromRequest({
    package:
      (assertFeaturePackage(client.config, "native_custody", "the native custody PSM"),
      client.config.packages.native_custody.published_at),
    arguments: {
      vault: tx.object(stack.vault),
      registry: tx.object(stack.registry),
      accountRegistry: tx.object(client.config.objects.account.registry),
      depositRequest: params.depositRequest as unknown as TransactionArgument,
    },
    typeArguments: [normalizeStructTag(params.assetType), stack.creditType],
  })(tx);
  return req as unknown as TransactionArgument;
}

// ============================================================================
// mint + consume — credit lands directly in the wxa account
// ============================================================================

/**
 * `mintCredit` followed by `direct_rule::consume_deposit_direct<CREDIT>`, so
 * the freshly minted CREDIT settles straight into `accountId`'s wxa balance.
 * Assumes CREDIT's deposit policy is `DirectRule` (the canonical setup).
 */
export function mintCreditToAccount(
  client: AccountClientLike,
  tx: Transaction,
  params: MintCreditParams,
): void {
  const req = mintCredit(client, tx, params);
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.objects.account.registry),
      req: req as unknown as TransactionArgument,
    },
    typeArguments: [resolveCreditStack(client.config, params.creditType).creditType],
  })(tx);
}
