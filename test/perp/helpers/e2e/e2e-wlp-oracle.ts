import type { Transaction } from "@mysten/sui/transactions";
import { refreshOraclePrices } from "@waterx/sdk";

import type { PerpClient } from "../../../../src/perp/client.ts";
import { updateTokenValue } from "../../../../src/perp/user/wlp.ts";

/** Mirror {@link buildMintWlpTx} pre-mint housekeeping for WLP pool ops that assert fresh prices. */
export async function appendWlpPoolOracleRefresh(
  tx: Transaction,
  client: PerpClient,
): Promise<void> {
  const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
  // Standalone WLP-pool-ops test helper, no TradingRequest to reimburse a
  // sponsor fund against — pay the Pyth update fee from tx.gas.
  await refreshOraclePrices(tx, client, poolTickers, { allowGasFee: true });
  for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType });
  }
}
