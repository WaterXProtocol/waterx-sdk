import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_OBJECT_ID } from "~predict/constants.ts";
import {
  bytesToHex,
  clockArg,
  createAccountRequest,
  idArg,
  marketIdArg,
  normalizeMarketId,
  objectArg,
  optionU64,
  receivingCoinArg,
  requireConfig,
  resolveAccountRegistry,
  resolveGlobalConfig,
  resolveMarketRegistry,
  resolvePackageId,
  resolveSettlementCoinType,
  toBigInt,
} from "~predict/utils.ts";
import { describe, expect, it, vi } from "vitest";

import { createMockPredictClient } from "../helpers/mock-client.ts";

describe("normalizeMarketId", () => {
  it("accepts utf-8 key", () => {
    const id = "hello-market";
    expect(Array.from(normalizeMarketId(id))).toEqual(Array.from(new TextEncoder().encode(id)));
  });

  it("accepts hex string", () => {
    expect(Array.from(normalizeMarketId("0x0102"))).toEqual([1, 2]);
    expect(Array.from(normalizeMarketId("0X0102"))).toEqual([1, 2]);
  });

  it("rejects odd-length hex", () => {
    expect(() => normalizeMarketId("0x123")).toThrow(/Invalid hex market id/);
  });

  it("rejects invalid hex digit characters", () => {
    expect(() => normalizeMarketId("0xgg")).toThrow(/Invalid hex market id/);
    expect(() => normalizeMarketId("0x00zz")).toThrow(/Invalid hex market id/);
  });

  it("accepts Uint8Array passthrough", () => {
    const u = new Uint8Array([9, 9]);
    expect(normalizeMarketId(u)).toBe(u);
  });

  it("accepts number array", () => {
    expect(Array.from(normalizeMarketId([1, 2]))).toEqual([1, 2]);
  });
});

describe("bytesToHex", () => {
  it("prefixes 0x", () => {
    expect(bytesToHex(new Uint8Array([0, 255]))).toBe("0x00ff");
  });
});

describe("toBigInt", () => {
  it("normalizes number and string", () => {
    expect(toBigInt(3)).toBe(3n);
    expect(toBigInt("4")).toBe(4n);
    expect(toBigInt(5n)).toBe(5n);
  });

  it("rejects non-numeric strings", () => {
    expect(() => toBigInt("not-a-number")).toThrow();
  });

  it("rejects empty and whitespace strings", () => {
    expect(() => toBigInt("")).toThrow(/empty string/);
    expect(() => toBigInt("  ")).toThrow(/empty string/);
  });
});

describe("requireConfig", () => {
  it("throws on empty", () => {
    expect(() => requireConfig(undefined, "x")).toThrow(/x is required/);
    expect(() => requireConfig(null, "x")).toThrow(/x is required/);
    expect(() => requireConfig("", "x")).toThrow(/x is required/);
  });
});

describe("clockArg", () => {
  it("falls back to CLOCK_OBJECT_ID when tx.object.clock is unavailable", () => {
    const tx = new Transaction();
    const objectFn = tx.object.bind(tx);
    tx.object = Object.assign(objectFn, { clock: undefined }) as typeof tx.object;
    const spy = vi.spyOn(tx, "object");
    clockArg(tx);
    expect(spy).toHaveBeenCalledWith(CLOCK_OBJECT_ID);
  });
});

describe("resolve*", () => {
  const client = createMockPredictClient();

  it("resolvePackageId uses override", () => {
    expect(resolvePackageId(client, "0xoverride")).toBe("0xoverride");
    expect(resolvePackageId(client)).toBe(client.packageId());
  });

  it("resolveSettlementCoinType", () => {
    expect(resolveSettlementCoinType(client, "0xt")).toBe("0xt");
    expect(resolveSettlementCoinType(client)).toBe(client.settlementCoinType());
  });

  it("resolvePackageId / resolveSettlementCoinType treat empty string as missing", () => {
    expect(resolvePackageId(client, "")).toBe(client.packageId());
    expect(resolveSettlementCoinType(client, "")).toBe(client.settlementCoinType());
  });

  it("resolveMarketRegistry / resolveAccountRegistry require config or param", () => {
    const stripped = createMockPredictClient({
      packages: {
        waterx_prediction: {
          ...client.config.packages.waterx_prediction,
          market_registries: {},
        },
      },
    });
    expect(() => resolveMarketRegistry(stripped)).toThrow(/market_registries\.USD/);
    expect(resolveMarketRegistry(stripped, "0xm")).toBe("0xm");
    expect(resolveMarketRegistry(client)).toBe(client.marketRegistry());
    expect(resolveAccountRegistry(client)).toBe(client.accountRegistry());
    expect(resolveGlobalConfig(client)).toBe(client.globalConfigId());
  });
});

describe("PTB arg helpers", () => {
  const client = createMockPredictClient();

  it("objectArg / idArg pass through transaction arguments", () => {
    const tx = new Transaction();
    const coin = tx.object("0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51");
    expect(objectArg(tx, coin)).toBe(coin);
    expect(idArg(tx, coin)).toBe(coin);
  });

  it("idArg wraps string ids as pure.id", () => {
    const tx = new Transaction();
    const arg = idArg(tx, "0x0000000000000000000000000000000000000000000000000000000000000001");
    expect(arg).toBeDefined();
  });

  it("marketIdArg encodes vector<u8>", () => {
    const tx = new Transaction();
    const arg = marketIdArg(tx, "0x0102");
    expect(arg).toBeDefined();
  });

  it("createAccountRequest uses request_with_account when bucketAccount set", () => {
    const tx = new Transaction();
    createAccountRequest(client, tx, {
      bucketAccount: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
    });
    const data = tx.getData();
    const move = data.commands.find((c) => c.$kind === "MoveCall")?.MoveCall;
    expect(move?.function).toBe("request_with_account");
  });
});

describe("optionU64 / receivingCoinArg", () => {
  it("optionU64 returns a build thunk", () => {
    const tx = new Transaction();
    const build = optionU64(42n);
    expect(typeof build).toBe("function");
    if (typeof build === "function") build(tx);
    const buildNone = optionU64(null);
    if (typeof buildNone === "function") buildNone(tx);
  });

  it("receivingCoinArg builds receiving ref", () => {
    const tx = new Transaction();
    const ref = receivingCoinArg(tx, {
      objectId: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
      version: "1",
      digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(ref).toBeDefined();
  });
});
