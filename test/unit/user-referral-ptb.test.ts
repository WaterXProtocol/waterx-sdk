import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client";
import { setReferralCode, useReferralCode } from "../../src/user/referral";

const client = WaterXClient.testnet();

describe("user/referral PTB builders", () => {
  it("setReferralCode appends referral_table::set_referral_code", () => {
    const tx = new Transaction();
    setReferralCode(client, tx, { code: "abc123" });
    const cmds = tx.getData().commands;
    // v2: account::request prepended → 2 commands.
    expect(cmds?.length).toBe(2);
  });

  it("useReferralCode appends use_referral_code", () => {
    const tx = new Transaction();
    useReferralCode(client, tx, { code: "ref9" });
    // v2: account::request prepended → 2 commands.
    expect(tx.getData().commands?.length).toBe(2);
  });

  it("useReferralCode (alias for bindReferral) appends use_referral_code", () => {
    const tx = new Transaction();
    useReferralCode(client, tx, { code: "bind1" });
    // v2: account::request prepended → 2 commands.
    expect(tx.getData().commands?.length).toBe(2);
  });
});
