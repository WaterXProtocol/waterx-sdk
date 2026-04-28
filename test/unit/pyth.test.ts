/**
 * Pyth oracle unit tests.
 *
 * - **Hermes**: all HTTP is via `MOCK_HERMES_URL` + mocked `globalThis.fetch` (no real network).
 * - **Object IDs**: use `../helpers/fixtures/sui-mock-fixtures` for deterministic 32-byte hex strings.
 */
import { toHex } from "@mysten/bcs";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import {
  buildPythPriceUpdateCalls,
  buildPythRuleFeedCalls,
  fetchPriceFeedsUpdateData,
  PythCache,
  updatePythPrices,
} from "@waterx/perp-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PYTH_STATE_ID,
  TESTNET_COLLATERALS,
  TESTNET_MARKETS,
  TESTNET_OBJECTS,
  TESTNET_PACKAGE_IDS,
  TESTNET_TYPES,
} from "../../src/constants";
import {
  DEFAULT_MOCK_PYTH_ROW_TYPE,
  MOCK_HERMES_URL,
  MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
  MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
  mockPythPriceIdentifierType,
  mockSuiAddress,
  mockSuiAddrHeadPair,
} from "../helpers/fixtures/sui-mock-fixtures";

describe("fetchPriceFeedsUpdateData", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty array when priceIds is empty", async () => {
    globalThis.fetch = vi.fn() as any;
    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, []);
    expect(out).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("parses Hermes binary hex data into Uint8Array", async () => {
    const payload = new Uint8Array([1, 2, 3, 4]);
    const hex = toHex(payload);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [hex] } }),
    })) as any;

    const out = await fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0xabc"]);
    expect(out.length).toBe(1);
    expect(Array.from(out[0]!)).toEqual([1, 2, 3, 4]);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it("throws on non-ok HTTP response", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "server error",
    })) as any;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /Hermes price fetch failed: 500/,
    );
  });

  it("throws when binary.data is empty", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [] } }),
    })) as any;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /no binary price data/,
    );
  });

  it("throws when binary field is missing", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as any;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /no binary price data/,
    );
  });
});

/** Minimal accumulator layout for `extractVaaBytesFromAccumulatorMessage` (see pyth.ts). */
function accumulatorMessageWithVaa(vaa: Uint8Array): Uint8Array {
  const buf = new Uint8Array(10 + vaa.length);
  buf[6] = 0;
  buf[7] = 0;
  new DataView(buf.buffer).setUint16(8, vaa.length, false);
  buf.set(vaa, 10);
  return buf;
}

function createMockGrpcForPythBuild(opts: {
  pythStateId: string;
  wormholeStateId: string;
  priceTableChildId: string;
  pythPackageId?: string;
  wormholePackageId?: string;
  priceTablePkg?: string;
  /** Overrides dynamic field entry type (for error-path tests). */
  priceTableValueType?: string;
  /**
   * Multi-row `listDynamicFields` (gRPC). When set, replaces the default single price-table row.
   */
  dynamicFieldEntries?: Array<{
    childId?: string;
    objectId?: string;
    valueType?: string;
    objectType?: string;
  }>;
  feedObjectBcs?: Uint8Array;
  /** Variants for `getPackageIdFromObjectJson` / `base_update_fee` branches. */
  pythObjectJson?: "standard" | "nestedUpgradeCap" | "feeOnRoot" | "rootFeeWithEmptyFields";
}): SuiGrpcClient {
  const pythPkg = opts.pythPackageId ?? MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
  const whPkg = opts.wormholePackageId ?? MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
  const tableType = opts.priceTablePkg ?? DEFAULT_MOCK_PYTH_ROW_TYPE;
  const entryValueType = opts.priceTableValueType ?? tableType;
  const bcs32 = opts.feedObjectBcs ?? new Uint8Array(32).fill(0x33);

  return {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
      if (objectId === opts.pythStateId) {
        const style = opts.pythObjectJson ?? "standard";
        if (style === "nestedUpgradeCap") {
          return {
            object: {
              json: {
                fields: {
                  upgrade_cap: { fields: { package: pythPkg } },
                  base_update_fee: "1000",
                },
              },
            },
          };
        }
        if (style === "feeOnRoot") {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                base_update_fee: "999",
              },
            },
          };
        }
        if (style === "rootFeeWithEmptyFields") {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: {},
                base_update_fee: "1001",
              },
            },
          };
        }
        return {
          object: {
            json: {
              upgrade_cap: { package: pythPkg },
              fields: { base_update_fee: "1000" },
            },
          },
        };
      }
      if (objectId === opts.wormholeStateId) {
        return {
          object: {
            json: {
              upgrade_cap: { package: whPkg },
            },
          },
        };
      }
      return { object: null };
    }),
    listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
      if (parentId !== opts.pythStateId) {
        return { dynamicFields: [] };
      }
      if (opts.dynamicFieldEntries) {
        return {
          dynamicFields: opts.dynamicFieldEntries.map((e) => ({
            ...(e.childId !== undefined ? { childId: e.childId } : {}),
            ...(e.objectId !== undefined ? { objectId: e.objectId } : {}),
            ...(e.valueType !== undefined ? { valueType: e.valueType } : {}),
            ...(e.objectType !== undefined ? { objectType: e.objectType } : {}),
          })),
        };
      }
      return {
        dynamicFields: [
          {
            childId: opts.priceTableChildId,
            valueType: entryValueType,
          },
        ],
      };
    }),
    getDynamicField: vi.fn(async () => ({
      dynamicField: {
        value: { bcs: bcs32 },
      },
    })),
  } as unknown as SuiGrpcClient;
}

