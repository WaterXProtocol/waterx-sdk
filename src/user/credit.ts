/**
 * Cross-chain credit / bridge builders (low-level — one moveCall per fn).
 *
 * Flows (see waterx_credit/sui/*):
 *   - Mint  (EVM → Sui): `redeemVaa` → `DepositRequest<CREDIT>` hot potato,
 *     consumed in the same PTB by `consumeCreditDeposit` (the wxa deposit
 *     policy CREDIT is registered under — selected via config).
 *   - Withdraw (Sui → EVM / native): `routeWormhole` / `routeNative` encode
 *     `extra_data`, fed to `account::request_withdraw` →
 *     `enqueueWithdrawal` parks a FIFO `Queue<CREDIT>` entry.
 *   - Keeper drains the queue via `executeWithdrawalWormhole` /
 *     `executeWithdrawalNative` (caller must be on the executor allowlist).
 *   - PSM: `custodyMint` / `custodyBurn` against the native `CustodyVault`.
 *
 * Every builder that emits a hot potato returns its argument so the caller
 * (or the high-level `tx-builders.ts` wrappers) can pair + consume it in the
 * same PTB.
 */

import { fromHex } from "@mysten/bcs";
import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import {
  burn as custodyBurnCall,
  mint as custodyMintCall,
} from "../generated/native_custody/custody_vault.ts";
import { requestWithdraw as requestWithdrawCall } from "../generated/waterx_account/account.ts";
import { consumeDepositDirect } from "../generated/waterx_account/direct_rule.ts";
import {
  enqueue as enqueueCall,
  executeNative as executeNativeCall,
  executeWormhole as executeWormholeCall,
  routeNative as routeNativeCall,
  routeWormhole as routeWormholeCall,
} from "../generated/withdrawal_queue/withdrawal_queue.ts";
import { redeemVaa as redeemVaaCall } from "../generated/wormhole_bridge/wormhole_bridge.ts";
import { makeSenderRequest } from "../utils/account-request.ts";

// ============================================================================
// Byte helpers
// ============================================================================

/** Accept a Uint8Array, number[], or 0x/bare hex string → `number[]`. */
function toBytes(input: Uint8Array | number[] | string): number[] {
  if (typeof input === "string") {
    const hex = input.startsWith("0x") ? input.slice(2) : input;
    // `fromHex` silently mis-parses odd-length strings, so guard up front.
    if (hex.length % 2 !== 0) throw new Error(`odd-length hex: ${input}`);
    return Array.from(fromHex(hex));
  }
  return Array.from(input);
}

function toEvmAddressBytes(
  input: Uint8Array | number[] | string,
  field: "evmRecipient" | "evmToken",
): number[] {
  const bytes = toBytes(input);
  if (bytes.length !== 20) {
    throw new Error(`${field} must be a 20-byte EVM address (got ${bytes.length})`);
  }
  return bytes;
}

function creditTypeOf(client: WaterXClient, override?: string): string {
  return override ?? client.creditType();
}

// Required-ID accessors: the credit/bridge package entries carry their
// shared object ids only after the relevant deploy phase has run, so each
// is optional in the schema. These throw an actionable error rather than
// letting `tx.object(undefined)` fail opaquely.
function bridgeId(c: WaterXClient): string {
  const id = c.getBridge().bridge;
  if (!id) throw new Error("wormhole_bridge.bridge missing from config (Bridge not initialized)");
  return id;
}
function creditRegistryId(c: WaterXClient): string {
  const id = c.getCredit().credit_registry;
  if (!id) throw new Error("waterx_credit.credit_registry missing from config");
  return id;
}
function queuePkg(c: WaterXClient): string {
  const q = c.config.packages.withdrawal_queue;
  if (!q) throw new Error("withdrawal_queue not configured for this deployment");
  return q.published_at;
}
function queueId(c: WaterXClient): string {
  const q = c.config.packages.withdrawal_queue;
  if (!q?.queue) throw new Error("withdrawal_queue.queue missing from config");
  return q.queue;
}
function custodyPkg(c: WaterXClient): string {
  const n = c.config.packages.native_custody;
  if (!n) throw new Error("native_custody not configured for this deployment");
  return n.published_at;
}
function custodyVaultId(c: WaterXClient): string {
  const n = c.config.packages.native_custody;
  if (!n?.vault) throw new Error("native_custody.vault missing from config");
  return n.vault;
}

// ============================================================================
// Mint (EVM → Sui)
// ============================================================================

export interface RedeemVaaParams {
  /** Signed Wormhole MINT VAA (raw bytes / number[] / hex). */
  vaaBytes: Uint8Array | number[] | string;
  /** Override the CREDIT Move type (defaults to `client.creditType()`). */
  creditType?: string;
}

/**
 * Build `wormhole_bridge::redeem_vaa<CREDIT>`. Returns the
 * `DepositRequest<CREDIT>` hot-potato argument — **must** be consumed in the
 * same PTB (see {@link consumeCreditDeposit} / `redeemVaaTx`).
 */
