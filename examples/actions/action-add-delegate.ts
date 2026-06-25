/**
 * `addDelegate({ accountId, delegateAddress, alias, permissions, expiresAtMs })`
 * — grant another address permission to act through a wxa account. Use
 * the `PERM_*` constants OR-d together to scope the grant.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_DELEGATE=0x... \
 *     pnpm exec tsx examples/actions/action-add-delegate.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { addDelegate, PERM_ALL_TRADING } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  addDelegate(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    delegateAddress: requireEnv("WATERX_DELEGATE"),
    alias: process.env.WATERX_DELEGATE_ALIAS ?? "bot",
    permissions: Number(process.env.WATERX_PERMISSIONS ?? PERM_ALL_TRADING),
    // Default: never expires. Pass a unix-ms timestamp to scope.
    expiresAtMs: process.env.WATERX_EXPIRES_MS ? BigInt(process.env.WATERX_EXPIRES_MS) : undefined,
  });

  await simThenMaybeExecute(client, tx, "addDelegate", keypair);
});
