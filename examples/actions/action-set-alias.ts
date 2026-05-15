/**
 * `setAlias({ accountId, alias })` — rename an existing wxa account.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_ALIAS=mynew \
 *     pnpm exec tsx examples/actions/action-set-alias.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { setAlias } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  setAlias(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    alias: process.env.WATERX_ALIAS ?? "renamed",
  });

  await simThenMaybeExecute(client, tx, "setAlias", keypair);
});
