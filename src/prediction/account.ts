import { bcs } from "@mysten/sui/bcs";
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import {
  addDelegate as sharedAddDelegate,
  createAccount as sharedCreateAccount,
  removeDelegate as sharedRemoveDelegate,
} from "../account/account.ts";
import type { PredictClient } from "./client.ts";
import { extractReturnBytes } from "./fetch.ts";
import type { AccountIdentityParams, CoinRef, IdArgument, ObjectArgument } from "./types.ts";
import {
  clockArg,
  createAccountRequest,
  idArg,
  objectArg,
  receivingCoinArg,
  resolveAccountRegistry,
  resolvePackageId,
  toBigInt,
} from "./utils.ts";

function accountPackage(client: PredictClient, packageId?: string): string {
  return packageId ?? client.waterxAccountPackageId();
}

export interface AccountBaseParams {
  accountPackageId?: string;
  accountRegistry?: string;
}

export interface CreateAccountParams extends AccountBaseParams, AccountIdentityParams {
  alias: string;
}

/**
 * Resolves the registry `0x2::object::ID` used by `request_deposit` / views from an on-chain
 * `Account` object id (e.g. parsed from transaction effects).
 */
export async function resolveRegistryAccountId(
  client: PredictClient,
  accountObjectId: string,
  params: AccountBaseParams = {},
): Promise<string> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::account_id`,
    arguments: [tx.object(accountObjectId)],
  });
  const result = await client.simulate(tx);
  return bcs.Address.parse(extractReturnBytes(result));
}

export function createAccount(
  client: PredictClient,
  tx: Transaction,
  params: CreateAccountParams,
): TransactionArgument {
  // Delegates to the shared account/ builder — `waterx_account` is a single shared
  // contract, so the account id + registry are identical across lines. (The
  // per-call package/registry overrides are moot with one package.)
  return sharedCreateAccount(client, tx, {
    alias: params.alias,
    bucketAccount: params.bucketAccount,
  });
}

export interface TransferCoinToAccountParams extends AccountBaseParams {
  accountId: IdArgument;
  coin: ObjectArgument;
  coinType?: string;
}

export function transferCoinToAccount(
  client: PredictClient,
  tx: Transaction,
  params: TransferCoinToAccountParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::transfer_coin`,
    typeArguments: [params.coinType ?? client.settlementCoinType()],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      idArg(tx, params.accountId),
      objectArg(tx, params.coin),
    ],
  });
  return tx;
}

export interface RequestDepositParams extends AccountBaseParams {
  accountId: IdArgument;
  coin: ObjectArgument;
  coinType?: string;
  extraData?: Uint8Array | number[];
}

export function requestDeposit(
  client: PredictClient,
  tx: Transaction,
  params: RequestDepositParams,
): TransactionArgument {
  const [request] = tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::request_deposit`,
    typeArguments: [params.coinType ?? client.settlementCoinType()],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      idArg(tx, params.accountId),
      objectArg(tx, params.coin),
      tx.pure.vector("u8", Array.from(params.extraData ?? [])),
    ],
  });
  return request;
}

export interface ConsumeDepositDirectParams extends AccountBaseParams {
  depositRequest: TransactionArgument;
  coinType?: string;
}

/** Finishes a `request_deposit` hot potato via `direct_rule` (same-coin credit). */
export function consumeDepositDirect(
  client: PredictClient,
  tx: Transaction,
  params: ConsumeDepositDirectParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::direct_rule::consume_deposit_direct`,
    typeArguments: [params.coinType ?? client.settlementCoinType()],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      params.depositRequest,
    ],
  });
  return tx;
}

/**
 * Full deposit: `request_deposit` + `consume_deposit_direct` in one PTB.
 * Use this for testnet USD unless you implement a custom deposit policy consume path.
 */
export function deposit(
  client: PredictClient,
  tx: Transaction,
  params: RequestDepositParams,
): Transaction {
  const request = requestDeposit(client, tx, params);
  consumeDepositDirect(client, tx, {
    accountPackageId: params.accountPackageId,
    accountRegistry: params.accountRegistry,
    depositRequest: request,
    coinType: params.coinType,
  });
  return tx;
}

export interface RequestDepositFromReceivingsParams extends AccountBaseParams {
  accountId: IdArgument;
  coins: CoinRef[];
  coinType?: string;
  extraData?: Uint8Array | number[];
}

export function requestDepositFromReceivings(
  client: PredictClient,
  tx: Transaction,
  params: RequestDepositFromReceivingsParams,
): TransactionArgument {
  const coinType = params.coinType ?? client.settlementCoinType();
  const receivings = params.coins.map((coin) => receivingCoinArg(tx, coin));
  const [request] = tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::request_deposit_from_receivings`,
    typeArguments: [coinType],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      idArg(tx, params.accountId),
      tx.makeMoveVec({
        type: `0x2::transfer::Receiving<0x2::coin::Coin<${coinType}>>`,
        elements: receivings,
      }),
      tx.pure.vector("u8", Array.from(params.extraData ?? [])),
    ],
  });
  return request;
}

export interface RequestWithdrawParams extends AccountBaseParams, AccountIdentityParams {
  accountId: IdArgument;
  amount: bigint | number | string;
  recipient: string;
  coinType?: string;
  extraData?: Uint8Array | number[];
}

export function requestWithdraw(
  client: PredictClient,
  tx: Transaction,
  params: RequestWithdrawParams,
): TransactionArgument {
  const senderRequest = createAccountRequest(client, tx, params);
  const [request] = tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::request_withdraw`,
    typeArguments: [params.coinType ?? client.settlementCoinType()],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      idArg(tx, params.accountId),
      tx.pure.u64(toBigInt(params.amount)),
      tx.pure.address(params.recipient),
      tx.pure.vector("u8", Array.from(params.extraData ?? [])),
      clockArg(tx),
    ],
  });
  return request;
}

