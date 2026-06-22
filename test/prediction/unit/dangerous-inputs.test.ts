import { Transaction } from "@mysten/sui/transactions";
import { addDelegate } from "~predict/account.ts";
import { adminWithdraw } from "~predict/admin.ts";
import { mapOrderView, mapRegistryView } from "~predict/bcs.ts";
import { getOrder, getRegistry } from "~predict/fetch.ts";
import { fillOrder, placeOrder, resolveMarket } from "~predict/prediction.ts";
import {
  marketIdArg,
  marketIdBytesFromUnknown,
  optionU64,
  receivingCoinArg,
  toBigInt,
} from "~predict/utils.ts";
import { describe, expect, it, vi } from "vitest";

import { orderFixture } from "../fixtures/bcs-fixtures.ts";
import {
  minimalAccountOpsParams,
  minimalPlaceOrderParams,
  PTB_DUMMY,
} from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { mockCommandResults, stubSimulateResolved } from "../helpers/mock-simulate.ts";

const COIN = {
  objectId: PTB_DUMMY.coin,
  version: 1,
  digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
} as const;

const U64_MAX = (1n << 64n) - 1n;

describe("toBigInt edge cases", () => {
  it.each([NaN, Infinity, -Infinity] as const)("rejects non-finite number %s", (value) => {
    expect(() => toBigInt(value)).toThrow(/Invalid integer/);
  });

  it("rejects hex-looking numeric strings (not decimal)", () => {
    expect(() => toBigInt("0x10")).toThrow(/Invalid integer/);
    expect(() => toBigInt("1e3")).toThrow(/Invalid integer/);
  });
});

describe("marketIdBytesFromUnknown rejects non-byte shapes", () => {
  it.each([null, undefined, 42, {}, { length: 1 }])("rejects %j", (raw) => {
    expect(() => marketIdBytesFromUnknown(raw)).toThrow(/market_id must be Uint8Array/);
  });
});

describe("receivingCoinArg version validation", () => {
  const tx = new Transaction();

  it.each(["", "  ", "abc", "-1", "1.5"] as const)(
    "rejects invalid string version %j",
    (version) => {
      expect(() => receivingCoinArg(tx, { ...COIN, version })).toThrow();
    },
  );

  it("accepts bigint version", () => {
    expect(receivingCoinArg(tx, { ...COIN, version: 99n })).toBeDefined();
  });

  it("rejects version above u64 max", () => {
    expect(() => receivingCoinArg(tx, { ...COIN, version: U64_MAX + 1n })).toThrow(
      /exceeds u64 max/,
    );
  });
});

describe("optionU64 propagates toBigInt validation", () => {
  it("rejects empty string inside option Some", () => {
    const tx = new Transaction();
    const build = optionU64("");
    expect(() => {
      if (typeof build === "function") build(tx);
    }).toThrow(/empty string/);
  });

  it("keeps null/undefined as None without calling toBigInt", () => {
    const tx = new Transaction();
    expect(() => {
      const build = optionU64(null);
      if (typeof build === "function") build(tx);
    }).not.toThrow();
  });
});

describe("PTB builders fail before emitting invalid Move args", () => {
  const client = createMockPredictClient();

  it("placeOrder rejects invalid maxSpend", () => {
    const tx = new Transaction();
    expect(() =>
      placeOrder(client, tx, {
        ...minimalPlaceOrderParams(client),
        maxSpend: "" as unknown as bigint,
      }),
    ).toThrow(/empty string/);
  });

  it("placeOrder rejects invalid marketId", () => {
    const tx = new Transaction();
    expect(() =>
      placeOrder(client, tx, {
        ...minimalPlaceOrderParams(client),
        marketId: "0xgg",
      }),
    ).toThrow(/Invalid hex market id/);
  });

  it("placeOrder rejects invalid selection", () => {
    const tx = new Transaction();
    expect(() =>
      placeOrder(client, tx, {
        ...minimalPlaceOrderParams(client),
        selection: "yes" as "YES",
      }),
    ).toThrow(/Invalid Selection/);
  });

  it("resolveMarket rejects invalid outcome", () => {
    const tx = new Transaction();
    expect(() =>
      resolveMarket(client, tx, {
        marketId: new Uint8Array([1]),
        outcome: "MAYBE" as "YES",
      }),
    ).toThrow(/Invalid Outcome/);
  });

  it("addDelegate rejects invalid expiresAtMs", () => {
    const tx = new Transaction();
    expect(() =>
      addDelegate(client, tx, {
        ...minimalAccountOpsParams(),
        expiresAtMs: "",
      }),
    ).toThrow(/empty string/);
  });

  it("fillOrder rejects invalid filledCost before moveCall", () => {
    const tx = new Transaction();
    expect(() =>
      fillOrder(client, tx, {
        orderId: 1n,
        filledShares: 1n,
        filledCost: "not-a-number",
      }),
    ).toThrow(/Invalid integer/);
  });

  it("adminWithdraw rejects negative amount", () => {
    const tx = new Transaction();
    expect(() =>
      adminWithdraw(client, tx, {
        adminCap: PTB_DUMMY.adminCap,
        amount: -1n,
        recipient: PTB_DUMMY.recipient,
      }),
    ).toThrow(/non-negative/);
  });
});

describe("marketIdArg", () => {
  it("surfaces normalizeMarketId errors", () => {
    const tx = new Transaction();
    expect(() => marketIdArg(tx, "0x")).toThrow(/empty hex/);
  });
});

describe("BCS view mapping hazards", () => {
  it("mapRegistryView throws when required numeric fields are missing", () => {
    expect(() => mapRegistryView({})).toThrow();
  });

  it("mapOrderView rejects invalid market_id bytes in number[]", () => {
    expect(() => mapOrderView({ ...orderFixture, market_id: [256] })).toThrow(
      /Invalid market id byte/,
    );
  });

  it("mapOrderView rejects non-numeric position_id in option Some", () => {
    expect(() => mapOrderView({ ...orderFixture, position_id: "bad" })).toThrow();
  });
});

describe("fetch input validation (before simulate)", () => {
  it("getOrder rejects invalid orderId", async () => {
    const client = createMockPredictClient();
    const simulate = vi.fn();
    vi.spyOn(client, "simulate").mockImplementation(simulate);
    await expect(getOrder(client, { orderId: "" })).rejects.toThrow(/empty string/);
    expect(simulate).not.toHaveBeenCalled();
  });
});

describe("fetch simulate hazards", () => {
  it("rejects empty BCS payload at parse time", async () => {
    const client = createMockPredictClient();
    vi.spyOn(client, "simulate").mockImplementation(
      stubSimulateResolved(mockCommandResults([new Uint8Array(0)])),
    );
    await expect(getRegistry(client)).rejects.toThrow();
  });

  it("rejects corrupt registry BCS bytes", async () => {
    const client = createMockPredictClient();
    vi.spyOn(client, "simulate").mockImplementation(
      stubSimulateResolved(mockCommandResults([new Uint8Array([0xff, 0xff])])),
    );
    await expect(getRegistry(client)).rejects.toThrow();
  });

  it("getOrder rejects corrupt order BCS bytes", async () => {
    const client = createMockPredictClient();
    vi.spyOn(client, "simulate").mockImplementation(
      stubSimulateResolved(mockCommandResults([new Uint8Array([0xff, 0xff])])),
    );
    await expect(getOrder(client, { orderId: 1n })).rejects.toThrow();
  });
});
