import {
  Transaction,
  TransactionResult,
  type TransactionArgument,
  type TransactionObjectArgument,
} from "@mysten/sui/transactions";

import { WaterXClient } from "../client.ts";
import {
  request as accountRequestCall,
  requestWithAccount as accountRequestWithAccountCall,
} from "../generated/bucket_v2_framework/account.ts";
import {
  addDelegate as addDelegateMoveCall,
  createAccount as createAccountMoveCall,
  receiveCoinWithAmount as receiveCoinWithAmountMoveCall,
  removeDelegate as removeDelegateMoveCall,
  transferCoin as transferCoinMoveCall,
  updateDelegatePermissions as updateDelegatePermissionsMoveCall,
} from "../generated/waterx_perp/user_account.ts";

/**
 * Builds an `AccountRequest` for v2 account-management / referral / TTO calls.
 * - When `bucketAccount` is omitted: identity is the wallet sender (`account::request`).
 * - When provided: identity is the Bucket Account object address
 *   (`account::request_with_account(&Account)`), so shared/multi-sig accounts can
 *   own UserAccounts and act on coins under a different identity than `tx.sender`.
 */
function createAccountRequest(
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

// ======== Create Account ========

export interface CreateAccountParams {
  /** Human-readable account name (max 32 chars). */
  name: string;
  /**
   * Optional `bucket_v2_framework::account::Account` object id (or PTB arg) to use
   * as the owner identity. When omitted, the new UserAccount is owned by the wallet
   * sender. When provided, ownership is registered under the Bucket Account.
   */
  bucketAccount?: string | TransactionArgument;
}

/**
 * Builds a transaction to create a named user account in the AccountRegistry.
 * Each owner identity can own up to 20 accounts.
 * Returns the new UserAccount object id as the MoveCall result.
 *
 * @param nameOrParams - Either a string `name` (v1 shape) or `{ name, bucketAccount? }`.
 */
export function createAccount(
  client: WaterXClient,
  tx: Transaction,
  nameOrParams: string | CreateAccountParams,
): TransactionArgument {
  const params: CreateAccountParams =
    typeof nameOrParams === "string" ? { name: nameOrParams } : nameOrParams;
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg, params.bucketAccount);
  const [accountObjectId] = createAccountMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      name: params.name,
    },
  })(tx);
  return accountObjectId;
}

// ======== TTO Deposit ========

/**
 * Deposits a coin into a UserAccount via TTO.
 * Validates account exists on-chain via `user_account::transfer_coin`.
 *
 * @param accountObjectAddress - UserAccount object id
 * @param coin - Coin object ID or TransactionArgument to deposit
 * @param coinType - Full coin type string (e.g. "0x...::mock_usdc::MOCK_USDC")
 */
export function transferToAccount(
  client: WaterXClient,
  tx: Transaction,
  params: {
    accountObjectAddress: string | TransactionArgument;
    coin: string | TransactionObjectArgument;
    coinType: string;
  },
): Transaction {
  const coinArg = typeof params.coin === "string" ? tx.object(params.coin) : params.coin;
  transferCoinMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      accountId: params.accountObjectAddress,
      coin: coinArg,
    },
    typeArguments: [params.coinType],
  })(tx);
  return tx;
}

// ======== TTO Receive ========

/**
 * Receives coins from a UserAccount via TTO. Merges multiple Receiving<Coin<T>>,
 * splits `amount` (or all if omitted), and returns the split coin as a PTB result.
 * Any remainder is transferred back to the account.
 * Requires PERM_WITHDRAW on the sender.
 *
 * @param params.accountObjectAddress - UserAccount object id
 * @param params.coins - Metadata of TTO-owned coins to receive (objectId/version/digest)
 * @param params.coinType - Full type string of the coin
 * @param params.amount - Optional amount to split (omit to take all)
 *
 * v1 shape `{ coinObjectId, coinVersion, coinDigest }` is also accepted for
 * backward compatibility — it's normalized into `coins: [{…}]` with
 * `amount` undefined (take all).
 */
