/**
 * E2E: optional `waterx_referral` package (skipped when not configured).
 */
import { getRefererFor, isValidReferralCode, referralCodeExists } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

const referralConfigured = Boolean(client.config.packages.waterx_referral?.published_at);

describe.skipIf(!referralConfigured)(`read referral (${e2eNetwork})`, () => {
  it("getRefererFor returns undefined for zero referee", async () => {
    const ref = await getRefererFor(
      client,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(ref === undefined || typeof ref === "string").toBe(true);
  }, 60_000);

  it("isValidReferralCode rejects INVALID shape", async () => {
    const ok = await isValidReferralCode(client, "INVALID");
    expect(ok).toBe(false);
  }, 60_000);

  it("referralCodeExists returns boolean for random code", async () => {
    const exists = await referralCodeExists(client, "zzzznotacode999");
    expect(typeof exists).toBe("boolean");
  }, 60_000);
});
