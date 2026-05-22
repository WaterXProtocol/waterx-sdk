/**
 * Oracle refresh + WLP token value updates for trading PTBs (no Vitest dependency).
 */
import type { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import { updateTokenValue } from "../../../src/user/wlp.ts";
import { refreshOraclePrices } from "../../../src/utils/pyth.ts";

export async function refreshOraclePricesForTradingEdge(
  tx: Transaction,
  client: WaterXClient,
  tickers: Iterable<string>,
): Promise<void> {
  const pool = Object.keys(client.config.packages.wlp.pool_tokens);
  const uniq = [...new Set([...tickers, ...pool])];
  await refreshOraclePrices(tx, client, uniq, {});
  for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType });
  }
}
