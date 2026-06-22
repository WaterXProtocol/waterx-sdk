import { Transaction } from "@mysten/sui/transactions";
import { mapOrderView } from "~predict/bcs.ts";
import {
  assertU64,
  bytesToHex,
  marketIdBytesFromUnknown,
  normalizeMarketId,
  receivingCoinArg,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "~predict/utils.ts";
import { describe, expect, it } from "vitest";

import { orderFixture } from "../fixtures/bcs-fixtures.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";

const U64_MAX = (1n << 64n) - 1n;

describe("toBigInt / assertU64", () => {
  it("accepts valid integers", () => {
    expect(toBigInt(3)).toBe(3n);
    expect(toBigInt("42")).toBe(42n);
    expect(toBigInt(U64_MAX)).toBe(U64_MAX);
  });

  it("rejects empty and whitespace strings", () => {
    expect(() => toBigInt("")).toThrow(/empty string/);
    expect(() => toBigInt("   ")).toThrow(/empty string/);
  });

  it("rejects negative numbers and non-integers", () => {
    expect(() => toBigInt(-1)).toThrow(/non-negative/);
    expect(() => toBigInt("-1")).toThrow(/Invalid integer/);
    expect(() => toBigInt("1.5")).toThrow(/Invalid integer/);
    expect(() => toBigInt("not-a-number")).toThrow(/Invalid integer/);
  });

  it("rejects values above u64 max", () => {
    expect(() => toBigInt(U64_MAX + 1n)).toThrow(/exceeds u64 max/);
    expect(() => assertU64(U64_MAX + 1n)).toThrow(/exceeds u64 max/);
  });
});

describe("normalizeMarketId", () => {
  it("parses valid hex", () => {
    expect(Array.from(normalizeMarketId("0x0102"))).toEqual([1, 2]);
    expect(Array.from(normalizeMarketId("0X0102"))).toEqual([1, 2]);
  });

  it("rejects invalid hex", () => {
    expect(() => normalizeMarketId("0x123")).toThrow(/Invalid hex market id/);
    expect(() => normalizeMarketId("0xgg")).toThrow(/Invalid hex market id/);
    expect(() => normalizeMarketId("0x00zz")).toThrow(/Invalid hex market id/);
    expect(() => normalizeMarketId("0x")).toThrow(/empty hex/);
  });

  it("validates number[] bytes", () => {
    expect(Array.from(normalizeMarketId([1, 2]))).toEqual([1, 2]);
    expect(() => normalizeMarketId([-1, 256, 1.5])).toThrow(/Invalid market id byte/);
  });

  it("UTF-8 encodes keys without 0x prefix", () => {
    const id = "market-alpha";
    expect(normalizeMarketId(id)).toEqual(new TextEncoder().encode(id));
  });

  it("parses 0x-prefixed strings as hex (documented behavior)", () => {
    expect(Array.from(normalizeMarketId("0xdead"))).toEqual([0xde, 0xad]);
  });
});

describe("resolvePackageId / resolveSettlementCoinType", () => {
  const client = createMockPredictClient();

  it("treats empty override as missing and falls back to config", () => {
    expect(resolvePackageId(client, "")).toBe(client.packageId());
    expect(resolveSettlementCoinType(client, "")).toBe(client.settlementCoinType());
  });
});

describe("marketIdBytesFromUnknown / mapOrderView", () => {
  it("rejects string market_id when decoding views", () => {
    expect(() => marketIdBytesFromUnknown("0x0102")).toThrow(/strings are not supported/);
    expect(() =>
      mapOrderView({ ...orderFixture, market_id: "market-1" as unknown as Uint8Array }),
    ).toThrow(/strings are not supported/);
  });

  it("accepts Uint8Array and number[]", () => {
    expect(marketIdBytesFromUnknown(new Uint8Array([1, 2]))).toEqual(new Uint8Array([1, 2]));
    expect(Array.from(marketIdBytesFromUnknown([3, 4]))).toEqual([3, 4]);
  });
});

describe("receivingCoinArg", () => {
  it("rejects fractional version", () => {
    const tx = new Transaction();
    expect(() =>
      receivingCoinArg(tx, {
        objectId: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
        version: 1.5,
        digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    ).toThrow(/Invalid integer/);
  });

  it("accepts integer version", () => {
    const tx = new Transaction();
    const ref = receivingCoinArg(tx, {
      objectId: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
      version: 42,
      digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(ref).toBeDefined();
  });
});

describe("bytesToHex", () => {
  it("formats in-range bytes", () => {
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe("0x00ff");
  });

  it("rejects out-of-range number[] elements", () => {
    expect(() => bytesToHex([-1, 300])).toThrow(/Invalid market id byte/);
  });
});
