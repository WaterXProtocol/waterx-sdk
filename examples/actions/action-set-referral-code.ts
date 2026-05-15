/**
 * `setReferralCode({ code })` — claim a referral code for the caller's
 * address. Validate first with `isValidReferralCode` + `referralCodeExists`
 * to keep the form snappy.
 *
 *   WATERX_REFERRAL_CODE=alpha \
 *     pnpm exec tsx examples/actions/action-set-referral-code.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import { buildClient, loadActiveKeypair, run, simThenMaybeExecute } from "../_shared.ts";
import { setReferralCode } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const tx = new Transaction();

  setReferralCode(client, tx, {
    code: process.env.WATERX_REFERRAL_CODE ?? "example",
  });

  await simThenMaybeExecute(client, tx, "setReferralCode", keypair);
});
