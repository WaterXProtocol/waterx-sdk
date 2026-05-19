/**
 * Referral builders — backed by the standalone `bucket_v2_referral` package
 * (kept from v2; not part of `waterx-contract/`). Requires
 * `config.packages.bucketReferral` and `config.objects.referralTable` to be
 * populated; otherwise the builder throws so misconfigured deployments fail
 * loudly instead of silently aborting on-chain.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import * as referral from "../generated/bucket_v2_referral/referral_table.ts";
import { makeSenderRequest } from "../utils/account-request.ts";

function requireReferralConfig(client: WaterXClient): { pkg: string; table: string } {
  const pkg = client.config.packages.waterx_referral?.published_at;
  const table = client.config.packages.waterx_referral?.referral_table;
  if (!pkg || !table) {
    throw new Error(
      "referral package not configured: set config.packages.bucketReferral and config.objects.referralTable",
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
  client: WaterXClient,
  tx: Transaction,
  params: SetReferralCodeParams,
): void {
  const { pkg, table } = requireReferralConfig(client);
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  referral.setReferralCode({
    package: pkg,
    arguments: {
      table: tx.object(table),
      req: req as unknown as string,
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
  client: WaterXClient,
  tx: Transaction,
  params: UseReferralCodeParams,
): void {
  const { pkg, table } = requireReferralConfig(client);
  const req = makeSenderRequest(client, tx, params.bucketAccount);
  referral.useReferralCode({
    package: pkg,
    arguments: {
      table: tx.object(table),
      req: req as unknown as string,
      code: params.code,
    },
  })(tx);
}
