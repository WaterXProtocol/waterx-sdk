/**
 * Helper for building `bucket_v2_framework::account::AccountRequest` (or
 * `request_with_account`) with the configured `bucket_framework` package id
 * injected. Used by every user/* builder to authenticate the caller.
 */

import type { Transaction, TransactionArgument } from "@mysten/sui/transactions";

import type { WaterXClient } from "../client.ts";
import {
  request as accountRequest,
  requestWithAccount as accountRequestWithAccount,
} from "../generated/bucket_v2_framework/account.ts";

export type BucketAccount = string | TransactionArgument | undefined;

export function makeSenderRequest(
  client: WaterXClient,
  tx: Transaction,
  bucketAccount: BucketAccount,
): TransactionArgument {
  const pkg = client.config.packages.bucket_framework.published_at;
  if (bucketAccount === undefined) {
    return accountRequest({ package: pkg })(tx) as unknown as TransactionArgument;
  }
  const accArg = typeof bucketAccount === "string" ? tx.object(bucketAccount) : bucketAccount;
  return accountRequestWithAccount({
    package: pkg,
    arguments: { account: accArg as unknown as TransactionArgument },
  })(tx) as unknown as TransactionArgument;
}
