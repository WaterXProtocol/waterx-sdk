import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../client.ts";
import { request as accountRequestCall } from "../generated/bucket_v2_framework/account.ts";
import {
  setReferralCode as setReferralCodeCall,
  useReferralCode as useReferralCodeCall,
} from "../generated/waterx_perp/referral_table.ts";

function createAccountRequest(tx: Transaction, bucketFrameworkPkg: string): TransactionArgument {
  const [request] = accountRequestCall({ package: bucketFrameworkPkg })(tx);
  return request;
}

// ======== Validation ========

/** Matches on-chain `is_valid_referral_code`: only lowercase a-z and 0-9. */
export function isValidReferralCode(code: string): boolean {
  return /^[a-z0-9]+$/.test(code);
}

// ======== Set Referral Code ========

export interface SetReferralCodeParams {
  /** The referral code string to register (lowercase a-z, 0-9 only) */
  code: string;
}

/**
 * Builds a transaction to register a referral code for the sender.
 * V13.1: Uses referral_table module with string-based codes.
 * @throws Error if code contains invalid characters (must be [a-z0-9]+).
 */
export function setReferralCode(
  client: WaterXClient,
  tx: Transaction,
  params: SetReferralCodeParams,
): Transaction {
  if (!isValidReferralCode(params.code)) {
    throw new Error(
      `Invalid referral code "${params.code}": must be non-empty and contain only lowercase letters (a-z) and digits (0-9).`,
    );
  }
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);
  setReferralCodeCall({
    package: client.config.packageId,
    arguments: { table: client.config.referralTable, senderRequest, code: params.code },
  })(tx);
  return tx;
}

// ======== Use Referral Code ========

export interface UseReferralCodeParams {
  /** The referral code string to bind to */
  code: string;
}

/**
 * Builds a transaction to bind a referral code to the sender.
 * V13.1: Uses referral_table module with string-based codes.
 * Permanent, first-touch binding. Cannot self-refer.
 */
export function useReferralCode(
  client: WaterXClient,
  tx: Transaction,
  params: UseReferralCodeParams,
): Transaction {
  const fwPkg = client.config.bucketFrameworkPackageId!;
  const senderRequest = createAccountRequest(tx, fwPkg);
  useReferralCodeCall({
    package: client.config.packageId,
    arguments: { table: client.config.referralTable, senderRequest, code: params.code },
  })(tx);
  return tx;
}
