/**
 * E2E: referral table builders (skipped when `waterx_referral` missing from config).
 */
import { Transaction } from "@mysten/sui/transactions";
import { setReferralCode } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import { assertSimulateReached } from "../helpers/e2e/simulate-assertions.ts";

const referralConfigured = Boolean(client.config.packages.waterx_referral?.published_at);

describe.skipIf(!referralConfigured)(`referral builders (${e2eNetwork})`, () => {
  it("composes setReferralCode PTB (simulate-only)", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(30_000_000);
    setReferralCode(client, tx, { code: "abcd1234" });
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);
});
