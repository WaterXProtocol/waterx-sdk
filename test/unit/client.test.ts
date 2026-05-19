import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { clearConfigCache, loadConfig, PYTH_DEFAULTS } from "../../src/config.ts";
import type { WlpPackage } from "../../src/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("WaterXClient (offline)", () => {
  const client = createUnitTestClient();

  it("exposes testnet config and pyth defaults", () => {
    expect(client.network).toBe("TESTNET");
    expect(client.config.network).toBe("testnet");
    expect(client.pyth.state_id).toBe(PYTH_DEFAULTS.TESTNET.state_id);
    expect(client.config.packages.waterx_perp.global_config).toMatch(/^0x/);
  });

  it("getMarket returns market entry for BTCUSD", () => {
    const m = client.getMarket("BTCUSD");
    expect(m.market).toMatch(/^0x/);
    expect(m.config).toMatch(/^0x/);
  });

  it("getMarket throws for unknown ticker", () => {
    expect(() => client.getMarket("NOPE")).toThrow(/Unknown market ticker/);
  });

  it("getPythFeed / getAggregator / getPoolTokenType / wlpType", () => {
    expect(client.getPythFeed("BTCUSD").feed_id).toMatch(/^0x/);
    expect(client.getAggregator("BTCUSD")).toMatch(/^0x/);
    expect(client.getPoolTokenType("USDCUSD")).toContain("::");
    expect(client.wlpType()).toContain("::wlp::WLP");
  });

  it("throws for unknown aggregator, pyth feed, pool token, and missing wlp", () => {
    expect(() => client.getAggregator("NOPE")).toThrow(/No aggregator listed/);
    expect(() => client.getPythFeed("NOPE")).toThrow(/No pyth feed listed/);
    expect(() => client.getPoolTokenType("NOPE")).toThrow(/No pool token registered/);

    const bare = createUnitTestClient();
    bare.config = {
      ...bare.config,
      packages: { ...bare.config.packages, wlp: undefined as unknown as WlpPackage },
    };
    expect(() => bare.wlpType()).toThrow(/wlp.original_id missing/);
  });

  it("grpc convenience methods delegate to grpcClient", async () => {
    const getObject = vi.fn().mockResolvedValue({ object: { objectId: "0x1" } });
    const listOwnedObjects = vi.fn().mockResolvedValue({ objects: [] });
    const listCoins = vi.fn().mockResolvedValue({ coins: [] });
    const getBalance = vi.fn().mockResolvedValue({ balance: "0" });
    const listDynamicFields = vi.fn().mockResolvedValue({ dynamicFields: [] });
    const getDynamicField = vi.fn().mockResolvedValue({ dynamicField: {} });
    const waitForTransaction = vi.fn().mockResolvedValue({ digest: "abc" });
    const simulateTransaction = vi.fn().mockResolvedValue({ $kind: "Success" });
    const signAndExecuteTransaction = vi.fn().mockResolvedValue({ digest: "def" });

    client.grpcClient = {
      getObject,
      getObjects: vi.fn(),
      listOwnedObjects,
      listCoins,
      getBalance,
      listDynamicFields,
      getDynamicField,
      waitForTransaction,
      simulateTransaction,
      signAndExecuteTransaction,
    } as unknown as typeof client.grpcClient;

    await client.getObject("0x1");
    await client.getObjects(["0x1"]);
    await client.listOwnedObjects("0x2");
    await client.listCoins({ owner: "0x2" });
    await client.getBalance({ owner: "0x2", coinType: "0x3::c::C" });
    await client.listDynamicFields("0x4");
    await client.getDynamicField("0x4", { type: "t", bcs: new Uint8Array() });
    await client.waitForTransaction("digest");
    await client.simulate(new (await import("@mysten/sui/transactions")).Transaction());
    await client.signAndExecuteTransaction({
      signer: { toSuiAddress: () => "0x5" } as never,
      transaction: new (await import("@mysten/sui/transactions")).Transaction(),
    });

    expect(getObject).toHaveBeenCalled();
    expect(simulateTransaction).toHaveBeenCalled();
    expect(signAndExecuteTransaction).toHaveBeenCalled();
  });

  it("packageIds() lists published_at for each package", () => {
    const ids = client.packageIds();
    expect(ids.waterx_perp).toBe(client.config.packages.waterx_perp.published_at);
    expect(ids.bucket_framework).toBeTruthy();
  });
});

function mockJsonFetch(body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("loadConfig", () => {
  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
  });

  it("fetches and parses testnet JSON", async () => {
    const cfg = await loadConfig("TESTNET", { fetchImpl: mockJsonFetch(MOCK_TESTNET_CONFIG) });
    expect(cfg.network).toBe("testnet");
    expect(cfg.packages.waterx_perp.markets.BTCUSD).toBeDefined();
  });

  it("uses cache when opts.cache is true", async () => {
    const fetchMock = mockJsonFetch(MOCK_TESTNET_CONFIG);
    await loadConfig("TESTNET", { cache: true, fetchImpl: fetchMock });
    await loadConfig("TESTNET", { cache: true, fetchImpl: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("WaterXClient.create", () => {
  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
  });

  it("returns async client with loaded config", async () => {
    const client = await WaterXClient.create("TESTNET", {
      fetchImpl: mockJsonFetch(MOCK_TESTNET_CONFIG),
    });
    expect(client.config.packages.waterx_perp.markets.BTCUSD).toBeDefined();
  });

  it("mainnet() and testnet() delegate to create()", async () => {
    const mainnetConfig = { ...MOCK_TESTNET_CONFIG, network: "mainnet" as const };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("mainnet") ? mainnetConfig : MOCK_TESTNET_CONFIG;
      return { ok: true, json: async () => body };
    }) as unknown as typeof fetch;

    const testnet = await WaterXClient.testnet({ fetchImpl: fetchMock });
    expect(testnet.network).toBe("TESTNET");

    const mainnet = await WaterXClient.mainnet({ fetchImpl: fetchMock });
    expect(mainnet.network).toBe("MAINNET");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
