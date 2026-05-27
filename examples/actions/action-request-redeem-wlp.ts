/**
 * `requestRedeemWlp({ accountId, redeemTokenType, lpAmount })` — enqueue
 * a redeem of LP tokens. Keepers later run `settleRedeemWlp` to release
 * the underlying token. No oracle refresh is needed at request time.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_LP_AMOUNT=1000000 \
 *     pnpm exec tsx examples/actions/action-request-redeem-wlp.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { requestRedeemWlp } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  requestRedeemWlp(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    redeemTokenType: client.creditType(),
    lpAmount: BigInt(process.env.WATERX_LP_AMOUNT ?? "1000000"),
  });

  await simThenMaybeExecute(client, tx, "requestRedeemWlp", keypair);
});
