import {
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
} from "@waterx/perp-sdk";
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
});
