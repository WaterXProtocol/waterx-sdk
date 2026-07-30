/**
 * `utils/validate.ts` — the shared numeric-domain guards used by BOTH the
 * `perp/fetch` reads and the tx-build (write) surface, plus
 * `parseWholeDollarU64`, the whole-dollar view-price parse layered on `toU64`
 * (its string form is the only rule it owns; the numeric domain is `toU64`'s).
 */
import { Transaction } from "@mysten/sui/transactions";
import { parseWholeDollarU64 } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import {
  toU64,
  toU64Arg,
  toU64OrNull,
  toU128,
  toU128OrNull,
  U64_MAX,
} from "../../../src/utils/validate.ts";

describe("boundary integer guards (toU64 / toU128)", () => {
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

describe("optional / PTB-argument variants", () => {
  it("toU64OrNull / toU128OrNull pass null and undefined through as null", () => {
    expect(toU64OrNull(null, "orderId")).toBeNull();
    expect(toU64OrNull(undefined, "orderId")).toBeNull();
    expect(toU128OrNull(undefined, "triggerPrice")).toBeNull();
    expect(toU64OrNull(7, "orderId")).toBe(7n);
    expect(toU128OrNull(7n, "triggerPrice")).toBe(7n);
    // 0 is a VALUE, not an absence — it must survive the passthrough.
    expect(toU64OrNull(0, "orderId")).toBe(0n);
    expect(() => toU64OrNull(1.5, "orderId")).toThrow(/orderId/);
  });

  it("toU64Arg passes a TransactionArgument through unvalidated", () => {
    const chained = new Transaction().pure.u64(1n);
    expect(toU64Arg(chained, "stakeAmount")).toBe(chained);
    expect(toU64Arg(5, "stakeAmount")).toBe(5n);
    expect(() => toU64Arg(2 ** 53, "stakeAmount")).toThrow(/stakeAmount/);
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

  it("names the parameter in the message on every path", () => {
    expect(() => parseWholeDollarU64(-1)).toThrow(/whole-dollar USD price/);
    expect(() => parseWholeDollarU64("80k")).toThrow(/whole-dollar USD price/);
    expect(() => parseWholeDollarU64("18446744073709551616")).toThrow(/whole-dollar USD price/);
  });
});
