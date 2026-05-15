/**
 * `stake({ accountId, stakeAlias, stakeType, stakeAmount, rewarderTypes })`
 * — deposit a stake-type coin from the wxa account into the staking pool
 * identified by `stakeAlias`. Pass `rewarderTypes` matching the pool's
 * on-chain rewarder set; pass `[]` if the pool has no rewarders yet.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=1000000 \
 *     pnpm exec tsx examples/actions/action-stake.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { stake } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  stake(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    stakeAlias: process.env.WATERX_STAKE_ALIAS ?? "WLP",
    stakeType: client.wlpType(),
    stakeAmount: BigInt(process.env.WATERX_AMOUNT ?? "1000000"),
    rewarderTypes: [], // populate to match the pool's rewarder_ids
  });

  await simThenMaybeExecute(client, tx, "stake", keypair);
});