/**
 * gRPC client mock: price table is discovered only via `listDynamicFields`
 * (`childId` + `valueType` containing PriceIdentifier / price_info).
 */
function createMockGrpcPythJsonRpcStyle(opts: {
  pythStateId: string;
  wormholeStateId: string;
  priceTableChildId: string;
  /** When set, `listDynamicFields` returns no matching price table row. */
  emptyPriceTableList?: boolean;
}): SuiGrpcClient {
  const pythPkg = MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
  const whPkg = MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
  const rowType = DEFAULT_MOCK_PYTH_ROW_TYPE;
  const bcs32 = new Uint8Array(32).fill(0x55);
  return {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
      if (objectId === opts.pythStateId) {
        return {
          object: {
            json: {
              upgrade_cap: { package: pythPkg },
              fields: { base_update_fee: "1000" },
            },
          },
        };
      }
      if (objectId === opts.wormholeStateId) {
        return {
          object: { json: { upgrade_cap: { package: whPkg } } },
        };
      }
      return { object: null };
    }),
    listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
      if (parentId !== opts.pythStateId) return { dynamicFields: [] };
      if (opts.emptyPriceTableList) return { dynamicFields: [] };
      return {
        dynamicFields: [
          {
            childId: opts.priceTableChildId,
            valueType: rowType,
          },
        ],
      };
    }),
    getDynamicField: vi.fn(async () => ({
      dynamicField: { value: { bcs: bcs32 } },
    })),
  } as unknown as SuiGrpcClient;
}

