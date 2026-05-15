/**
 * `cancelRedeemWlp({ requestId })` — withdraw a pending redeem request
 * and return the LP tokens back to the user's wxa account. No oracle
 * refresh needed.
 *
 *   WATERX_REQUEST_ID=1 pnpm exec tsx examples/actions/action-cancel-redeem-wlp.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { cancelRedeemWlp } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  cancelRedeemWlp(client, tx, {
    requestId: BigInt(requireEnv("WATERX_REQUEST_ID")),
  });

  await simThenMaybeExecute(client, tx, "cancelRedeemWlp", keypair);
});
