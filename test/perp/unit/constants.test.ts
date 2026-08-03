import {
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MS_PER_YEAR,
  ORDER_LIMIT_BUY,
  ORDER_LIMIT_SELL,
  ORDER_STOP_BUY,
  ORDER_STOP_SELL,
  ORDER_TAG_WILDCARD,
  PERM_ALL,
  PERM_ALL_TRADING,
  PERM_CANCEL_ORDER,
  PERM_CLOSE_POSITION,
  PERM_DECREASE_POSITION,
  PERM_DEPOSIT_COLLATERAL,
  PERM_INCREASE_POSITION,
  PERM_OPEN_POSITION,
  PERM_PLACE_ORDER,
  PERM_WITHDRAW_COLLATERAL,
  rawPrice,
} from "@waterx/sdk";
import type { ExactDecimalUsd, RawPriceInput } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

describe("permission bitmasks", () => {
  it("PERM_ALL_TRADING is bits 0–7 (255)", () => {
    const combined =
      PERM_OPEN_POSITION |
      PERM_CLOSE_POSITION |
      PERM_INCREASE_POSITION |
      PERM_DECREASE_POSITION |
      PERM_PLACE_ORDER |
      PERM_CANCEL_ORDER |
      PERM_DEPOSIT_COLLATERAL |
      PERM_WITHDRAW_COLLATERAL;
    expect(PERM_ALL_TRADING).toBe(255);
    expect(combined).toBe(255);
  });

  it("PERM_ALL is 65535 (16 bits)", () => {
    expect(PERM_ALL).toBe(65535);
  });
});

describe("order type tags", () => {
  it("matches Move convention 0–3 and wildcard 255", () => {
    expect(ORDER_LIMIT_BUY).toBe(0);
    expect(ORDER_LIMIT_SELL).toBe(1);
    expect(ORDER_STOP_BUY).toBe(2);
    expect(ORDER_STOP_SELL).toBe(3);
    expect(ORDER_TAG_WILDCARD).toBe(255);
  });
});

describe("time constants", () => {
  it("pins the ms-per-unit values", () => {
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(MS_PER_HOUR).toBe(3_600_000);
    expect(MS_PER_YEAR).toBe(31_536_000_000);
  });
});

describe("rawPrice", () => {
  it("scales USD to 1e9 fixed-point", () => {
    expect(rawPrice(50_000)).toBe(50_000_000_000_000n);
    expect(rawPrice("1.5")).toBe(1_500_000_000n);
  });

  it("throws on non-finite USD input", () => {
    expect(() => rawPrice(Number.NaN)).toThrow(/Invalid USD price/);
    expect(() => rawPrice("not-a-number")).toThrow(/Invalid USD price/);
    expect(() => rawPrice(Number.POSITIVE_INFINITY)).toThrow(/Invalid USD price/);
  });

  // The two modes named by `RawPriceInput`: `number` (lossy past the f64 cliff)
  // vs `ExactDecimalUsd` (digit-exact). The types carry the distinction; these
  // pin the runtime behaviour that makes it worth carrying.
  describe("ExactDecimalUsd (string) mode — digit-exact", () => {
    it("agrees with the number mode below the f64 cliff", () => {
      const usd: ExactDecimalUsd = "95000.5";
      expect(rawPrice(usd)).toBe(95_000_500_000_000n);
      expect(rawPrice(95_000.5)).toBe(rawPrice(usd));
    });

    it("stays exact ABOVE the cliff, where the number mode drifts", () => {
      // usd × 1e9 > 2^53 (≈ $9,007,199): f64 can no longer hold every integer,
      // so Math.round(usd * 1e9) lands on a neighbouring representable double.
      const exact = rawPrice("12345678.123456789");
      expect(exact).toBe(12_345_678_123_456_789n);
      expect(rawPrice(12_345_678.123456789)).not.toBe(exact);
    });

    it("keeps trailing-zero padding and the 9-decimal grid limit", () => {
      expect(rawPrice("2.5")).toBe(2_500_000_000n);
      expect(rawPrice("0.000000001")).toBe(1n);
      expect(() => rawPrice("1.0000000001")).toThrow(/9 decimal places/);
    });

    it("rejects the string shapes `Number()` would have swallowed", () => {
      expect(() => rawPrice("1e9")).toThrow(/Invalid USD price/);
      expect(() => rawPrice("-5")).toThrow(/Invalid USD price/);
      expect(() => rawPrice("")).toThrow(/Invalid USD price/);
    });
  });

  it("number mode is exact for a typical trigger price below the cliff", () => {
    const asNumber: RawPriceInput = 95_000;
    expect(rawPrice(asNumber)).toBe(95_000_000_000_000n);
  });
});
