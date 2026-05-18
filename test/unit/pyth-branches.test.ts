/**
 * Branch coverage for src/utils/pyth.ts on-chain helpers and sponsor paths.
 */
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPythPriceUpdateCalls,
  fetchPriceFeedsUpdateData,
  openPythSponsorFund,
  PythCache,
  refreshOraclePrices,
  reimbursePythSponsor,
} from "../../src/utils/pyth.ts";
import { placeOrderRequest } from "../../src/user/order.ts";
import {
  DEFAULT_MOCK_PYTH_ROW_TYPE,
  MOCK_HERMES_URL,
  MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT,
  MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT,
  mockSuiAddress,
} from "../helpers/fixtures/sui-mock-fixtures.ts";
import { attachPythGrpcMocks, mockAccumulatorUpdate } from "../helpers/fixtures/pyth-mock-grpc.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const PYTH_STATE = mockSuiAddress("c1");
const WORMHOLE_STATE = mockSuiAddress("c2");
const PRICE_TABLE_CHILD = mockSuiAddress("c3");

function wirePythGrpc(
  client: ReturnType<typeof createUnitTestClient>,
  overrides: {
    pythStateJson?: Record<string, unknown> | null;
    wormholeJson?: Record<string, unknown> | null;
    dynamicFields?: Array<Record<string, unknown>>;
    dynamicFieldValue?: { bcs?: Uint8Array };
  } = {},
) {
  const pythStateJson =
    overrides.pythStateJson !== undefined
      ? overrides.pythStateJson
      : {
          fields: {
            upgrade_cap: { fields: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT } },
            base_update_fee: "1000",
          },
        };
  const wormholeJson =
    overrides.wormholeJson !== undefined
      ? overrides.wormholeJson
      : {
          upgrade_cap: { package: MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT },
        };

  client.grpcClient = {
    getObject: vi.fn(async ({ objectId }: { objectId: string }) => {
      if (objectId === PYTH_STATE) return { object: { json: pythStateJson } };
      if (objectId === WORMHOLE_STATE) return { object: { json: wormholeJson } };
      return { object: { json: null } };
    }),
    listDynamicFields: vi.fn(async () => ({
      dynamicFields:
        overrides.dynamicFields !== undefined
          ? overrides.dynamicFields
          : [{ objectId: PRICE_TABLE_CHILD, objectType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    })),
    getDynamicField: vi.fn(async () => ({
      dynamicField: { value: overrides.dynamicFieldValue ?? { bcs: new Uint8Array(32).fill(1) } },
    })),
  } as unknown as typeof client.grpcClient;

  client.pyth = { ...client.pyth, state_id: PYTH_STATE, wormhole_state_id: WORMHOLE_STATE };
}

describe("pyth on-chain helper branches", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchPriceFeedsUpdateData throws when Hermes returns empty binary", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ binary: { data: [] } }),
    })) as typeof fetch;

    await expect(fetchPriceFeedsUpdateData(MOCK_HERMES_URL, ["0x1"])).rejects.toThrow(
      /Hermes returned no binary price data/,
    );
  });

  it("buildPythPriceUpdateCalls rejects multiple accumulator messages", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const tx = new Transaction();
    const update = mockAccumulatorUpdate();
    await expect(
      buildPythPriceUpdateCalls(tx, client, [update, update], ["0xfeed"], new PythCache()),
    ).rejects.toThrow(/Only a single accumulator message/);
  });

  it("buildPythPriceUpdateCalls uses sponsor fund split instead of gas", async () => {
    const client = createUnitTestClient();
    const { feedId } = attachPythGrpcMocks(client);
    const update = mockAccumulatorUpdate();
    const cache = new PythCache();

    const gasTx = new Transaction();
    await buildPythPriceUpdateCalls(gasTx, client, [update], [feedId], cache);
    expect(gasTx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(true);

    const sponsorTx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(sponsorTx, client);
    await buildPythPriceUpdateCalls(sponsorTx, client, [update], [feedId], cache, {
      fund,
      packageId,
    });
    expect(sponsorTx.getData().commands?.some((c) => c.$kind === "SplitCoins")).toBe(false);
    expect(sponsorTx.getData().commands?.some((c) => c.$kind === "MoveCall")).toBe(true);
  });

  it("buildPythPriceUpdateCalls throws when feed is not registered on-chain", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { dynamicFieldValue: { bcs: new Uint8Array(8) } });
    const tx = new Transaction();
    await expect(
      buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], ["0xdeadbeef"], new PythCache()),
    ).rejects.toThrow(/not registered on-chain/);
  });

  it("pkgFromUpgradeCap reads top-level and nested upgrade_cap package paths", async () => {
    const client = createUnitTestClient();
    const directPkg = "0x1111111111111111111111111111111111111111111111111111111111111111";
    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: directPkg },
        base_update_fee: "1000",
      },
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(cache.pythStateInfo?.packageId).toBe(directPkg);

    const nestedPkg = "0x2222222222222222222222222222222222222222222222222222222222222222";
    wirePythGrpc(client, {
      pythStateJson: {
        fields: {
          upgrade_cap: { fields: { package: nestedPkg } },
          base_update_fee: "1000",
        },
      },
    });
    const cache2 = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache2,
    );
    expect(cache2.pythStateInfo?.packageId).toBe(nestedPkg);
  });

  it("getPythStateInfo reads base_update_fee from json root", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT },
        base_update_fee: "4242",
      },
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(cache.pythStateInfo?.baseUpdateFee).toBe(4242n);
  });

  it("matches dynamic field rows whose objectType contains price_info", async () => {
    const client = createUnitTestClient();
    const pkg = MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT;
    wirePythGrpc(client, {
      dynamicFields: [
        {
          objectId: PRICE_TABLE_CHILD,
          objectType: `${pkg}::state::price_info::Table`,
        },
      ],
    });
    await expect(
      buildPythPriceUpdateCalls(
        txFor(),
        client,
        [mockAccumulatorUpdate()],
        ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
        new PythCache(),
      ),
    ).rejects.toThrow(/Cannot extract package from price table type/);
  });

  it("normalizes feed ids without 0x prefix", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const feedHex =
      "f9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], [feedHex]);
    expect(ids[0]).toMatch(/^0x/);
  });

  it("resolves price table via valueType and childId fields", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [{ childId: PRICE_TABLE_CHILD, valueType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("resolves price table via objectType when valueType is empty", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          valueType: "",
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const cache = new PythCache();
    await buildPythPriceUpdateCalls(
      txFor(),
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("resolves price table via objectType and childId fields", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          objectType: DEFAULT_MOCK_PYTH_ROW_TYPE,
        },
      ],
    });
    const cache = new PythCache();
    const tx = new Transaction();
    await buildPythPriceUpdateCalls(
      tx,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("reuses priceFeedObjectId cache keyed by pyth state", async () => {
    const client = createUnitTestClient();
    const getDynamicField = vi.fn(async () => ({
      dynamicField: { value: { bcs: new Uint8Array(32).fill(1) } },
    }));
    wirePythGrpc(client);
    client.grpcClient.getDynamicField = getDynamicField as typeof client.grpcClient.getDynamicField;

    const cache = new PythCache();
    const feedId = "0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b";
    cache.priceFeedObjectIdCache.set(`${PYTH_STATE}:${feedId.replace(/^0x/, "")}`, "0xcached");

    const tx = new Transaction();
    const ids = await buildPythPriceUpdateCalls(tx, client, [mockAccumulatorUpdate()], [feedId], cache);
    expect(ids[0]).toBe("0xcached");
    expect(getDynamicField).not.toHaveBeenCalled();
  });

  it("reuses grpc caches for pyth state, wormhole package, and price table", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client);
    const cache = new PythCache();
    const tx1 = new Transaction();
    await buildPythPriceUpdateCalls(
      tx1,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    const getObject = client.grpcClient.getObject as ReturnType<typeof vi.fn>;
    const callsAfterFirst = getObject.mock.calls.length;

    const tx2 = new Transaction();
    await buildPythPriceUpdateCalls(
      tx2,
      client,
      [mockAccumulatorUpdate()],
      ["0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b"],
      cache,
    );
    expect(getObject.mock.calls.length).toBe(callsAfterFirst);
    expect(cache.pythStateInfo?.packageId).toBe(MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT);
    expect(cache.wormholePackageId).toBe(MOCK_WORMHOLE_PACKAGE_FOR_GRPC_DEFAULT);
    expect(cache.priceTableInfo?.id).toBe(PRICE_TABLE_CHILD);
  });

  it("getPythStateInfo throws when state json or base_update_fee is missing", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { pythStateJson: null });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/Unable to fetch pyth state/);

    wirePythGrpc(client, {
      pythStateJson: {
        upgrade_cap: { package: MOCK_PYTH_PACKAGE_FOR_GRPC_DEFAULT },
        fields: {},
      },
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/base_update_fee/);
  });

  it("getWormholePackageId throws when wormhole state json is missing", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { wormholeJson: null });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/wormhole package id/);
  });

  it("getPriceTableInfo throws on missing table, childId, or package type", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { dynamicFields: [] });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/Price table not found/);

    wirePythGrpc(client, {
      dynamicFields: [{ valueType: DEFAULT_MOCK_PYTH_ROW_TYPE }],
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/Price table missing childId/);

    wirePythGrpc(client, {
      dynamicFields: [
        {
          childId: PRICE_TABLE_CHILD,
          valueType: "not-a-hex-pkg::price_identifier::PriceIdentifier",
        },
      ],
    });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/Cannot extract package from price table type/);
  });

  it("pkgFromUpgradeCap throws when package id cannot be resolved", async () => {
    const client = createUnitTestClient();
    wirePythGrpc(client, { pythStateJson: { fields: {} } });
    await expect(
      buildPythPriceUpdateCalls(txFor(), client, [mockAccumulatorUpdate()], ["0x1"], new PythCache()),
    ).rejects.toThrow(/Cannot resolve package id/);
  });

  it("refreshOraclePrices is a no-op for an empty ticker list", async () => {
    const client = createUnitTestClient();
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, []);
    expect(tx.getData().commands?.length ?? 0).toBe(0);
  });

  it("reimbursePythSponsor throws when sponsor config is incomplete", () => {
    const client = createUnitTestClient();
    delete (client.config.packages.pyth_sponsor_rule as { published_at?: string }).published_at;
    const tx = new Transaction();
    const fund = tx.pure.u64(1);
    const req = placeOrderRequest(client, tx, {
      ticker: "BTCUSD",
      accountId: PTB_DUMMY_ACCOUNT_ID,
      collateralType: MOCK_USDC_TYPE,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: 1n,
        acceptablePrice: 1n,
        collateralAmount: 1n,
      },
    });
    expect(() => reimbursePythSponsor(tx, client, fund, req, MOCK_USDC_TYPE)).toThrow(
      /pyth_sponsor_rule missing from config/,
    );
  });
});

function txFor() {
  return new Transaction();
}
