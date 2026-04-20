/**
 * Pure SDK validation for referral helpers (no chain, no admin keystore).
 */
import { Transaction } from "@mysten/sui/transactions";
import { setReferralCode, WaterXClient } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { isValidReferralCode } from "../../src/user/referral";

describe("Referral (unit)", () => {
  describe("isValidReferralCode", () => {
    it("accepts lowercase alphanumeric", () => {
      expect(isValidReferralCode("abc123")).toBe(true);
      expect(isValidReferralCode("hello")).toBe(true);
      expect(isValidReferralCode("0")).toBe(true);
    });

    it("rejects uppercase", () => {
      expect(isValidReferralCode("ABC")).toBe(false);
      expect(isValidReferralCode("Hello")).toBe(false);
    });

    it("rejects special characters", () => {
      expect(isValidReferralCode("abc-123")).toBe(false);
      expect(isValidReferralCode("abc_123")).toBe(false);
      expect(isValidReferralCode("abc 123")).toBe(false);
      expect(isValidReferralCode("abc!")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isValidReferralCode("")).toBe(false);
    });
  });

  describe("setReferralCode (validation)", () => {
    it("throws on invalid code before tx", () => {
      const client = WaterXClient.testnet();
      const tx = new Transaction();
      expect(() => setReferralCode(client, tx, { code: "INVALID" })).toThrow(
        /Invalid referral code/,
      );
    });
  });
});
