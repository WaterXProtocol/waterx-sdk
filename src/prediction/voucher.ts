/** Voucher credit in the legacy prediction registry (contract #171, logical Predict v8).
 * Builders never sign, issue cash, consolidate balances or infer support from package versions.
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";

import {
  VoucherAccountView as AccountBcs,
  PositionSettlementView as SettlementBcs,
} from "../generated/waterx_prediction/view.ts";
import type { PredictClient } from "./client.ts";
import { extractReturnBytes, type ViewBaseParams } from "./fetch.ts";
import { selectionArg, type BasePredictionParams, type PlaceOrderParams } from "./prediction.ts";
import type { AccountIdentityParams, IdArgument, ObjectArgument } from "./types.ts";
import {
  clockArg,
  createAccountRequest,
  idArg,
  objectArg,
  placeOrderArguments,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "./utils.ts";

/** Vouchers can only fund the payer's own position; no receiver override or cash supplement. */
export type PlaceVoucherOrderParams = Omit<PlaceOrderParams, "receiverAccountId">;
export function placeOrderWithVoucher(
  client: PredictClient,
  tx: Transaction,
  params: PlaceVoucherOrderParams,
): Transaction {
  // An explicit `undefined` is "not set", as in the cash `placeOrder`.
  if ((params as { receiverAccountId?: unknown }).receiverAccountId !== undefined)
    throw new Error("Voucher orders cannot override the receiver");
  const request = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::place_order_with_voucher`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: placeOrderArguments(client, tx, params, {
      request,
      selection: selectionArg(client, tx, params.selection, params.packageId),
    }),
  });
  return tx;
}
export interface VoucherAccountView {
  marketRegistryId: string;
  settlementCoinType: string;
  accountId: string;
  available: bigint;
  reserved: bigint;
  paused: boolean;
}
export interface PositionSettlementView {
  positionId: bigint;
  isVoucher: boolean;
  grossPayout: bigint;
  cashPayout: bigint;
  voucherRefund: bigint;
}
export async function getVoucherAccount(
  client: PredictClient,
  params: ViewBaseParams & { accountId: string },
): Promise<VoucherAccountView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::voucher_account`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.id(params.accountId),
    ],
  });
  const v = AccountBcs.parse(extractReturnBytes(await client.simulate(tx)));
  return {
    marketRegistryId: v.market_registry_id,
    // On-chain `TypeName.name` has no `0x` prefix; return the same form as the config type strings.
    settlementCoinType: normalizeStructTag(v.settlement_coin_type.name),
    accountId: v.account_id,
    available: BigInt(v.available),
    reserved: BigInt(v.reserved),
    paused: v.paused,
  };
}
/**
 * Only live positions exist in this view. Missing/deleted positions throw, never default to cash.
 * While the market is unresolved every payout field is `0n`, exactly as for a settled loss: check the
 * market outcome before treating zeros as a final result.
 */
export async function getPositionSettlement(
  client: PredictClient,
  params: ViewBaseParams & { positionId: bigint | number | string },
): Promise<PositionSettlementView> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::view::position_settlement`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
    ],
  });
  const v = SettlementBcs.parse(extractReturnBytes(await client.simulate(tx)));
  return {
    positionId: BigInt(v.position_id),
    isVoucher: v.is_voucher,
    grossPayout: BigInt(v.gross_payout),
    cashPayout: BigInt(v.cash_payout),
    voucherRefund: BigInt(v.voucher_refund),
  };
}
export interface GrantVoucherParams extends BasePredictionParams, AccountIdentityParams {
  accountId: IdArgument;
  amount: bigint | number | string;
}
/** Additive grant: caller must durably deduplicate issuance and reconcile unknown transaction results before retrying. */
export function grantVoucher(
  client: PredictClient,
  tx: Transaction,
  params: GrantVoucherParams,
): Transaction {
  const request = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::grant_voucher`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      request,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      idArg(tx, params.accountId),
      tx.pure.u64(toBigInt(params.amount)),
      clockArg(tx),
    ],
  });
  return tx;
}
export interface VoucherAdminParams extends BasePredictionParams {
  adminCap: ObjectArgument;
}
export function revokeVoucher(
  client: PredictClient,
  tx: Transaction,
  params: VoucherAdminParams & { accountId: IdArgument; amount: bigint | number | string },
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::revoke_voucher`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      idArg(tx, params.accountId),
      tx.pure.u64(toBigInt(params.amount)),
      clockArg(tx),
    ],
  });
  return tx;
}
/** Replaces the remaining issuance budget; does not increment it. */
export function setVoucherGrantBudget(
  client: PredictClient,
  tx: Transaction,
  params: VoucherAdminParams & { grantBudget: bigint | number | string },
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::set_voucher_grant_budget`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.grantBudget)),
    ],
  });
  return tx;
}
export function setVoucherPaused(
  client: PredictClient,
  tx: Transaction,
  params: VoucherAdminParams & { paused: boolean },
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::set_voucher_paused`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.bool(params.paused),
    ],
  });
  return tx;
}
export interface VoucherGranterParams extends VoucherAdminParams {
  granter: string;
}
export function addVoucherGranter(
  client: PredictClient,
  tx: Transaction,
  params: VoucherGranterParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::add_voucher_granter`,
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      objectArg(tx, params.adminCap),
      tx.pure.address(params.granter),
    ],
  });
  return tx;
}
export function removeVoucherGranter(
  client: PredictClient,
  tx: Transaction,
  params: VoucherGranterParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::remove_voucher_granter`,
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      objectArg(tx, params.adminCap),
      tx.pure.address(params.granter),
    ],
  });
  return tx;
}
export async function getVoucherGrantBudget(
  client: PredictClient,
  params: ViewBaseParams = {},
): Promise<bigint> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::voucher_grant_budget`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [tx.object(resolveMarketRegistry(client, params.marketRegistry))],
  });
  return BigInt(bcs.u64().parse(extractReturnBytes(await client.simulate(tx))));
}
export async function getVoucherGranters(
  client: PredictClient,
  params: { packageId?: string; globalConfig?: string } = {},
): Promise<string[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::global_config::voucher_granters`,
    arguments: [tx.object(resolveGlobalConfig(client, params.globalConfig))],
  });
  return bcs.vector(bcs.Address).parse(extractReturnBytes(await client.simulate(tx)));
}

/** Live order only: deleted orders fail the contract's contains-order check. */
export async function isVoucherOrder(
  client: PredictClient,
  params: ViewBaseParams & { orderId: bigint | number | string },
): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::is_voucher_order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.orderId)),
    ],
  });
  return bcs.bool().parse(extractReturnBytes(await client.simulate(tx)));
}
export async function isVoucherPosition(
  client: PredictClient,
  params: ViewBaseParams & { positionId: bigint | number | string },
): Promise<boolean> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::is_voucher_position`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
    ],
  });
  return bcs.bool().parse(extractReturnBytes(await client.simulate(tx)));
}
