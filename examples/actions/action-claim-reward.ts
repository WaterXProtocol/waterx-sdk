/**
 * `claimReward({ accountId, stakeAlias, stakeType, rewardType })` —
 * harvest accrued rewards (of `rewardType`) for an active stake.
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/actions/action-claim-reward.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { claimReward } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  claimReward(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    stakeAlias: process.env.WATERX_STAKE_ALIAS ?? "WLP",
    stakeType: client.wlpType(),
    rewardType: process.env.WATERX_REWARD_TYPE ?? client.creditType(),
  });

  await simThenMaybeExecute(client, tx, "claimReward", keypair);
});
