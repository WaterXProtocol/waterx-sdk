/**
 * High-level cross-chain credit / bridge composers: VAA redeem (EVM → Sui mint),
 * the user-side withdraw request (encode route + `request_withdraw` + enqueue),
 * and the keeper-side queue drain.
 */

import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import type { PerpClient } from "../client.ts";
import {
  consumeCreditDeposit,
  enqueueWithdrawal,
  executeWithdrawalNative,
  executeWithdrawalWormhole,
  redeemVaa,
  requestCreditWithdraw,
  routeNative,
  routeWormhole,
  type RedeemVaaParams,
  type RouteWormholeParams,
} from "../user/credit.ts";

export interface BuildRedeemVaaParams extends RedeemVaaParams {
  /** Append to an existing PTB instead of creating a new one. */
  tx?: Transaction;
}

/**
 * Mint (EVM → Sui): `redeem_vaa<CREDIT>` + consume the resulting
 * `DepositRequest<CREDIT>` via the configured wxa deposit policy, in one
 * PTB. The recipient wxa account is encoded in the VAA payload.
 */
export function buildRedeemVaaTx(client: PerpClient, params: BuildRedeemVaaParams): Transaction {
  const tx = params.tx ?? new Transaction();
  const req = redeemVaa(client, tx, params);
  consumeCreditDeposit(client, tx, { depositRequest: req, creditType: params.creditType });
  return tx;
}

export type CreditWithdrawRoute =
  | ({ kind: "wormhole" } & RouteWormholeParams)
  | { kind: "native"; assetType: string };

export interface BuildRequestCreditWithdrawParams {
  accountId: string;
  amount: bigint | number;
  /** Sui-side recipient (honored for native payouts; ignored for wormhole). */
  recipient: string;
  route: CreditWithdrawRoute;
  creditType?: string;
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/**
 * Withdraw (user side): encode the route, `account::request_withdraw<CREDIT>`,
 * then `withdrawal_queue::enqueue<CREDIT>` — all in one PTB. A keeper later
 * drains the parked entry via {@link buildExecuteWithdrawalTx}.
 */
export function buildRequestCreditWithdrawTx(
  client: PerpClient,
  params: BuildRequestCreditWithdrawParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  const route =
    params.route.kind === "wormhole"
      ? routeWormhole(client, tx, params.route)
      : routeNative(client, tx, { assetType: params.route.assetType });
  const wreq = requestCreditWithdraw(client, tx, {
    accountId: params.accountId,
    amount: params.amount,
    recipient: params.recipient,
    route,
    creditType: params.creditType,
    bucketAccount: params.bucketAccount,
  });
  enqueueWithdrawal(client, tx, { withdrawRequest: wreq, creditType: params.creditType });
  return tx;
}

export type ExecuteWithdrawalRoute =
  | {
      kind: "wormhole";
      /**
       * `Coin<SUI>` paying the Wormhole message fee. Omit to mint a zero-value
       * coin via `0x2::coin::zero<SUI>` — sponsor-safe (never touches `tx.gas`,
       * so Shinami-style gas stations don't reject the PTB) and free as long as
       * `WormholeState.message_fee == 0`. Pass an explicit coin (e.g.
       * `tx.object(...)`) once Wormhole raises the message fee.
       */
      wormholeFeeCoin?: TransactionArgument;
    }
  | { kind: "native"; assetType: string };

export interface BuildExecuteWithdrawalParams {
  /** Queue entry key (from the `Enqueued` event). */
  key: bigint | number;
  route: ExecuteWithdrawalRoute;
  creditType?: string;
  /** Executor identity (must be on the queue allowlist). Defaults to tx sender. */
  bucketAccount?: string | TransactionArgument;
  tx?: Transaction;
}

/** Keeper: drain one parked queue entry. */
export function buildExecuteWithdrawalTx(
  client: PerpClient,
  params: BuildExecuteWithdrawalParams,
): Transaction {
  const tx = params.tx ?? new Transaction();
  if (params.route.kind === "wormhole") {
    const fee =
      params.route.wormholeFeeCoin ??
      tx.moveCall({ target: "0x2::coin::zero", typeArguments: ["0x2::sui::SUI"] });
    executeWithdrawalWormhole(client, tx, {
      key: params.key,
      wormholeFee: fee,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  } else {
    executeWithdrawalNative(client, tx, {
      key: params.key,
      assetType: params.route.assetType,
      creditType: params.creditType,
      bucketAccount: params.bucketAccount,
    });
  }
  return tx;
}