describe("buildPythPriceUpdateCalls", () => {
  it("throws when updates array is empty", async () => {
    await expect(
      buildPythPriceUpdateCalls(
        {} as any,
        {} as any,
        {
          pythStateId: "0x1",
          wormholeStateId: "0x2",
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [],
        ["0xfeed"],
      ),
    ).rejects.toThrow(/No price update data provided/);
  });

  it("throws when more than one accumulator message is provided", async () => {
    await expect(
      buildPythPriceUpdateCalls(
        {} as any,
        {} as any,
        {
          pythStateId: "0x1",
          wormholeStateId: "0x2",
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [new Uint8Array([1]), new Uint8Array([2])],
        ["0xa"],
      ),
    ).rejects.toThrow(/Only a single accumulator message/);
  });

  it("throws when wormhole state has no string package id", async () => {
    const pythStateId = mockSuiAddrHeadPair("71", "11");
    const wormholeStateId = mockSuiAddrHeadPair("72", "22");
    const priceTableChildId = mockSuiAddrHeadPair("73", "33");
    const pythPkg = mockSuiAddress("7a");
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: { upgrade_cap: { package: 42 } },
            },
          };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
        if (parentId !== pythStateId) return { dynamicFields: [] };
        return {
          dynamicFields: [
            {
              childId: priceTableChildId,
              valueType: mockPythPriceIdentifierType(mockSuiAddrHeadPair("74", "11")),
            },
          ],
        };
      }),
      getDynamicField: vi.fn(async () => ({
        dynamicField: { value: { bcs: new Uint8Array(32).fill(1) } },
      })),
    } as unknown as SuiGrpcClient;

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("74", "44")],
      ),
    ).rejects.toThrow(/Cannot get package id/);
  });

  it("throws when wormhole state object has no json", async () => {
    const pythStateId = mockSuiAddrHeadPair("91", "11");
    const wormholeStateId = mockSuiAddrHeadPair("92", "22");
    const priceTableChildId = mockSuiAddrHeadPair("93", "33");
    const pythPkg = mockSuiAddress("9a");
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return { object: { json: null } };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
        if (parentId !== pythStateId) return { dynamicFields: [] };
        return {
          dynamicFields: [
            {
              childId: priceTableChildId,
              valueType: mockPythPriceIdentifierType(mockSuiAddress("9b")),
            },
          ],
        };
      }),
      getDynamicField: vi.fn(async () => ({
        dynamicField: { value: { bcs: new Uint8Array(32).fill(1) } },
      })),
    } as unknown as SuiGrpcClient;

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("94", "44")],
      ),
    ).rejects.toThrow(/Cannot get package id for object/);
  });

  it("throws when Pyth state object has no json", async () => {
    const pythStateId = mockSuiAddrHeadPair("a1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("a2", "22");
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return { object: { json: null } };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: {
                upgrade_cap: {
                  package: MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
                },
              },
            },
          };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async () => ({ dynamicFields: [] })),
    } as unknown as SuiGrpcClient;

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([2]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("a3", "44")],
      ),
    ).rejects.toThrow(/Unable to fetch pyth state/);
  });

  it("throws when Pyth state omits base_update_fee", async () => {
    const pythStateId = mockSuiAddrHeadPair("b1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("b2", "22");
    const pythPkg = mockSuiAddress("ba");
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: {},
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: {
                upgrade_cap: {
                  package: MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
                },
              },
            },
          };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async () => ({ dynamicFields: [] })),
    } as unknown as SuiGrpcClient;

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([3]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("b3", "44")],
      ),
    ).rejects.toThrow(/Unable to fetch pyth state base_update_fee/);
  });

  it("throws when price table field type does not match PriceIdentifier pattern", async () => {
    const pythStateId = mockSuiAddrHeadPair("a1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("a2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("a3", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      priceTableValueType: "0xbad::price_info::Table",
    });
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1, 2, 3, 4]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("a4", "44")],
      ),
    ).rejects.toThrow(/Cannot extract package address/);
  });

  it("price table row matches when valueType contains PriceIdentifier", async () => {
    const pythStateId = mockSuiAddrHeadPair("41", "11");
    const wormholeStateId = mockSuiAddrHeadPair("42", "22");
    const priceTableChildId = mockSuiAddrHeadPair("43", "33");
    const rowType = mockPythPriceIdentifierType(mockSuiAddress("44"));
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    vi.mocked(mockClient.listDynamicFields).mockResolvedValue({
      dynamicFields: [{ childId: priceTableChildId, valueType: rowType }],
    } as any);

    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([6]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("listDynamicFields skips non-matching rows until PriceIdentifier valueType", async () => {
    const pythStateId = mockSuiAddrHeadPair("81", "11");
    const wormholeStateId = mockSuiAddrHeadPair("82", "22");
    const priceTableChildId = mockSuiAddrHeadPair("83", "33");
    const junkId = mockSuiAddrHeadPair("80", "99");
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: mockSuiAddress("8a") },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: mockSuiAddress("8b") },
              },
            },
          };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
        if (parentId !== pythStateId) return { dynamicFields: [] };
        return {
          dynamicFields: [
            { childId: junkId, valueType: "" },
            {
              childId: priceTableChildId,
              valueType: DEFAULT_MOCK_PYTH_ROW_TYPE,
            },
          ],
        };
      }),
      getDynamicField: vi.fn(async () => ({
        dynamicField: { value: { bcs: new Uint8Array(32).fill(7) } },
      })),
    } as unknown as SuiGrpcClient;

    const feedId = mockSuiAddrHeadPair("84", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x16]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("listDynamicFields row uses valueType for PriceIdentifier package extraction", async () => {
    const pythStateId = mockSuiAddrHeadPair("51", "11");
    const wormholeStateId = mockSuiAddrHeadPair("52", "22");
    const priceTableChildId = mockSuiAddrHeadPair("53", "33");
    const derivedType = mockPythPriceIdentifierType(mockSuiAddress("55"));
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: mockSuiAddress("5a") },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: mockSuiAddress("5b") },
              },
            },
          };
        }
        return { object: null };
      }),
      listDynamicFields: vi.fn(async ({ parentId }: { parentId: string }) => {
        if (parentId !== pythStateId) return { dynamicFields: [] };
        return {
          dynamicFields: [{ childId: priceTableChildId, valueType: derivedType }],
        };
      }),
      getDynamicField: vi.fn(async () => ({
        dynamicField: { value: { bcs: new Uint8Array(32).fill(6) } },
      })),
    } as unknown as SuiGrpcClient;

    const feedId = mockSuiAddrHeadPair("54", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([3]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("throws when listDynamicFields returns no price table row", async () => {
    const pythStateId = mockSuiAddrHeadPair("61", "11");
    const wormholeStateId = mockSuiAddrHeadPair("62", "22");
    const priceTableChildId = mockSuiAddrHeadPair("63", "33");
    const mockClient = createMockGrpcPythJsonRpcStyle({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      emptyPriceTableList: true,
    });

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("64", "44")],
      ),
    ).rejects.toThrow(/Price table not found/);
  });

  it("discovers price table via listDynamicFields (gRPC shape)", async () => {
    const pythStateId = mockSuiAddrHeadPair("b1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("b2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("b3", "33");
    const mockClient = createMockGrpcPythJsonRpcStyle({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddrHeadPair("b4", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([5, 6, 7, 8]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
    expect(mockClient.listDynamicFields).toHaveBeenCalled();
  });

  it("discovers price table via getDynamicFields when listDynamicFields is absent (JSON-RPC shape)", async () => {
    const pythStateId = mockSuiAddrHeadPair("a1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("a2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("a3", "33");
    const pythPkg = MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
    const whPkg = MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
    const rowType = DEFAULT_MOCK_PYTH_ROW_TYPE;
    const getDynamicFields = vi.fn(async ({ parentId }: { parentId: string }) => {
      if (parentId !== pythStateId) return { data: [] };
      return {
        data: [
          {
            objectId: priceTableChildId,
            objectType: rowType,
          },
        ],
      };
    });
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: { upgrade_cap: { package: whPkg } },
            },
          };
        }
        return { object: null };
      }),
      getDynamicFields,
      getDynamicField: vi.fn(async () => ({
        dynamicField: { value: { bcs: new Uint8Array(32).fill(0xaa) } },
      })),
    } as unknown as SuiGrpcClient;

    const feedId = mockSuiAddrHeadPair("a4", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1, 2]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
    expect(getDynamicFields).toHaveBeenCalled();
  });

  it("throws when client supports neither listDynamicFields nor getDynamicFields", async () => {
    const pythStateId = mockSuiAddrHeadPair("f9", "11");
    const wormholeStateId = mockSuiAddrHeadPair("f9", "22");
    const pythPkg = MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
    const whPkg = MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
    const mockClient = {
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: pythPkg },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: { upgrade_cap: { package: whPkg } },
            },
          };
        }
        return { object: null };
      }),
    } as unknown as SuiGrpcClient;

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([7]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("f9", "33")],
      ),
    ).rejects.toThrow(/does not support listDynamicFields or getDynamicFields/);
  });

  it("skips getDynamicField when priceFeedObjectId is cached", async () => {
    const pythStateId = mockSuiAddrHeadPair("c1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("c2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("c3", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddrHeadPair("c4", "44");
    const normalized = feedId.replace(/^0x/, "");
    const cache = new PythCache();
    cache.priceFeedObjectIdCache.set(`${pythStateId}:${normalized}`, "0xcachedfeed");

    const acc = accumulatorMessageWithVaa(new Uint8Array([1]));
    const cfg = {
      pythStateId,
      wormholeStateId,
      hermesEndpoint: MOCK_HERMES_URL,
    };

    await buildPythPriceUpdateCalls(new Transaction(), mockClient, cfg, [acc], [feedId], cache);
    expect(mockClient.getDynamicField).not.toHaveBeenCalled();
  });

  it("parses Pyth state with nested upgrade_cap.fields.package", async () => {
    const pythStateId = mockSuiAddrHeadPair("d1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("d2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("d3", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      pythObjectJson: "nestedUpgradeCap",
    });
    const feedId = mockSuiAddrHeadPair("d4", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([9]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("throws when price table child id is missing from dynamic fields", async () => {
    const pythStateId = mockSuiAddrHeadPair("81", "11");
    const wormholeStateId = mockSuiAddrHeadPair("82", "22");
    const priceTableChildId = mockSuiAddrHeadPair("83", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    vi.mocked(mockClient.listDynamicFields).mockResolvedValueOnce({
      dynamicFields: [{ valueType: "0xv::price_info::X" }],
    } as any);

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([2]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("84", "44")],
      ),
    ).rejects.toThrow(/Price table not found/);
  });

  it("resolves package id from upgrade_cap.fields.package when package root absent", async () => {
    const pythStateId = mockSuiAddrHeadPair("91", "11");
    const wormholeStateId = mockSuiAddrHeadPair("92", "22");
    const priceTableChildId = mockSuiAddrHeadPair("93", "33");
    const pkgFromFields = mockSuiAddress("9a");
    const mockClient = {
      ...createMockGrpcForPythBuild({
        pythStateId,
        wormholeStateId,
        priceTableChildId,
      }),
      getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
        if (objectId === pythStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { fields: { package: pkgFromFields } },
                fields: { base_update_fee: "1000" },
              },
            },
          };
        }
        if (objectId === wormholeStateId) {
          return {
            object: {
              json: {
                upgrade_cap: { package: mockSuiAddress("9b") },
              },
            },
          };
        }
        return { object: null };
      }),
    } as unknown as SuiGrpcClient;

    const feedId = mockSuiAddrHeadPair("94", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([7]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("reads base_update_fee from object root when fields omit fee", async () => {
    const pythStateId = mockSuiAddrHeadPair("e1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("e2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("e3", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      pythObjectJson: "feeOnRoot",
    });
    const feedId = mockSuiAddrHeadPair("e4", "44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([3]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("full PTB path with mocked gRPC (single feed)", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0xab, 0xcd, 0xef, 0x01]));

    const priceInfoIds = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(priceInfoIds).toHaveLength(1);
    expect(priceInfoIds[0]).toMatch(/^0x[0-9a-f]+$/i);
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
    expect(mockClient.getObject).toHaveBeenCalled();
    expect(mockClient.listDynamicFields).toHaveBeenCalled();
    expect(mockClient.getDynamicField).toHaveBeenCalled();
  });

  it("skips dynamic-field rows with empty type strings until PriceIdentifier row", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const junkChildId = mockSuiAddress("99");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      dynamicFieldEntries: [
        { childId: junkChildId },
        {
          childId: priceTableChildId,
          valueType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x10]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
  });

  it("skips getObject for Pyth / wormhole / price table when cache holds all three", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const fieldType = DEFAULT_MOCK_PYTH_ROW_TYPE.match(
      /^(0x[a-fA-F0-9]+)::price_identifier::PriceIdentifier$/,
    )![1]!;
    const cache = new PythCache();
    cache.pythStateInfo = {
      packageId: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
      baseUpdateFee: 1000n,
    };
    cache.wormholePackageId = MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT;
    cache.priceTableInfo = { id: priceTableChildId, fieldType };

    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x20]));

    await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
      cache,
    );

    expect(
      vi
        .mocked(mockClient.getObject)
        .mock.calls.some((c) => (c[0] as { objectId: string }).objectId === pythStateId),
    ).toBe(false);
    expect(
      vi
        .mocked(mockClient.getObject)
        .mock.calls.some((c) => (c[0] as { objectId: string }).objectId === wormholeStateId),
    ).toBe(false);
    expect(mockClient.listDynamicFields).not.toHaveBeenCalled();
  });

  it("skips price table discovery when cache already has priceTableInfo", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const fieldType = DEFAULT_MOCK_PYTH_ROW_TYPE.match(
      /^(0x[a-fA-F0-9]+)::price_identifier::PriceIdentifier$/,
    )![1]!;
    const cache = new PythCache();
    cache.priceTableInfo = { id: priceTableChildId, fieldType };

    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x12]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
      cache,
    );

    expect(ids).toHaveLength(1);
    expect(mockClient.listDynamicFields).not.toHaveBeenCalled();
  });

  it("uses objectId when gRPC listDynamicFields row omits childId", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      dynamicFieldEntries: [
        {
          objectId: priceTableChildId,
          valueType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x21]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
  });

  it("reads base_update_fee from json root when fields exists but omits fee", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      pythObjectJson: "rootFeeWithEmptyFields",
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x22]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
      ),
    ).resolves.toHaveLength(1);
  });

  it("gRPC list row carries valueType (and optional objectType) for price table", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      dynamicFieldEntries: [
        {
          childId: priceTableChildId,
          valueType: DEFAULT_MOCK_PYTH_ROW_TYPE,
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x13]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
  });

  it("populates priceFeedObjectIdCache when cache is passed and lookup succeeds", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feedId = mockSuiAddress("44");
    const cache = new PythCache();
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x14]));

    await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
      cache,
    );

    const normalized = feedId.replace(/^0x/i, "");
    expect(cache.priceFeedObjectIdCache.has(`${pythStateId}:${normalized}`)).toBe(true);
  });

  it("stores undefined in priceFeedObjectIdCache when BCS too short and cache is passed", async () => {
    const pythStateId = mockSuiAddrHeadPair("51", "11");
    const wormholeStateId = mockSuiAddrHeadPair("52", "22");
    const priceTableChildId = mockSuiAddrHeadPair("53", "33");
    const feedId = mockSuiAddress("66");
    const cache = new PythCache();
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      feedObjectBcs: new Uint8Array(16),
    });
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x15]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [feedId],
        cache,
      ),
    ).rejects.toThrow(/not found on-chain/);

    const normalized = feedId.replace(/^0x/i, "");
    expect(cache.priceFeedObjectIdCache.get(`${pythStateId}:${normalized}`)).toBeUndefined();
    expect(cache.priceFeedObjectIdCache.has(`${pythStateId}:${normalized}`)).toBe(true);
  });

  it("uses objectType when valueType is empty on gRPC dynamic field row", async () => {
    const pythStateId = mockSuiAddress("11");
    const wormholeStateId = mockSuiAddress("22");
    const priceTableChildId = mockSuiAddress("33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      dynamicFieldEntries: [
        {
          childId: priceTableChildId,
          valueType: "",
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const feedId = mockSuiAddress("44");
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x11]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      [feedId],
    );

    expect(ids).toHaveLength(1);
  });

  it("resolves multiple feed ids with concurrency batching (>4 feeds)", async () => {
    const pythStateId = mockSuiAddrHeadPair("f1", "11");
    const wormholeStateId = mockSuiAddrHeadPair("f2", "22");
    const priceTableChildId = mockSuiAddrHeadPair("f3", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const feeds = [
      mockSuiAddrHeadPair("f4", "11"),
      mockSuiAddrHeadPair("f4", "22"),
      mockSuiAddrHeadPair("f4", "33"),
      mockSuiAddrHeadPair("f4", "44"),
      mockSuiAddrHeadPair("f4", "55"),
    ];
    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([4]));

    const ids = await buildPythPriceUpdateCalls(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [acc],
      feeds,
    );

    expect(ids).toHaveLength(5);
    expect(mockClient.getDynamicField).toHaveBeenCalledTimes(5);
  });

  it("throws when dynamic field payload has no BCS bytes", async () => {
    const pythStateId = mockSuiAddrHeadPair("77", "11");
    const wormholeStateId = mockSuiAddrHeadPair("77", "22");
    const priceTableChildId = mockSuiAddrHeadPair("77", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    vi.mocked(mockClient.getDynamicField).mockResolvedValue({
      dynamicField: { value: {} },
    } as any);

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([8]));
    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddrHeadPair("77", "44")],
      ),
    ).rejects.toThrow(/not found on-chain/);
  });

  it("throws when on-chain feed id lookup returns undefined", async () => {
    const pythStateId = mockSuiAddrHeadPair("51", "11");
    const wormholeStateId = mockSuiAddrHeadPair("52", "22");
    const priceTableChildId = mockSuiAddrHeadPair("53", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
      feedObjectBcs: new Uint8Array(16),
    });

    const tx = new Transaction();
    const acc = accumulatorMessageWithVaa(new Uint8Array([1, 2, 3, 4]));

    await expect(
      buildPythPriceUpdateCalls(
        tx,
        mockClient,
        {
          pythStateId,
          wormholeStateId,
          hermesEndpoint: MOCK_HERMES_URL,
        },
        [acc],
        [mockSuiAddress("66")],
      ),
    ).rejects.toThrow(/not found on-chain/);
  });
});

