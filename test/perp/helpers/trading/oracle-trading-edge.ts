/**
 * Oracle refresh + WLP token value updates for trading PTBs (no Vitest dependency).
 */
import type { Transaction } from "@mysten/sui/transactions";

import { refreshOraclePrices } from "../../../../src/oracle/index.ts";
import type { PerpClient } from "../../../../src/perp/client.ts";
import { updateTokenValue } from "../../../../src/perp/user/wlp.ts";

export async function refreshOraclePricesForTradingEdge(
  tx: Transaction,
  client: PerpClient,
  tickers: Iterable<string>,
): Promise<void> {
  const pool = Object.keys(client.config.packages.wlp.pool_tokens);
  const uniq = [...new Set([...tickers, ...pool])];
  await refreshOraclePrices(tx, client, uniq, {});
  for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType });
  }
}
