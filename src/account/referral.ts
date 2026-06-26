/**
 * Referral builders — backed by the standalone `waterx_referral` package.
 * Requires
 * `config.packages.waterx_referral.{published_at,referral_table}` to be
 * populated; otherwise the builder throws so misconfigured deployments fail
 * loudly instead of silently aborting on-chain.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import * as referral from "../generated/waterx_referral/referral_table.ts";
import { makeSenderRequest } from "./account-request.ts";
import type { WxaClientLike } from "./client.ts";

function requireReferralConfig(client: WxaClientLike): { pkg: string; table: string } {
  const pkg = client.config.packages.waterx_referral?.published_at;
  const table = client.config.packages.waterx_referral?.referral_table;
  if (!pkg || !table) {
    throw new Error(
      "referral package not configured: set config.packages.waterx_referral.{published_at,referral_table}",
    );
  }
  return { pkg, table };
}

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
  const { pkg, table } = requireReferralConfig(client);
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
  const { pkg, table } = requireReferralConfig(client);
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
