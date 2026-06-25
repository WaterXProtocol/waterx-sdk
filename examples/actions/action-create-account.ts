/**
 * `createAccount(client, tx, { alias })` — creates a wxa account owned
 * by the sender. The `account_object_address` lands in the
 * `AccountCreated` / `SubAccountCreated` event after execute.
 *
 *   pnpm exec tsx examples/actions/action-create-account.ts
 *   WATERX_EXECUTE=1 ... examples/...      # actually send
 */
import { Transaction } from "@mysten/sui/transactions";

import { buildClient, loadActiveKeypair, run, simThenMaybeExecute } from "../_shared.ts";
import { createAccount } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  createAccount(client, tx, { alias: process.env.WATERX_ALIAS ?? "example" });

  await simThenMaybeExecute(client, tx, "createAccount", keypair);
});
