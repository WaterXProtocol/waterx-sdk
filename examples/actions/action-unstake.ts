/**
 * `unstake({ accountId, stakeAlias, stakeType, withdrawalAmount, rewarderTypes })`
 * — withdraw a stake-type coin back to the wxa account. Same rewarder-set
 * shape contract as `stake`.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=1000000 \
 *     pnpm exec tsx examples/actions/action-unstake.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { unstake } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  unstake(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    stakeAlias: process.env.WATERX_STAKE_ALIAS ?? "WLP",
    stakeType: client.wlpType(),
    withdrawalAmount: BigInt(process.env.WATERX_AMOUNT ?? "1000000"),
    rewarderTypes: [],
  });

  await simThenMaybeExecute(client, tx, "unstake", keypair);
});
