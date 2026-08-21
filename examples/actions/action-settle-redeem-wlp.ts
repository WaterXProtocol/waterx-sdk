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
import { refreshWlpPoolOracles, settleRedeemWlp } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();
  const usdcType = client.creditType();

  // Pool freshness: every priceable pool-token oracle + a bump of each token's
  // last_price_refresh_timestamp, so `assert_prices_fresh` inside
  // `settle_redeem` passes. One call — the two sets must not diverge.
  await refreshWlpPoolOracles(tx, client, [], {});

  settleRedeemWlp(client, tx, {
    requestId: BigInt(requireEnv("WATERX_REQUEST_ID")),
    redeemTokenType: usdcType,
  });

  await simThenMaybeExecute(client, tx, "settleRedeemWlp", keypair);
});
