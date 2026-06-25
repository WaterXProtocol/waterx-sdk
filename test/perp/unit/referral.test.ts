import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { setReferralCode, useReferralCode } from "../../../src/perp/user/referral.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("Referral PTB builders (v3)", () => {
  const client = createUnitTestClient();

  it("setReferralCode wires waterx_referral table", () => {
    const tx = new Transaction();
    setReferralCode(client, tx, { code: "abc123" });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("useReferralCode wires waterx_referral table", () => {
    const tx = new Transaction();
    useReferralCode(client, tx, { code: "refcode1" });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("throws when referral package missing from config", () => {
    const bare = createUnitTestClient();
    delete (bare.config.packages as { waterx_referral?: unknown }).waterx_referral;
    const tx = new Transaction();
    expect(() => setReferralCode(bare, tx, { code: "x" })).toThrow(
      /referral package not configured/,
    );
  });
});
