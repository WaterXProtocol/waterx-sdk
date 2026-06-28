import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import type { PredictClient } from "./client.ts";
import { DEFAULT_FORCE_CLAIM_CHUNK_SIZE } from "./constants.ts";
import type {
  AccountIdentityParams,
  IdArgument,
  MarketIdInput,
  ObjectArgument,
  Outcome,
  Selection,
} from "./types.ts";
import {
  assertOutcome,
  assertSelection,
  clockArg,
  createAccountRequest,
  idArg,
  marketIdArg,
  objectArg,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "./utils.ts";

export interface BasePredictionParams {
  packageId?: string;
  globalConfig?: string;
  marketRegistry?: string;
  accountRegistry?: string;
  settlementCoinType?: string;
}

export function selectionArg(
  client: PredictClient,
  tx: Transaction,
  selection: Selection | TransactionArgument,
  packageId?: string,
): TransactionArgument {
  if (typeof selection !== "string") return selection;
  const validated = assertSelection(selection);
  const fn = validated === "YES" ? "selection_yes" : "selection_no";
  const [arg] = tx.moveCall({
    target: `${resolvePackageId(client, packageId)}::position::${fn}`,
  });
  return arg;
}

export function outcomeArg(
  client: PredictClient,
  tx: Transaction,
  outcome: Outcome | TransactionArgument,
  packageId?: string,
): TransactionArgument {
  if (typeof outcome !== "string") return outcome;
  const validated = assertOutcome(outcome);
  const fn = validated === "YES" ? "yes" : validated === "NO" ? "no" : "invalid";
  const [arg] = tx.moveCall({
    target: `${resolvePackageId(client, packageId)}::outcome::${fn}`,
  });
  return arg;
}

export interface PlaceOrderParams extends BasePredictionParams, AccountIdentityParams {
  accountId: IdArgument;
  /**
   * Registry account that owns the filled position (defaults to `accountId`).
   * Required by on-chain `place_order` since bet-sharing: payer and receiver may differ.
   */
  receiverAccountId?: IdArgument;
  maxSpend: bigint | number | string;
  marketId: MarketIdInput;
  selection: Selection | TransactionArgument;
  minShares: bigint | number | string;
  priceCapBps: bigint | number | string;
  expiryTs: bigint | number | string;
}

export function placeOrder(
  client: PredictClient,
  tx: Transaction,
  params: PlaceOrderParams,
): Transaction {
  const pkg = resolvePackageId(client, params.packageId);
  const senderRequest = createAccountRequest(client, tx, params);
  const receiverAccountId = params.receiverAccountId ?? params.accountId;
  tx.moveCall({
    target: `${pkg}::waterx_prediction::place_order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      idArg(tx, params.accountId),
      idArg(tx, receiverAccountId),
      tx.pure.u64(toBigInt(params.maxSpend)),
      marketIdArg(tx, params.marketId),
      selectionArg(client, tx, params.selection, params.packageId),
      tx.pure.u64(toBigInt(params.minShares)),
      tx.pure.u64(toBigInt(params.priceCapBps)),
      tx.pure.u64(toBigInt(params.expiryTs)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface SelfCancelOrderParams extends BasePredictionParams, AccountIdentityParams {
  orderId: bigint | number | string;
}

export function selfCancelOrder(
  client: PredictClient,
  tx: Transaction,
  params: SelfCancelOrderParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::self_cancel_order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.orderId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface ClaimParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
}

export function claim(client: PredictClient, tx: Transaction, params: ClaimParams): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::claim`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface BatchClaimParams extends BasePredictionParams, AccountIdentityParams {
  positionIds: readonly (bigint | number | string)[];
}

/** Chains multiple `claim` calls in one PTB, reusing a single account request. */
export function batchClaim(
  client: PredictClient,
  tx: Transaction,
  params: BatchClaimParams,
): Transaction {
  if (params.positionIds.length === 0) {
    throw new Error("batchClaim: positionIds must not be empty");
  }

  const pkg = resolvePackageId(client, params.packageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const globalConfig = tx.object(resolveGlobalConfig(client, params.globalConfig));
  const marketRegistry = tx.object(resolveMarketRegistry(client, params.marketRegistry));
  const accountRegistry = tx.object(resolveAccountRegistry(client, params.accountRegistry));
  const senderRequest = createAccountRequest(client, tx, params);
  const clock = clockArg(tx);

  for (const positionId of params.positionIds) {
    tx.moveCall({
      target: `${pkg}::waterx_prediction::claim`,
      typeArguments: [coinType],
      arguments: [
        globalConfig,
        marketRegistry,
        accountRegistry,
        senderRequest,
        tx.pure.u64(toBigInt(positionId)),
        clock,
      ],
    });
  }
  return tx;
}

export interface RequestCloseParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
  minProceeds: bigint | number | string;
  expiryTs: bigint | number | string;
}

export function requestClose(
  client: PredictClient,
  tx: Transaction,
  params: RequestCloseParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::request_close`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      tx.pure.u64(toBigInt(params.minProceeds)),
      tx.pure.u64(toBigInt(params.expiryTs)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface RequestPartialCloseParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
  /**
   * Shares to peel off `positionId` into a new same-account position that is
   * then closed. Must be `0 < closeShares < filled_shares` of the position.
   */
  closeShares: bigint | number | string;
  minProceeds: bigint | number | string;
  expiryTs: bigint | number | string;
}

/**
 * Account-backed partial sell. Splits `closeShares` off `positionId` into a new
 * same-account position and runs the close flow on it; the remainder stays
 * `Open` under `positionId`. The on-chain call returns the new PendingClose
 * position id (read it from events / the returned move-call result if needed).
 */
export function requestPartialClose(
  client: PredictClient,
  tx: Transaction,
  params: RequestPartialCloseParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::request_partial_close`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      tx.pure.u64(toBigInt(params.closeShares)),
      tx.pure.u64(toBigInt(params.minProceeds)),
      tx.pure.u64(toBigInt(params.expiryTs)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface SelfCancelCloseParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
}

export function selfCancelClose(
  client: PredictClient,
  tx: Transaction,
  params: SelfCancelCloseParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::self_cancel_close`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface TransferPositionParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
  /** WXA account that receives the position; future close/claim proceeds go there. */
  recipientAccountId: IdArgument;
}

/**
 * Account-backed position transfer. The source account owner moves an open
 * prediction position to another WXA account. Aborts if the position has a
 * pending close.
 */
export function transferPosition(
  client: PredictClient,
  tx: Transaction,
  params: TransferPositionParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::transfer_position`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      idArg(tx, params.recipientAccountId),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface SplitPositionParams extends BasePredictionParams, AccountIdentityParams {
  positionId: bigint | number | string;
  /** WXA account that receives the new independent position. */
  recipientAccountId: IdArgument;
  /**
   * Shares to split into the recipient's new position. Must be
   * `0 < splitShares < filled_shares` of the source position.
   */
  splitShares: bigint | number | string;
}

/**
 * Account-backed partial transfer. Splits an open position into two independent
 * positions: the source keeps the remainder and the recipient receives a new
 * position with proportional cost basis. The on-chain call returns the new
 * position id (read it from events / the returned move-call result if needed).
 */
export function splitPosition(
  client: PredictClient,
  tx: Transaction,
  params: SplitPositionParams,
): Transaction {
  const senderRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::split_position`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      senderRequest,
      tx.pure.u64(toBigInt(params.positionId)),
      idArg(tx, params.recipientAccountId),
      tx.pure.u64(toBigInt(params.splitShares)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface KeeperBaseParams extends BasePredictionParams, AccountIdentityParams {}

export interface FillOrderParams extends KeeperBaseParams {
  orderId: bigint | number | string;
  filledShares: bigint | number | string;
  filledCost: bigint | number | string;
}

export function fillOrder(
  client: PredictClient,
  tx: Transaction,
  params: FillOrderParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::fill_order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.u64(toBigInt(params.orderId)),
      tx.pure.u64(toBigInt(params.filledShares)),
      tx.pure.u64(toBigInt(params.filledCost)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface CancelOrderParams extends KeeperBaseParams {
  orderId: bigint | number | string;
}

export function cancelOrder(
  client: PredictClient,
  tx: Transaction,
  params: CancelOrderParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::cancel_order`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.u64(toBigInt(params.orderId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface ConfirmCloseParams extends KeeperBaseParams {
  positionId: bigint | number | string;
  proceeds: bigint | number | string;
}

export function confirmClose(
  client: PredictClient,
  tx: Transaction,
  params: ConfirmCloseParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::confirm_close`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
      tx.pure.u64(toBigInt(params.proceeds)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface CancelCloseParams extends KeeperBaseParams {
  positionId: bigint | number | string;
}

export function cancelClose(
  client: PredictClient,
  tx: Transaction,
  params: CancelCloseParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::cancel_close`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface ForceClaimParams extends KeeperBaseParams {
  positionId: bigint | number | string;
}

export function forceClaim(
  client: PredictClient,
  tx: Transaction,
  params: ForceClaimParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::force_claim`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      tx.pure.u64(toBigInt(params.positionId)),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface BatchForceClaimParams extends KeeperBaseParams {
  positionIds: readonly (bigint | number | string)[];
}

/** Chains multiple `force_claim` calls in one PTB, reusing a single keeper request. */
export function batchForceClaim(
  client: PredictClient,
  tx: Transaction,
  params: BatchForceClaimParams,
): Transaction {
  if (params.positionIds.length === 0) {
    throw new Error("batchForceClaim: positionIds must not be empty");
  }

  const pkg = resolvePackageId(client, params.packageId);
  const coinType = resolveSettlementCoinType(client, params.settlementCoinType);
  const globalConfig = tx.object(resolveGlobalConfig(client, params.globalConfig));
  const marketRegistry = tx.object(resolveMarketRegistry(client, params.marketRegistry));
  const accountRegistry = tx.object(resolveAccountRegistry(client, params.accountRegistry));
  const keeperRequest = createAccountRequest(client, tx, params);
  const clock = clockArg(tx);

  for (const positionId of params.positionIds) {
    tx.moveCall({
      target: `${pkg}::waterx_prediction::force_claim`,
      typeArguments: [coinType],
      arguments: [
        globalConfig,
        keeperRequest,
        marketRegistry,
        accountRegistry,
        tx.pure.u64(toBigInt(positionId)),
        clock,
      ],
    });
  }
  return tx;
}

export interface BuildBatchForceClaimTransactionsParams extends BatchForceClaimParams {
  chunkSize?: number;
}

function assertPositiveIntegerChunkSize(chunkSize: number, fn: string): void {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error(`${fn}: chunkSize must be a positive integer`);
  }
}

function chunkPositionIds<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Splits `positionIds` into multiple PTBs, each with up to `chunkSize` `force_claim`
 * calls. Returns one unsigned `Transaction` per chunk for keeper signing.
 */
export function buildBatchForceClaimTransactions(
  client: PredictClient,
  params: BuildBatchForceClaimTransactionsParams,
): Transaction[] {
  if (params.positionIds.length === 0) {
    throw new Error("buildBatchForceClaimTransactions: positionIds must not be empty");
  }

  const { positionIds, chunkSize = DEFAULT_FORCE_CLAIM_CHUNK_SIZE, ...batchParams } = params;
  assertPositiveIntegerChunkSize(chunkSize, "buildBatchForceClaimTransactions");

  return chunkPositionIds(positionIds, chunkSize).map((ids) => {
    const tx = new Transaction();
    batchForceClaim(client, tx, { ...batchParams, positionIds: ids });
    return tx;
  });
}

export interface ResolveMarketParams extends KeeperBaseParams {
  marketId: MarketIdInput;
  outcome: Outcome | TransactionArgument;
}

export function resolveMarket(
  client: PredictClient,
  tx: Transaction,
  params: ResolveMarketParams,
): Transaction {
  const keeperRequest = createAccountRequest(client, tx, params);
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::resolve_market`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      tx.object(resolveGlobalConfig(client, params.globalConfig)),
      keeperRequest,
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      marketIdArg(tx, params.marketId),
      outcomeArg(client, tx, params.outcome, params.packageId),
      clockArg(tx),
    ],
  });
  return tx;
}

export interface AdminPlaceOrderForParams extends BasePredictionParams {
  adminCap: ObjectArgument;
  payment: ObjectArgument;
  accountId: IdArgument;
  marketId: MarketIdInput;
  selection: Selection | TransactionArgument;
  minShares: bigint | number | string;
  priceCapBps: bigint | number | string;
  expiryTs: bigint | number | string;
}

export function adminPlaceOrderFor(
  client: PredictClient,
  tx: Transaction,
  params: AdminPlaceOrderForParams,
): Transaction {
  tx.moveCall({
    target: `${resolvePackageId(client, params.packageId)}::waterx_prediction::admin_place_order_for`,
    typeArguments: [resolveSettlementCoinType(client, params.settlementCoinType)],
    arguments: [
      objectArg(tx, params.adminCap),
      tx.object(resolveMarketRegistry(client, params.marketRegistry)),
      tx.object(resolveAccountRegistry(client, params.accountRegistry)),
      objectArg(tx, params.payment),
      idArg(tx, params.accountId),
      marketIdArg(tx, params.marketId),
      selectionArg(client, tx, params.selection, params.packageId),
      tx.pure.u64(toBigInt(params.minShares)),
      tx.pure.u64(toBigInt(params.priceCapBps)),
      tx.pure.u64(toBigInt(params.expiryTs)),
      clockArg(tx),
    ],
  });
  return tx;
}
