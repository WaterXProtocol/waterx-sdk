/**
 * `requestWithdraw({ accountId, amount, recipient, coinType })` — start
 * a withdraw of `amount` micro-USDC from a wxa account to `recipient`.
 * The withdraw policy decides whether it's instant or queued.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_AMOUNT=1000000 \
 *     pnpm exec tsx examples/actions/action-request-withdraw.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { requestWithdraw } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair, address } = loadActiveKeypair();
  const tx = new Transaction();

  requestWithdraw(client, tx, {
    accountId: requireEnv("WATERX_ACCOUNT_ID"),
    amount: BigInt(process.env.WATERX_AMOUNT ?? "1000000"),
    recipient: process.env.WATERX_RECIPIENT ?? address,
    coinType: client.getPoolTokenType("USDCUSD"),
  });

  await simThenMaybeExecute(client, tx, "requestWithdraw", keypair);
});
