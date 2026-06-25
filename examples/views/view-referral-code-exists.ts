/**
 * `referralCodeExists(code)` — on-chain availability check (returns true
 * if already claimed). Use after `isValidReferralCode` in the signup
 * form's "is this code available?" hint.
 *
 *   WATERX_REFERRAL_CODE=alpha pnpm exec tsx examples/views/view-referral-code-exists.ts
 */
import { buildClient, run } from "../_shared.ts";
import { referralCodeExists } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const code = process.env.WATERX_REFERRAL_CODE ?? "smoke";
  const taken = await referralCodeExists(client, code);
  console.log(`  referralCodeExists("${code}") → ${taken}`);
});
