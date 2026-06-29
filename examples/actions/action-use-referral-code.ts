/**
 * `useReferralCode({ code })` — bind the caller as the referee of the
 * owner of `code`. One-time per address; aborts if already bound.
 *
 *   WATERX_REFERRAL_CODE=alpha \
 *     pnpm exec tsx examples/actions/action-use-referral-code.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import { buildClient, loadActiveKeypair, run, simThenMaybeExecute } from "../_shared.ts";
import { useReferralCode } from "../../src/perp/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  useReferralCode(client, tx, {
    code: process.env.WATERX_REFERRAL_CODE ?? "example",
  });

  await simThenMaybeExecute(client, tx, "useReferralCode", keypair);
});
