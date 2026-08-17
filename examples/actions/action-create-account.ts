/**
 * `createAccount(client, tx, { alias })` — creates a wxa account owned
 * by the sender. The `account_object_address` lands in the
 * `AccountCreated` / `SubAccountCreated` event after execute.
 *
 *   pnpm exec tsx examples/actions/action-create-account.ts
 *   WATERX_EXECUTE=1 ... examples/...      # actually send
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  accountIdFromDigest,
  buildClient,
  loadActiveKeypair,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { createAccount } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  createAccount(client, tx, { alias: process.env.WATERX_ALIAS ?? "example" });

  const { executed, digest } = await simThenMaybeExecute(client, tx, "createAccount", keypair);
  // Only a real execute mints an id: a dry run emits the same event, but the
  // address in it does not exist on chain.
  if (!executed) return;
  const accountId = await accountIdFromDigest(client, digest);
  console.log(
    accountId
      ? `\n  export WATERX_ACCOUNT_ID=${accountId}`
      : `\n  no AccountCreated event served for ${digest} — read ` +
          "`account_object_address` off that digest in an explorer",
  );
});
