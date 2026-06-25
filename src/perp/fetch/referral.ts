/**
 * Referral queries (`waterx_referral::referral_table`).
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  isValidReferralCode as isValidReferralCodeCall,
  referralCodeExists as referralCodeExistsCall,
  tryGetRefer as tryGetReferCall,
} from "../../generated/waterx_referral/referral_table.ts";
import type { PerpClient } from "../client.ts";
import { simulateAndExtract } from "./simulate.ts";

function requireReferralPackage(client: PerpClient): { pkg: string; table: string } {
  const pkg = client.config.packages.waterx_referral?.published_at;
  const table = client.config.packages.waterx_referral?.referral_table;
  if (!pkg || !table) {
    throw new Error(
      "referral package not configured: set config.packages.waterx_referral.{published_at,referral_table}",
    );
  }
  return { pkg, table };
}

/** Returns the referrer address bound to `referee`, or `undefined` if none. */
export async function getRefererFor(
  client: PerpClient,
  referee: string,
): Promise<string | undefined> {
  const { pkg, table } = requireReferralPackage(client);
  const tx = new Transaction();
  tryGetReferCall({
    package: pkg,
    arguments: { table: tx.object(table), referee },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  const opt = bcs.option(bcs.Address).parse(bytes);
  return opt ?? undefined;
}

/** True if `code` is a syntactically valid referral code (matches the contract's char rules). */
export async function isValidReferralCode(client: PerpClient, code: string): Promise<boolean> {
  const { pkg } = requireReferralPackage(client);
  const tx = new Transaction();
  isValidReferralCodeCall({ package: pkg, arguments: { code } })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}

/** True if `code` is already claimed in the on-chain ReferralTable. */
export async function referralCodeExists(client: PerpClient, code: string): Promise<boolean> {
  const { pkg, table } = requireReferralPackage(client);
  const tx = new Transaction();
  referralCodeExistsCall({
    package: pkg,
    arguments: { table: tx.object(table), code },
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}