describe("updatePythPrices", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches Hermes then builds update calls", async () => {
    const pythStateId = mockSuiAddrHeadPair("71", "11");
    const wormholeStateId = mockSuiAddrHeadPair("72", "22");
    const priceTableChildId = mockSuiAddrHeadPair("73", "33");
    const mockClient = createMockGrpcForPythBuild({
      pythStateId,
      wormholeStateId,
      priceTableChildId,
    });
    const acc = accumulatorMessageWithVaa(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [toHex(acc)] } }),
    })) as any;

    const tx = new Transaction();
    const feedId = mockSuiAddrHeadPair("74", "44");
    const ids = await updatePythPrices(
      tx,
      mockClient,
      {
        pythStateId,
        wormholeStateId,
        hermesEndpoint: MOCK_HERMES_URL,
      },
      [feedId],
    );

    expect(ids).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalled();
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });
});

describe("buildPythRuleFeedCalls", () => {
  it("returns one PriceResult argument per feed", () => {
    const tx = new Transaction();
    const feeds = [
      {
        tokenType: TESTNET_TYPES.USDC,
        aggregatorId: TESTNET_COLLATERALS.USDC.aggregatorId,
        priceInfoObjectId: TESTNET_COLLATERALS.USDC.priceInfoId,
      },
      {
        tokenType: TESTNET_TYPES.BTC_USD,
        aggregatorId: TESTNET_MARKETS.BTC.aggregatorId,
        priceInfoObjectId: TESTNET_MARKETS.BTC.priceInfoId,
      },
    ];
    const results = buildPythRuleFeedCalls(tx, {
      pythRulePackageId: TESTNET_PACKAGE_IDS.PYTH_RULE,
      pythRuleConfigId: TESTNET_OBJECTS.PYTH_RULE_CONFIG,
      bucketOraclePackageId: TESTNET_PACKAGE_IDS.BUCKET_ORACLE,
      pythStateId: PYTH_STATE_ID.TESTNET,
      feeds,
    });
    expect(results).toHaveLength(2);
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(feeds.length * 3);
  });
});

describe("PythCache", () => {
  it("stores and reuses pythStateInfo", () => {
    const cache = new PythCache();
    const info = {
      packageId: "0xpkg",
      baseUpdateFee: 100n,
    };
    cache.pythStateInfo = info;
    expect(cache.pythStateInfo).toBe(info);
    expect(cache.pythStateInfo?.baseUpdateFee).toBe(100n);
  });

  it("priceFeedObjectIdCache respects get/set", () => {
    const cache = new PythCache();
    const key = "0xstate:feed1";
    cache.priceFeedObjectIdCache.set(key, "0xpriceobj");
    expect(cache.priceFeedObjectIdCache.get(key)).toBe("0xpriceobj");
    cache.priceFeedObjectIdCache.set(key, undefined);
    expect(cache.priceFeedObjectIdCache.has(key)).toBe(true);
    expect(cache.priceFeedObjectIdCache.get(key)).toBeUndefined();
  });
});
