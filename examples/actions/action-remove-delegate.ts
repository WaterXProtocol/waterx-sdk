/**
 * `removeDelegate({ accountId, delegateAddress })` — revoke a previously
 * granted delegate.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_DELEGATE=0x... \
 *     pnpm exec tsx examples/actions/action-remove-delegate.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { removeDelegate } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  removeDelegate(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    delegateAddress: requireEnv("WATERX_DELEGATE"),
  });

  await simThenMaybeExecute(client, tx, "removeDelegate", keypair);
});
