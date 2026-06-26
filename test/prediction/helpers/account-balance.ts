/**
 * wxa stored balance reads for prediction integration / CLI probes.
 */
import { bcs } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { extractReturnBytes } from "~predict/fetch.ts";
import {
  resolveAccountPackageId,
  resolveAccountRegistry,
  resolveSettlementCoinType,
} from "~predict/utils.ts";

import { accountBalance } from "../../../src/generated/waterx_account/account.ts";
import { SETTLEMENT_USD_SCALE } from "./staging-amounts.ts";

/** Stored settlement balance on wxa `accountId` (`waterx_account::account_balance<T>`). */
export async function getAccountSettlementBalance(
  client: PredictClient,
  accountId: string,
): Promise<bigint> {
  const tx = new Transaction();
  accountBalance({
    package: resolveAccountPackageId(client),
    arguments: {
      registry: tx.object(resolveAccountRegistry(client)),
      accountId,
    },
    typeArguments: [resolveSettlementCoinType(client)],
  })(tx);
  const result = await client.simulate(tx);
  const raw = bcs.u64().parse(extractReturnBytes(result));
  return typeof raw === "bigint" ? raw : BigInt(raw as string | number);
}

export function formatSettlementBase(balance: bigint): string {
  const usd = Number(balance) / Number(SETTLEMENT_USD_SCALE);
  return `$${usd.toFixed(2)} (${balance} base)`;
}
