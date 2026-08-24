/**
 * Oracle refresh + WLP token value updates for trading PTBs (no Vitest dependency).
 */
import type { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/perp/client.ts";
import { refreshWlpPoolOracles } from "../../../../src/perp/tx-builders.ts";

export async function refreshOraclePricesForTradingEdge(
  tx: Transaction,
  client: PerpClient,
  tickers: Iterable<string>,
): Promise<void> {
  await refreshWlpPoolOracles(tx, client, [...tickers], {});
}
