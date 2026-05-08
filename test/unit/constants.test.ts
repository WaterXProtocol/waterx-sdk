import {
  ORDER_LIMIT_BUY,
  ORDER_LIMIT_SELL,
  ORDER_STOP_BUY,
  ORDER_STOP_SELL,
  PERM_ALL,
  PERM_ALL_TRADING,
  PERM_CANCEL_ORDER,
  PERM_CLOSE_POSITION,
  PERM_DEPOSIT_COLLATERAL,
  PERM_OPEN_POSITION,
  PERM_PLACE_ORDER,
  PERM_WITHDRAW_COLLATERAL,
  PYTH_TESTNET_FEED_IDS,
  TESTNET_OBJECTS,
  TESTNET_PACKAGE_IDS,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

describe("permission bitmasks", () => {
  it("PERM_ALL_TRADING is bits 0–5 (63)", () => {
    const combined =
      PERM_OPEN_POSITION |
      PERM_CLOSE_POSITION |
      PERM_PLACE_ORDER |
      PERM_CANCEL_ORDER |
      PERM_DEPOSIT_COLLATERAL |
      PERM_WITHDRAW_COLLATERAL;
    expect(PERM_ALL_TRADING).toBe(63);
    expect(combined).toBe(63);
  });

  it("PERM_ALL is 4095 (12 bits)", () => {
    expect(PERM_ALL).toBe(4095);
  });
});

describe("order type tags", () => {
  it("matches Move convention 0–3", () => {
    expect(ORDER_LIMIT_BUY).toBe(0);
    expect(ORDER_LIMIT_SELL).toBe(1);
    expect(ORDER_STOP_BUY).toBe(2);
    expect(ORDER_STOP_SELL).toBe(3);
  });
});

describe("testnet address shape", () => {
  const ADDR_LEN = 66; // 0x + 64 hex

  it("TESTNET_PACKAGE_IDS values are 0x-prefixed 32-byte addresses", () => {
    for (const [k, v] of Object.entries(TESTNET_PACKAGE_IDS)) {
      expect(v, k).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(v.length, k).toBe(ADDR_LEN);
    }
  });

  it("TESTNET_OBJECTS values are 0x-prefixed 32-byte addresses", () => {
    for (const [k, v] of Object.entries(TESTNET_OBJECTS)) {
      if (k === "CLOCK") {
        expect(v).toBe("0x6");
        continue;
      }
      expect(v, k).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(v.length, k).toBe(ADDR_LEN);
    }
  });
});

describe("PYTH_TESTNET_FEED_IDS", () => {
  it("has BTC/USD, ETH/USD, USDC/USD", () => {
    expect(PYTH_TESTNET_FEED_IDS["BTC/USD"]).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(PYTH_TESTNET_FEED_IDS["ETH/USD"]).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(PYTH_TESTNET_FEED_IDS["USDC/USD"]).toMatch(/^0x[a-fA-F0-9]+$/);
  });
});
