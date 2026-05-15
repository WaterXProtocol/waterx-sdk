/**
 * `setDelegateProtocolPermission({ accountId, delegateAddress, permissions, protocolType })`
 * — per-protocol fine-grain perm grant. After the top-level delegate is
 * added with `addDelegate`, scope what each protocol witness it can sign for.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_DELEGATE=0x... \
 *     pnpm exec tsx examples/actions/action-set-delegate-permission.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { PERM_ALL_TRADING, setDelegateProtocolPermission } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  const protocolType =
    process.env.WATERX_PROTOCOL_TYPE ??
    `${client.config.packages.waterx_perp.original_id}::account_data::WaterXPerp`;

  setDelegateProtocolPermission(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    delegateAddress: requireEnv("WATERX_DELEGATE"),
    permissions: Number(process.env.WATERX_PERMISSIONS ?? PERM_ALL_TRADING),
    protocolType,
  });

  await simThenMaybeExecute(client, tx, "setDelegateProtocolPermission", keypair);
});
