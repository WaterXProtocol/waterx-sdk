/**
 * Async high-level prediction PTB builders with optional pre-sweep of parked
 * backing assets into wxUSD credit ({@link appendConsolidateForSpend}).
 *
 * Takes both `PerpClient` (native_custody / consolidate) and `PredictClient`
 * because sync prediction builders only target the prediction deployment.
 *
 * FE/BE tx services should call these instead of hand-composing
 * `appendConsolidateForSpend` before `placeOrder` / `batchClaim`.
 */
import { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../client.ts";
import { appendConsolidateForSpend } from "../tx-builders.ts";
import type { PredictClient } from "./client.ts";
import {
  batchClaim,
  placeOrder,
  type BatchClaimParams,
  type PlaceOrderParams,
} from "./prediction.ts";
import type { IdArgument } from "./types.ts";

export interface PredictCommonBuildOpts {
  tx?: Transaction;
  /**
   * Pre-sweep parked backing assets (USDC, USDsui, …) and address CREDIT at
   * the wxa account's address into spendable wxUSD before the main action —
   * same semantics as perp {@link CommonBuildOpts.consolidateToUsd}. Default:
   * `true`.
   *
   * Requires `accountId` to be a plain address string (not a PTB argument).
   * When `accountId` is a dynamic `TransactionArgument`, the sweep is skipped.
   */
  consolidateToUsd?: boolean;
}

export type BuildPlaceOrderTxParams = PlaceOrderParams & PredictCommonBuildOpts;

/** Same as {@link BatchClaimParams} plus `accountId` for the consolidate probe. */
export interface BuildBatchClaimTxParams extends BatchClaimParams, PredictCommonBuildOpts {
  /** wxa account object id — owner address for the pre-sweep probe. */
  accountId: string;
}

function newTx(opts?: PredictCommonBuildOpts): Transaction {
  return opts?.tx ?? new Transaction();
}

async function maybeConsolidate(
  perpClient: PerpClient,
  tx: Transaction,
  accountId: IdArgument,
  opts: PredictCommonBuildOpts | undefined,
): Promise<void> {
  if (opts?.consolidateToUsd === false) return;
  if (typeof accountId !== "string") return;
  await appendConsolidateForSpend(perpClient, tx, accountId);
}

function stripPlaceOrderParams(params: BuildPlaceOrderTxParams): PlaceOrderParams {
  const { tx: _tx, consolidateToUsd: _consolidate, ...rest } = params;
  return rest;
}

function stripBatchClaimParams(params: BuildBatchClaimTxParams): BatchClaimParams {
  const { tx: _tx, consolidateToUsd: _consolidate, accountId: _accountId, ...rest } = params;
  return rest;
}

/**
 * Optional pre-sweep + {@link placeOrder} in one PTB.
 *
 * @param perpClient — perp deployment (native_custody probe + PSM mint legs)
 * @param predictClient — prediction deployment (place_order MoveCall)
 */
export async function buildPlaceOrderTx(
  perpClient: PerpClient,
  predictClient: PredictClient,
  params: BuildPlaceOrderTxParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await maybeConsolidate(perpClient, tx, params.accountId, params);
  placeOrder(predictClient, tx, stripPlaceOrderParams(params));
  return tx;
}

/**
 * Optional pre-sweep + {@link batchClaim} in one PTB.
 */
export async function buildBatchClaimTx(
  perpClient: PerpClient,
  predictClient: PredictClient,
  params: BuildBatchClaimTxParams,
): Promise<Transaction> {
  const tx = newTx(params);
  await maybeConsolidate(perpClient, tx, params.accountId, params);
  batchClaim(predictClient, tx, stripBatchClaimParams(params));
  return tx;
}