export function redeemVaa(
  client: WaterXClient,
  tx: Transaction,
  params: RedeemVaaParams,
): TransactionArgument {
  const [req] = redeemVaaCall({
    package: client.getBridge().published_at,
    arguments: {
      bridge: tx.object(bridgeId(client)),
      registry: tx.object(creditRegistryId(client)),
      accountRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      wormholeState: tx.object(client.wormholeStateId()),
      vaaBytes: toBytes(params.vaaBytes),
    },
    typeArguments: [creditTypeOf(client, params.creditType)],
  })(tx);
  return req as unknown as TransactionArgument;
}

export interface ConsumeCreditDepositParams {
  /** The `DepositRequest<CREDIT>` returned by {@link redeemVaa} / {@link custodyMint}. */
  depositRequest: TransactionArgument;
  creditType?: string;
}

/**
 * Consume a `DepositRequest<CREDIT>` via `direct_rule::consume_deposit_direct`
 * — the wxa deposit policy CREDIT is registered under (deploy.ts phase 2:
 * `register_deposit_policy<CREDIT, DirectRule>`). Must run in the same PTB
 * as the `redeem_vaa` / custody `mint` that produced the request.
 */
export function consumeCreditDeposit(
  client: WaterXClient,
  tx: Transaction,
  params: ConsumeCreditDepositParams,
): void {
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: params.depositRequest as unknown as TransactionArgument,
    },
    typeArguments: [creditTypeOf(client, params.creditType)],
  })(tx);
}

// ============================================================================
// Withdraw route encoding (Sui → EVM / native)
// ============================================================================

export interface RouteWormholeParams {
  /** Destination EVM chain's Wormhole chain id. */
  evmDestinationChain: number;
  /** 20-byte EVM recipient (Uint8Array / number[] / hex). */
  evmRecipient: Uint8Array | number[] | string;
  /** 20-byte EVM token (Uint8Array / number[] / hex). */
  evmToken: Uint8Array | number[] | string;
}

/** Build `withdrawal_queue::route_wormhole`. Returns the `extra_data` argument. */
export function routeWormhole(
  client: WaterXClient,
  tx: Transaction,
  params: RouteWormholeParams,
): TransactionArgument {
  if (
    !Number.isInteger(params.evmDestinationChain) ||
    params.evmDestinationChain < 0 ||
    params.evmDestinationChain > 0xffff
  ) {
    throw new Error(
      `evmDestinationChain must be a u16 (0..65535), got ${params.evmDestinationChain}`,
    );
  }
  const out = routeWormholeCall({
    package: queuePkg(client),
    arguments: {
      evmDestinationChain: params.evmDestinationChain,
      evmRecipient: toEvmAddressBytes(params.evmRecipient, "evmRecipient"),
      evmToken: toEvmAddressBytes(params.evmToken, "evmToken"),
    },
  })(tx);
  return out as unknown as TransactionArgument;
}

export interface RouteNativeParams {
  /** Fully-qualified backing asset Move type `T` (e.g. via `client.getNativeAsset`). */
  assetType: string;
}

/** Build `withdrawal_queue::route_native<T>`. Returns the `extra_data` argument. */
export function routeNative(
  client: WaterXClient,
  tx: Transaction,
  params: RouteNativeParams,
): TransactionArgument {
  const out = routeNativeCall({
    package: queuePkg(client),
    typeArguments: [params.assetType],
  })(tx);
  return out as unknown as TransactionArgument;
}

// ============================================================================
// request_withdraw + enqueue (user side)
// ============================================================================

export interface RequestCreditWithdrawParams {
  accountId: string;
  amount: bigint | number;
  /** Sui-side recipient (honored for native payouts; ignored for wormhole). */
  recipient: string;
  /** `extra_data` argument from {@link routeWormhole} / {@link routeNative}. */
  route: TransactionArgument;
  creditType?: string;
  bucketAccount?: string | TransactionArgument;
}

/**
 * Build `account::request_withdraw<CREDIT>` with a route-encoded `extra_data`.
 * Returns the `WithdrawRequest<CREDIT>` hot-potato argument (feed to
 * {@link enqueueWithdrawal} in the same PTB).
 */
export function requestCreditWithdraw(
  client: WaterXClient,
  tx: Transaction,
  params: RequestCreditWithdrawParams,
): TransactionArgument {
  const senderRequest = makeSenderRequest(client, tx, params.bucketAccount);
  const [req] = requestWithdrawCall({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      senderRequest: senderRequest as unknown as TransactionArgument,
      accountId: params.accountId,
      amount: params.amount,
      recipient: params.recipient,
      extraData: params.route as unknown as number[],
    },
    typeArguments: [creditTypeOf(client, params.creditType)],
  })(tx);
  return req as unknown as TransactionArgument;
}

export interface EnqueueWithdrawalParams {
  /** `WithdrawRequest<CREDIT>` from {@link requestCreditWithdraw}. */
  withdrawRequest: TransactionArgument;
  creditType?: string;
}

/**
 * Build `withdrawal_queue::enqueue<CREDIT>`. Returns the assigned `u64` key
 * argument (also surfaced on-chain via the `Enqueued` event).
 */
