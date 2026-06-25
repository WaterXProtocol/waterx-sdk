/**
 * `isValidReferralCode(code)` — pure-syntax validation (charset / length).
 * Use this in the signup form before hitting `referralCodeExists` to keep
 * UX snappy.
 *
 *   WATERX_REFERRAL_CODE=alpha pnpm exec tsx examples/views/view-is-valid-referral-code.ts
 */
import { buildClient, run } from "../_shared.ts";
import { isValidReferralCode } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const code = process.env.WATERX_REFERRAL_CODE ?? "smoke";
  const ok = await isValidReferralCode(client, code);
  console.log(`  isValidReferralCode("${code}") → ${ok}`);
});
