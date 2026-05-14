/**
 * Account-side builders for the `waterx_account` framework.
 *
 * In v3, `waterx_account` is the only account abstraction — `waterx_perp`
 * stores per-account state under `ProtocolDataKey<WaterXPerp>()` on a wxa
 * `Account` and uses witness-gated `take` / `put` for collateral.
 *
 * All builders that mutate the account pass `account::request()` or
 * `account::request_with_account(&Account)` internally. To act through
 * a Bucket `Account` object, pass `bucketAccount` (an object ID string
 * or a `TransactionArgument`).
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import * as wxa from "../generated/waterx_account/account.ts";
import { makeSenderRequest } from "../utils/account-request.ts";

// ============================================================================
// Create account
// ============================================================================

export interface CreateAccountParams {
  /** Alias / display name for the new account (max length checked on-chain). */
  alias: string;
  /** Optional Bucket Account to act through (otherwise tx.sender). */
  bucketAccount?: string | TransactionArgument;
}

/** Build `waterx_account::create_account`. Returns the new account ID via Move return value. */
export function createAccount(
  client: WaterXClient,
  tx: Transaction,
  params: CreateAccountParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  wxa.createAccount({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      alias: params.alias,
    },
  })(tx);
}

// ============================================================================
// Set alias
// ============================================================================

export interface SetAliasParams {
  accountId: string;
  alias: string;
  bucketAccount?: string | TransactionArgument;
}

export function setAlias(client: WaterXClient, tx: Transaction, params: SetAliasParams): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  wxa.setAlias({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      alias: params.alias,
    },
  })(tx);
}

// ============================================================================
// Delegate management
// ============================================================================

export interface AddDelegateParams {
  accountId: string;
  delegateAddress: string;
  alias: string;
  /** Bitmask matching `waterx_account` permission constants. */
  permissions: number;
  /** Optional millisecond timestamp at which the delegate expires. */
  expiresAtMs?: bigint | number;
  bucketAccount?: string | TransactionArgument;
}

export function addDelegate(
  client: WaterXClient,
  tx: Transaction,
  params: AddDelegateParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  wxa.addDelegate({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      delegateAddress: params.delegateAddress,
      alias: params.alias,
      permissions: params.permissions,
      expiresAtMs: params.expiresAtMs ?? null,
    },
  })(tx);
}

export interface RemoveDelegateParams {
  accountId: string;
  delegateAddress: string;
  bucketAccount?: string | TransactionArgument;
}

export function removeDelegate(
  client: WaterXClient,
  tx: Transaction,
  params: RemoveDelegateParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  wxa.removeDelegate({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      delegateAddress: params.delegateAddress,
    },
  })(tx);
}

export interface SetDelegateProtocolPermissionParams {
  accountId: string;
  delegateAddress: string;
  /** Bitmask of per-protocol permissions (e.g. perm_open_position | perm_close_position). */
  permissions: number;
  /** Fully-qualified Move type of the protocol witness (e.g. `0x…::account_data::WaterXPerp`). */
  protocolType: string;
  bucketAccount?: string | TransactionArgument;
}

export function setDelegateProtocolPermission(
  client: WaterXClient,
  tx: Transaction,
  params: SetDelegateProtocolPermissionParams,
): void {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  wxa.setDelegateProtocolPermission({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      delegateAddress: params.delegateAddress,
      permissions: params.permissions,
    },
    typeArguments: [params.protocolType],
  })(tx);
}

// ============================================================================
// Deposit policy flow (request_deposit → consume_deposit → put)
// ============================================================================

export interface RequestDepositParams {
  /** wxa account ID receiving the deposit. */
  accountId: string;
  /** Coin or coin transaction argument to deposit. */
  coin: TransactionArgument;
  /** Fully-qualified coin type. */
  coinType: string;
  /** Optional opaque extra data forwarded to the policy. */
  extraData?: Uint8Array;
}

/** Build `account::request_deposit<T>`. Returns the `DepositRequest<T>` argument. */
export function requestDeposit(
  client: WaterXClient,
  tx: Transaction,
  params: RequestDepositParams,
): TransactionArgument {
  const [req] = wxa.requestDeposit({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      coin: params.coin as unknown as string,
      extraData: Array.from(params.extraData ?? new Uint8Array()),
    },
    typeArguments: [params.coinType],
  })(tx);
  return req as unknown as TransactionArgument;
}

// ============================================================================
// Withdraw policy flow (request_withdraw → consume_withdraw → policy)
// ============================================================================

export interface RequestWithdrawParams {
  accountId: string;
  amount: bigint | number;
  /** Recipient for the eventual coin payout (policy decides exact mechanics). */
  recipient: string;
  /** Fully-qualified coin type. */
  coinType: string;
  /** Optional opaque extra data forwarded to the policy. */
  extraData?: Uint8Array;
  bucketAccount?: string | TransactionArgument;
}

/** Build `account::request_withdraw<T>`. Returns the `WithdrawRequest<T>` argument. */
export function requestWithdraw(
  client: WaterXClient,
  tx: Transaction,
  params: RequestWithdrawParams,
): TransactionArgument {
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  const [out] = wxa.requestWithdraw({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: req as unknown as string,
      accountId: params.accountId,
      amount: params.amount,
      recipient: params.recipient,
      extraData: Array.from(params.extraData ?? new Uint8Array()),
    },
    typeArguments: [params.coinType],
  })(tx);
  return out as unknown as TransactionArgument;
}

// ============================================================================
// Direct coin transfer to an account (validates account exists)
// ============================================================================

export interface TransferToAccountParams {
  accountId: string;
  coin: TransactionArgument;
  coinType: string;
}

export function transferToAccount(
  client: WaterXClient,
  tx: Transaction,
  params: TransferToAccountParams,
): void {
  wxa.transferCoin({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      coin: params.coin as unknown as string,
    },
    typeArguments: [params.coinType],
  })(tx);
}
