import { Transaction } from "@mysten/sui/transactions";
import { parseWholeDollarU64 } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import type { PerpClient } from "../../../src/perp/client.ts";
import { toU64, toU128, U64_MAX } from "../../../src/perp/fetch/validate.ts";
import { buildPlaceOrderArgument } from "../../../src/perp/user/order.ts";

describe("fetch boundary integer guards (toU64 / toU128)", () => {
  it("passes through valid bigints and safe-integer numbers", () => {
    expect(toU64(0n, "x")).toBe(0n);
    expect(toU64(80_000, "x")).toBe(80_000n);
    expect(toU64(U64_MAX, "x")).toBe(U64_MAX);
    expect(toU128(U64_MAX * U64_MAX, "x")).toBe(U64_MAX * U64_MAX);
  });

  it("rejects 2^53 (unsafe integer) numbers with the param name", () => {
    expect(() => toU64(2 ** 53, "basePriceUsd")).toThrow(RangeError);
    expect(() => toU64(2 ** 53, "basePriceUsd")).toThrow(/basePriceUsd/);
    expect(() => toU128(2 ** 53, "triggerPrice")).toThrow(/triggerPrice/);
    // 2^53 − 1 is still safe and must pass
    expect(toU64(2 ** 53 - 1, "x")).toBe(BigInt(2 ** 53 - 1));
  });

  it("rejects negative, fractional, and non-finite numbers", () => {
    expect(() => toU64(-1, "cursor")).toThrow(RangeError);
    expect(() => toU64(-1n, "cursor")).toThrow(/cursor/);
    expect(() => toU64(1.5, "pageSize")).toThrow(RangeError);
    expect(() => toU64(NaN, "positionId")).toThrow(RangeError);
    expect(() => toU64(Infinity, "orderId")).toThrow(RangeError);
    expect(() => toU128(-1n, "triggerPrice")).toThrow(RangeError);
  });

  it("rejects out-of-width bigints", () => {
    expect(() => toU64(U64_MAX + 1n, "basePriceUsd")).toThrow(/u64/);
    expect(() => toU128(2n ** 128n, "triggerPrice")).toThrow(/u128/);
    expect(toU128(2n ** 128n - 1n, "x")).toBe(2n ** 128n - 1n);
  });
});

describe("parseWholeDollarU64", () => {
  it("parses integer numbers and plain integer strings", () => {
    expect(parseWholeDollarU64(80_000)).toBe(80_000n);
    expect(parseWholeDollarU64(0)).toBe(0n);
    expect(parseWholeDollarU64("3500")).toBe(3_500n);
    expect(parseWholeDollarU64(" 42 ")).toBe(42n);
    expect(parseWholeDollarU64("18446744073709551615")).toBe(U64_MAX);
  });

  it("throws on fractional input instead of silently rounding", () => {
    expect(() => parseWholeDollarU64(0.5)).toThrow(RangeError);
    expect(() => parseWholeDollarU64(79_999.99)).toThrow(RangeError);
    expect(() => parseWholeDollarU64("1.5")).toThrow(RangeError);
  });

  it("throws on negative, non-finite, and non-numeric input", () => {
    expect(() => parseWholeDollarU64(-1)).toThrow(RangeError);
    expect(() => parseWholeDollarU64("-1")).toThrow(RangeError);
    expect(() => parseWholeDollarU64(NaN)).toThrow(RangeError);
    expect(() => parseWholeDollarU64(Infinity)).toThrow(RangeError);
    expect(() => parseWholeDollarU64("")).toThrow(RangeError);
    expect(() => parseWholeDollarU64("80k")).toThrow(RangeError);
    expect(() => parseWholeDollarU64("1e9")).toThrow(RangeError);
  });

  it("throws above u64::MAX and on unsafe-integer numbers", () => {
    expect(() => parseWholeDollarU64("18446744073709551616")).toThrow(RangeError);
    expect(() => parseWholeDollarU64(2 ** 53)).toThrow(RangeError);
  });
});

describe("write-surface guards (representative)", () => {
  // Minimal stub — the guard throws while building the arguments object,
  // before anything touches the chain or the client config beyond the package.
  const stubClient = {
    config: { packages: { waterx_perp: { published_at: "0x2" } } },
  } as unknown as PerpClient;
  const validOrder = {
    isLong: true,
    isStopOrder: false,
    reduceOnly: false,
    size: 1_000_000_000n,
    collateralAmount: 1_000_000n,
  };

  it("buildPlaceOrderArgument throws named RangeErrors on garbage numerics", () => {
    expect(() =>
      buildPlaceOrderArgument(stubClient, new Transaction(), { ...validOrder, size: 2 ** 53 }),
    ).toThrow(/size/);
    expect(() =>
      buildPlaceOrderArgument(stubClient, new Transaction(), {
        ...validOrder,
        collateralAmount: 1.5,
      }),
    ).toThrow(/collateralAmount/);
    expect(() =>
      buildPlaceOrderArgument(stubClient, new Transaction(), {
        ...validOrder,
        triggerPrice: NaN,
      }),
    ).toThrow(/triggerPrice/);
    expect(() =>
      buildPlaceOrderArgument(stubClient, new Transaction(), {
        ...validOrder,
        acceptablePrice: -1,
      }),
    ).toThrow(/acceptablePrice/);
  });
});
