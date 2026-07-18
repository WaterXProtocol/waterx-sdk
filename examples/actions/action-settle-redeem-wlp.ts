/**
 * `settleRedeemWlp({ requestId, redeemTokenType })` — keeper call that
 * releases the underlying token to the redeem request's recipient. Needs
 * fresh oracle prices for every pool token (we refresh them first).
 *
 *   WATERX_REQUEST_ID=1 pnpm exec tsx examples/actions/action-settle-redeem-wlp.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { refreshOraclePrices } from "../../src/oracle/index.ts";
import { settleRedeemWlp, updateTokenValue } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();
  const usdcType = client.creditType();

  // Pool freshness: all pool-token oracles + bump each token's
  // last_price_refresh_timestamp so `assert_prices_fresh` inside
  // `settle_redeem` passes.
  const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
  // Standalone keeper script, no TradingRequest to reimburse a sponsor fund
  // against — pay the Pyth update fee from tx.gas (see
  // `OracleFeeSourceUnavailable` in `oracle/pyth.ts`).
  await refreshOraclePrices(tx, client, poolTickers, { feeSource: { kind: "gas" } });
  for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
    updateTokenValue(client, tx, { tokenType });
  }

  settleRedeemWlp(client, tx, {
    requestId: BigInt(requireEnv("WATERX_REQUEST_ID")),
    redeemTokenType: usdcType,
  });

  await simThenMaybeExecute(client, tx, "settleRedeemWlp", keypair);
});