export function receiveCoin(
  client: WaterXClient,
  tx: Transaction,
  params: {
    accountObjectAddress: string;
    coinType: string;
    /** v2 shape — array of TTO coin handles. */
    coins?: Array<{ objectId: string; version: string | bigint; digest: string }>;
    amount?: bigint | number;
    /** @deprecated v1 shape: a single coin. Use `coins: [{ objectId, version, digest }]`. */
    coinObjectId?: string;
    /** @deprecated v1 shape. */
    coinVersion?: string | bigint;
    /** @deprecated v1 shape. */
    coinDigest?: string;
  },
): TransactionResult {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);

  // Accept the v1 single-coin shape as a shim.
  const coins =
    params.coins ??
    (params.coinObjectId !== undefined
      ? [
          {
            objectId: params.coinObjectId,
            version: params.coinVersion ?? "0",
            digest: params.coinDigest ?? "",
          },
        ]
      : []);
  if (coins.length === 0) {
    throw new Error(
      "receiveCoin: pass `coins: [{ objectId, version, digest }, ...]` (or the v1 `coinObjectId` / `coinVersion` / `coinDigest` triple).",
    );
  }

  const toReceives = coins.map((c) =>
    tx.receivingRef({
      objectId: c.objectId,
      version: String(c.version),
      digest: c.digest,
    }),
  );
  return receiveCoinWithAmountMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      accountId: params.accountObjectAddress,
      toReceives: tx.makeMoveVec({
        elements: toReceives,
        type: `0x2::transfer::Receiving<0x2::coin::Coin<${params.coinType}>>`,
      }),
      amountOpt:
        params.amount !== undefined
          ? tx.pure.option("u64", BigInt(params.amount))
          : tx.pure.option("u64", null),
    },
    typeArguments: [params.coinType],
  })(tx);
}

// ======== Add Delegate ========

export interface AddDelegateParams {
  /** UserAccount object id (or PTB result from `createAccount`) */
  accountObjectAddress: string | TransactionArgument;
  /** Delegate address to add */
  delegate: string;
  /** Permission bitmask (use PERM_* constants) */
  permissions: number;
}

/**
 * Builds a transaction to add a delegate with specific permissions to an account.
 * Only the owner can add delegates. If the delegate already exists, permissions are updated.
 */
export function addDelegate(
  client: WaterXClient,
  tx: Transaction,
  params: AddDelegateParams,
): Transaction {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);
  addDelegateMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      accountId: params.accountObjectAddress,
      delegate: params.delegate,
      permissions: params.permissions,
    },
  })(tx);
  return tx;
}

// ======== Remove Delegate ========

export interface RemoveDelegateParams {
  /** UserAccount object id (or PTB result from `createAccount`) */
  accountObjectAddress: string | TransactionArgument;
  /** Delegate address to remove */
  delegate: string;
}

/**
 * Builds a transaction to remove a delegate from a specific account.
 * Only the owner can remove delegates.
 */
export function removeDelegate(
  client: WaterXClient,
  tx: Transaction,
  params: RemoveDelegateParams,
): Transaction {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);
  removeDelegateMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      accountId: params.accountObjectAddress,
      delegate: params.delegate,
    },
  })(tx);
  return tx;
}

// ======== Update Delegate Permissions ========

export interface UpdateDelegatePermissionsParams {
  /** UserAccount object id (or PTB result from `createAccount`) */
  accountObjectAddress: string | TransactionArgument;
  /** Delegate address */
  delegate: string;
  /** New permission bitmask */
  newPermissions: number;
}

/**
 * Builds a transaction to update permissions for an existing delegate.
 * Only the owner can update permissions.
 */
export function updateDelegatePermissions(
  client: WaterXClient,
  tx: Transaction,
  params: UpdateDelegatePermissionsParams,
): Transaction {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);
  updateDelegatePermissionsMoveCall({
    package: client.config.packageId,
    arguments: {
      registry: client.config.accountRegistry,
      senderRequest,
      accountId: params.accountObjectAddress,
      delegate: params.delegate,
      newPermissions: params.newPermissions,
    },
  })(tx);
  return tx;
}
