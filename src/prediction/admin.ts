import { Transaction } from "@mysten/sui/transactions";

import type { PredictClient } from "./client.ts";
import type { MarketIdInput, ObjectArgument } from "./types.ts";
import {
  clockArg,
  marketIdArg,
  objectArg,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "./utils.ts";

export interface AdminBaseParams {
  packageId?: string;
  marketRegistry?: string;
  settlementCoinType?: string;
}

export interface CreateMarketRegistryParams extends AdminBaseParams {
  adminCap: ObjectArgument;
}

export function createMarketRegistry(
  client: PredictClient,
  tx: Transaction,
  params: CreateMarketRegistryParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::create_market_registry`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [objectArg(tx, params.adminCap)],
  });
  return tx;
}

export interface DepositSettlementParams extends AdminBaseParams {
  adminCap: ObjectArgument;
  payment: ObjectArgument;
}

export function depositSettlement(
  client: PredictClient,
  tx: Transaction,
  params: DepositSettlementParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::deposit_settlement`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      objectArg(tx, params.payment),
    ],
  });
  return tx;
}

export interface AdminWithdrawParams extends AdminBaseParams {
  adminCap: ObjectArgument;
  amount: bigint | number | string;
  recipient: string;
}

export function adminWithdraw(
  client: PredictClient,
  tx: Transaction,
  params: AdminWithdrawParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::admin_withdraw`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.amount)),
      tx.pure.address(params.recipient),
    ],
  });
  return tx;
}

export interface SetMinReserveParams extends AdminBaseParams {
  adminCap: ObjectArgument;
  newReserve: bigint | number | string;
}

export function setMinReserve(
  client: PredictClient,
  tx: Transaction,
  params: SetMinReserveParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::set_min_reserve`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.newReserve)),
    ],
  });
  return tx;
}

export interface SetOrderCancelCooldownParams extends AdminBaseParams {
  adminCap: ObjectArgument;
  cooldownMs: bigint | number | string;
}

export function setOrderCancelCooldownMs(
  client: PredictClient,
  tx: Transaction,
  params: SetOrderCancelCooldownParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::set_order_cancel_cooldown_ms`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.cooldownMs)),
    ],
  });
  return tx;
}

export interface MarketPauseParams extends AdminBaseParams {
  adminCap: ObjectArgument;
  marketId: MarketIdInput;
}

export function pauseMarket(
  client: PredictClient,
  tx: Transaction,
  params: MarketPauseParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::pause_market`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      marketIdArg(tx, params.marketId),
      clockArg(tx),
    ],
  });
  return tx;
}

export function unpauseMarket(
  client: PredictClient,
  tx: Transaction,
  params: MarketPauseParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::unpause_market`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      marketIdArg(tx, params.marketId),
    ],
  });
  return tx;
}

export interface KeeperAdminParams {
  packageId?: string;
  globalConfig?: string;
  adminCap: ObjectArgument;
  keeper: string;
}

export function addKeeper(
  client: PredictClient,
  tx: Transaction,
  params: KeeperAdminParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::add_keeper`,
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      objectArg(tx, params.adminCap),
      tx.pure.address(params.keeper),
    ],
  });
  return tx;
}

export function removeKeeper(
  client: PredictClient,
  tx: Transaction,
  params: KeeperAdminParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::remove_keeper`,
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      objectArg(tx, params.adminCap),
      tx.pure.address(params.keeper),
    ],
  });
  return tx;
}
