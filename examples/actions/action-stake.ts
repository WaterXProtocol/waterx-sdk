/**
 * `stake({ accountId, stakeAlias, stakeType, stakeAmount })` — deposit a
 * stake-type coin from the wxa account into the staking pool identified by
 * `stakeAlias`. Every rewarder declared for the pool in
 * `config.packages.waterx_staking.rewarders[stakeAlias]` is settled in the
 * same PTB automatically — the on-chain checker requires all-or-nothing.
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
  });

  await simThenMaybeExecute(client, tx, "stake", keypair);
});
