/**
 * Referral builders — backed by the standalone `waterx_referral` package
 * (`packages.waterx_referral` + `objects.referral.table`, both required at
 * config load).
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import * as referral from "../generated/waterx_referral/referral_table.ts";
import { makeSenderRequest } from "./account-request.ts";
import type { WxaClientLike } from "./client.ts";

export interface SetReferralCodeParams {
  /** Referral code string the caller wants to claim. */
  code: string;
  bucketAccount?: string | TransactionArgument;
}

export function setReferralCode(
  client: WxaClientLike,
  tx: Transaction,
  params: SetReferralCodeParams,
): void {
  const pkg = client.config.packages.waterx_referral.published_at;
  const table = client.config.objects.referral.table;
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  referral.setReferralCode({
    package: pkg,
    arguments: {
      table: tx.object(table),
      req: req as unknown as TransactionArgument,
      code: params.code,
    },
  })(tx);
}

export interface UseReferralCodeParams {
  /** Referral code to bind to the caller's address. */
  code: string;
  bucketAccount?: string | TransactionArgument;
}

export function useReferralCode(
  client: WxaClientLike,
  tx: Transaction,
  params: UseReferralCodeParams,
): void {
  const pkg = client.config.packages.waterx_referral.published_at;
  const table = client.config.objects.referral.table;
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  referral.useReferralCode({
    package: pkg,
    arguments: {
      table: tx.object(table),
      req: req as unknown as TransactionArgument,
      code: params.code,
    },
  })(tx);
}