export interface ConsumeWithdrawDirectParams extends AccountBaseParams {
  withdrawRequest: TransactionArgument;
  coinType?: string;
}

/** Finishes a `request_withdraw` hot potato via `direct_rule` (same-coin payout). */
export function consumeWithdrawDirect(
  client: PredictClient,
  tx: Transaction,
  params: ConsumeWithdrawDirectParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::direct_rule::consume_withdraw_direct`,
    typeArguments: [params.coinType ?? client.settlementCoinType()],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      params.withdrawRequest,
    ],
  });
  return tx;
}

/**
 * Full withdraw: `request_withdraw` + `consume_withdraw_direct` in one PTB.
 * Use this for testnet USD unless you implement a custom withdraw policy consume path.
 */
export function withdraw(
  client: PredictClient,
  tx: Transaction,
  params: RequestWithdrawParams,
): Transaction {
  const request = requestWithdraw(client, tx, params);
  consumeWithdrawDirect(client, tx, {
    accountPackageId: params.accountPackageId,
    accountRegistry: params.accountRegistry,
    withdrawRequest: request,
    coinType: params.coinType,
  });
  return tx;
}

export interface AddDelegateParams extends AccountBaseParams, AccountIdentityParams {
  accountId: IdArgument;
  delegate: string;
  alias: string;
  permissions: number;
  expiresAtMs?: bigint | number | string | null;
}

export function addDelegate(
  client: PredictClient,
  tx: Transaction,
  params: AddDelegateParams,
): Transaction {
  sharedAddDelegate(client, tx, {
    accountId: params.accountId,
    delegateAddress: params.delegate,
    alias: params.alias,
    permissions: params.permissions,
    expiresAtMs: params.expiresAtMs == null ? undefined : toBigInt(params.expiresAtMs),
    bucketAccount: params.bucketAccount,
  });
  return tx;
}

export interface RemoveDelegateParams extends AccountBaseParams, AccountIdentityParams {
  accountId: IdArgument;
  delegate: string;
}

export function removeDelegate(
  client: PredictClient,
  tx: Transaction,
  params: RemoveDelegateParams,
): Transaction {
  sharedRemoveDelegate(client, tx, {
    accountId: params.accountId,
    delegateAddress: params.delegate,
    bucketAccount: params.bucketAccount,
  });
  return tx;
}

export interface SetDelegatePredictionPermissionParams
  extends AccountBaseParams, AccountIdentityParams {
  accountId: IdArgument;
  delegate: string;
  permissions: number;
  predictionPackageId?: string;
}

export function setDelegatePredictionPermission(
  client: PredictClient,
  tx: Transaction,
  params: SetDelegatePredictionPermissionParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::set_delegate_protocol_permission`,
    typeArguments: [
      `${resolvePackageId(client, params.predictionPackageId)}::account_data::WaterXPrediction`,
    ],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      idArg(tx, params.accountId),
      tx.pure.address(params.delegate),
      tx.pure.u32(params.permissions),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface WhitelistPredictionProtocolParams extends AccountBaseParams {
  adminCap: ObjectArgument;
  predictionPackageId?: string;
}

export function whitelistPredictionProtocol(
  client: PredictClient,
  tx: Transaction,
  params: WhitelistPredictionProtocolParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::whitelist_protocol`,
    typeArguments: [
      `${resolvePackageId(client, params.predictionPackageId)}::account_data::WaterXPrediction`,
    ],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      objectArg(tx, params.adminCap),
    ],
  });
  return tx;
}

export interface PredictionProtocolAssetParams extends WhitelistPredictionProtocolParams {
  coinType?: string;
}

export function allowPredictionProtocolAsset(
  client: PredictClient,
  tx: Transaction,
  params: PredictionProtocolAssetParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::allow_protocol_asset`,
    typeArguments: [
      `${resolvePackageId(client, params.predictionPackageId)}::account_data::WaterXPrediction`,
      params.coinType ?? client.settlementCoinType(),
    ],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      objectArg(tx, params.adminCap),
    ],
  });
  return tx;
}

export function disallowPredictionProtocolAsset(
  client: PredictClient,
  tx: Transaction,
  params: PredictionProtocolAssetParams,
): Transaction {
  tx.moveCall({
    target: `${accountPackage(client, params.accountPackageId)}::account::disallow_protocol_asset`,
    typeArguments: [
      `${resolvePackageId(client, params.predictionPackageId)}::account_data::WaterXPrediction`,
      params.coinType ?? client.settlementCoinType(),
    ],
    arguments: [
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      objectArg(tx, params.adminCap),
    ],
  });
  return tx;
}
