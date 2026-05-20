/**
 * Builders for `native_custody::custody_vault` — the Sui-native PSM that
 * mints the protocol CREDIT CoinType 1:1 against backing stable assets `T`
 * (CCTP USDC, USDT, …) and burns it back the other way.
 *
 * `mintCredit` / `mintCreditFromRequest` return a `DepositRequest<CREDIT>`
 * hot potato — it must be consumed in the same PTB by the deposit policy
 * registered for CREDIT (the canonical policy is `direct_rule::DirectRule`).
 * `mintCreditToAccount` chains that consume for you.
 *
 * `burnCredit` returns the redeemed `Coin<T>`; the caller decides where it
 * goes (transfer, fold back into a wxa account, …).
 *
 * Requires `waterx_credit` + `native_custody` in the loaded config — both
 * are optional in `WaterXConfig` since not every deployment ships the
 * credit pipeline.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import type { NativeCustodyPackage, WaterxCreditPackage } from "../config.ts";
import * as custody from "../generated/native_custody/custody_vault.ts";
import { consumeDepositDirect } from "../generated/waterx_account/direct_rule.ts";

function requireCredit(client: WaterXClient): WaterxCreditPackage {
  const credit = client.config.packages.waterx_credit;
  if (!credit) throw new Error("waterx_credit is not configured — credit pipeline unavailable");
  return credit;
}

function requireCustody(client: WaterXClient): NativeCustodyPackage {
  const nc = client.config.packages.native_custody;
  if (!nc) throw new Error("native_custody is not configured — credit pipeline unavailable");
  return nc;
}

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
  /** CREDIT CoinType. Defaults to `client.creditType()`. */
  creditType?: string;
  /** Opaque bytes forwarded onto the returned `DepositRequest<CREDIT>`. */
  extraData?: Uint8Array;
}

/**
 * Build `custody_vault::mint<T, CREDIT>`. Returns the `DepositRequest<CREDIT>`
 * argument — consume it in the same PTB (see `mintCreditToAccount`).
 */
export function mintCredit(
  client: WaterXClient,
  tx: Transaction,
  params: MintCreditParams,
): TransactionArgument {
  const credit = requireCredit(client);
  const nc = requireCustody(client);
  const [req] = custody.mint({
    package: nc.published_at,
    arguments: {
      vault: tx.object(nc.vault),
      registry: tx.object(credit.credit_registry),
      accountRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      assetCoin: params.assetCoin as unknown as string,
      extraData: Array.from(params.extraData ?? new Uint8Array()),
    },
    typeArguments: [params.assetType, params.creditType ?? client.creditType()],
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
  /** CREDIT CoinType. Defaults to `client.creditType()`. */
  creditType?: string;
}

/**
 * Build `custody_vault::mint_from_request<T, CREDIT>`. The returned
 * `DepositRequest<CREDIT>` inherits the input request's `accountId` /
 * `extraData`. Consume it in the same PTB.
 */
export function mintCreditFromRequest(
  client: WaterXClient,
  tx: Transaction,
  params: MintCreditFromRequestParams,
): TransactionArgument {
  const credit = requireCredit(client);
  const nc = requireCustody(client);
  const [req] = custody.mintFromRequest({
    package: nc.published_at,
    arguments: {
      vault: tx.object(nc.vault),
      registry: tx.object(credit.credit_registry),
      accountRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      depositRequest: params.depositRequest as unknown as string,
    },
    typeArguments: [params.assetType, params.creditType ?? client.creditType()],
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
  client: WaterXClient,
  tx: Transaction,
  params: MintCreditParams,
): void {
  const req = mintCredit(client, tx, params);
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: req as unknown as string,
    },
    typeArguments: [params.creditType ?? client.creditType()],
  })(tx);
}

// ============================================================================
// burn — Coin<CREDIT> → Coin<T>
// ============================================================================

export interface BurnCreditParams {
  /** wxa account ID the burned CREDIT belongs to (burn-cap + partner-fee key). */
  accountId: string;
  /** `Coin<CREDIT>` to redeem. */
  creditCoin: TransactionArgument;
  /** Fully-qualified backing-asset Move type `T` to redeem into. */
  assetType: string;
  /** CREDIT CoinType. Defaults to `client.creditType()`. */
  creditType?: string;
}

/**
 * Build `custody_vault::burn<T, CREDIT>`. Returns the redeemed `Coin<T>`
 * argument for the caller to forward.
 */
export function burnCredit(
  client: WaterXClient,
  tx: Transaction,
  params: BurnCreditParams,
): TransactionArgument {
  const credit = requireCredit(client);
  const nc = requireCustody(client);
  const [coin] = custody.burn({
    package: nc.published_at,
    arguments: {
      vault: tx.object(nc.vault),
      registry: tx.object(credit.credit_registry),
      accountId: params.accountId,
      creditCoin: params.creditCoin as unknown as string,
    },
    typeArguments: [params.assetType, params.creditType ?? client.creditType()],
  })(tx);
  return coin as unknown as TransactionArgument;
}
