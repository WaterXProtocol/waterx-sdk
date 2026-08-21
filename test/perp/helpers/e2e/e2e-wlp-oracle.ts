import type { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/perp/client.ts";
import { refreshWlpPoolOracles } from "../../../../src/perp/tx-builders.ts";

/** Mirror {@link buildMintWlpTx} pre-mint housekeeping for WLP pool ops that assert fresh prices. */
export async function appendWlpPoolOracleRefresh(
  tx: Transaction,
  client: PerpClient,
): Promise<void> {
  await refreshWlpPoolOracles(tx, client, [], {});
}