export function enqueueWithdrawal(
  client: WaterXClient,
  tx: Transaction,
  params: EnqueueWithdrawalParams,
): TransactionArgument {
  const out = enqueueCall({
    package: queuePkg(client),
    arguments: {
      queue: tx.object(queueId(client)),
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: params.withdrawRequest as unknown as TransactionArgument,
    },
    typeArguments: [creditTypeOf(client, params.creditType)],
  })(tx);
  return out as unknown as TransactionArgument;
}

// ============================================================================
// Keeper: drain the withdraw queue
// ============================================================================

export interface ExecuteWithdrawalWormholeParams {
  /** Queue entry key (from the `Enqueued` event / `enqueueWithdrawal`). */
  key: bigint | number;
  /** `Coin<SUI>` paying the Wormhole message fee. */
  wormholeFee: TransactionArgument;
  creditType?: string;
  /** Executor identity (must be on the queue allowlist). Defaults to tx sender. */
  bucketAccount?: string | TransactionArgument;
}

/** Build `withdrawal_queue::execute_wormhole<CREDIT>` (keeper / executor-gated). */
export function executeWithdrawalWormhole(
  client: WaterXClient,
  tx: Transaction,
  params: ExecuteWithdrawalWormholeParams,
): void {
  const request = makeSenderRequest(client, tx, params.bucketAccount);
  executeWormholeCall({
    package: queuePkg(client),
    arguments: {
      queue: tx.object(queueId(client)),
      key: params.key,
      request: request as unknown as TransactionArgument,
      bridge: tx.object(bridgeId(client)),
      creditRegistry: tx.object(creditRegistryId(client)),
      wormholeState: tx.object(client.wormholeStateId()),
      wormholeFee: params.wormholeFee as unknown as TransactionArgument,
    },
    typeArguments: [creditTypeOf(client, params.creditType)],
  })(tx);
}

export interface ExecuteWithdrawalNativeParams {
  key: bigint | number;
  /** Fully-qualified backing asset Move type `T` (must match the entry's route). */
  assetType: string;
  creditType?: string;
  bucketAccount?: string | TransactionArgument;
}

/** Build `withdrawal_queue::execute_native<T, CREDIT>` (keeper / executor-gated). */
export function executeWithdrawalNative(
  client: WaterXClient,
  tx: Transaction,
  params: ExecuteWithdrawalNativeParams,
): void {
  const request = makeSenderRequest(client, tx, params.bucketAccount);
  executeNativeCall({
    package: queuePkg(client),
    arguments: {
      queue: tx.object(queueId(client)),
      key: params.key,
      request: request as unknown as TransactionArgument,
      vault: tx.object(custodyVaultId(client)),
      creditRegistry: tx.object(creditRegistryId(client)),
    },
    typeArguments: [params.assetType, creditTypeOf(client, params.creditType)],
  })(tx);
}

// ============================================================================
// PSM (native custody) direct mint / burn
// ============================================================================

export interface CustodyMintParams {
  /** wxa account ID the minted CREDIT lands in. */
  accountId: string;
  /** `Coin<T>` of the native backing asset. */
  assetCoin: TransactionArgument;
  /** Fully-qualified backing asset Move type `T`. */
  assetType: string;
  extraData?: Uint8Array | number[] | string;
  creditType?: string;
}

/**
 * Build `native_custody::custody_vault::mint<T, CREDIT>`. Returns the
 * `DepositRequest<CREDIT>` hot-potato argument (consume in-PTB via
 * {@link consumeCreditDeposit}).
 */
export function custodyMint(
  client: WaterXClient,
  tx: Transaction,
  params: CustodyMintParams,
): TransactionArgument {
  const [req] = custodyMintCall({
    package: custodyPkg(client),
    arguments: {
      vault: tx.object(custodyVaultId(client)),
      registry: tx.object(creditRegistryId(client)),
      accountRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId: params.accountId,
      assetCoin: params.assetCoin as unknown as TransactionArgument,
      extraData: toBytes(params.extraData ?? new Uint8Array()),
    },
    typeArguments: [params.assetType, creditTypeOf(client, params.creditType)],
  })(tx);
  return req as unknown as TransactionArgument;
}

export interface CustodyBurnParams {
  /** wxa account ID the burned CREDIT belongs to (cap / fee key). */
  accountId: string;
  /** `Coin<CREDIT>` to burn. */
  creditCoin: TransactionArgument;
  assetType: string;
  creditType?: string;
}

/**
 * Build `native_custody::custody_vault::burn<T, CREDIT>`. Returns the
 * resulting `Coin<T>` argument.
 */
export function custodyBurn(
  client: WaterXClient,
  tx: Transaction,
  params: CustodyBurnParams,
): TransactionArgument {
  const out = custodyBurnCall({
    package: custodyPkg(client),
    arguments: {
      vault: tx.object(custodyVaultId(client)),
      registry: tx.object(creditRegistryId(client)),
      accountId: params.accountId,
      creditCoin: params.creditCoin as unknown as TransactionArgument,
    },
    typeArguments: [params.assetType, creditTypeOf(client, params.creditType)],
  })(tx);
  return out as unknown as TransactionArgument;
}
