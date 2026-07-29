import { afterEach, describe, expect, it, vi } from "vitest";

import { PerpClient } from "../../../src/perp/client.ts";
import * as configModule from "../../../src/perp/config.ts";
import { PYTH_DEFAULTS } from "../../../src/perp/config.ts";
import type { PythInfraConfig, WaterXConfig, WlpPackage } from "../../../src/perp/config.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("PerpClient (offline)", () => {
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

  it("isConstantTicker reflects constant_rule.feeds", () => {
    // Shared fixture has the package but an empty feeds map → all Pyth.
    expect(client.isConstantTicker("USDCUSD")).toBe(false);
    expect(client.isConstantTicker("BTCUSD")).toBe(false);

    // A ticker listed in feeds is constant-routed.
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    expect(client.isConstantTicker("USDCUSD")).toBe(true);
    expect(client.isConstantTicker("BTCUSD")).toBe(false);

    // No package at all → never constant.
    const bare = createUnitTestClient();
    delete bare.config.packages.constant_rule;
    expect(bare.isConstantTicker("USDCUSD")).toBe(false);

    // All-or-nothing: a half-populated block (feeds listed before the rule is
    // deployed) stays on Pyth instead of routing to a constant rule that would
    // throw at aggregate time and abort the whole refresh PTB.
    const halfWired = createUnitTestClient();
    halfWired.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    halfWired.config.packages.constant_rule!.config = "";
    expect(halfWired.isConstantTicker("USDCUSD")).toBe(false);

    const noPkgId = createUnitTestClient();
    noPkgId.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    noPkgId.config.packages.constant_rule!.published_at = "";
    expect(noPkgId.isConstantTicker("USDCUSD")).toBe(false);
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

  it("getCredit / creditType / getBridge / wormholeStateId", () => {
    expect(client.getCredit().credit_registry).toMatch(/^0x/);
    expect(client.creditType()).toContain("::");
    expect(client.getBridge().published_at).toMatch(/^0x/);
    expect(client.wormholeStateId()).toMatch(/^0x/);
  });

  it("wormholeStateId falls back to network defaults when bridge omits wormhole_state", () => {
    const bare = createUnitTestClient();
    bare.config.packages.wormhole_bridge = {
      ...bare.config.packages.wormhole_bridge!,
      wormhole_state: undefined as unknown as string,
    };
    expect(bare.wormholeStateId()).toBe(bare.wormhole.state_id);
  });

  it("getNativeAssets / getNativeAsset", () => {
    const assets = client.getNativeAssets();
    expect(assets.length).toBeGreaterThan(0);
    expect(client.getNativeAsset(MOCK_CUSTODY_ASSET_TYPE).type).toBe(MOCK_CUSTODY_ASSET_TYPE);
    expect(() => client.getNativeAsset("0xdead::nope::NOPE")).toThrow(
      /No native custody asset registered/,
    );
  });

  it("throws when credit / bridge / custody packages are absent", () => {
    const bare = createUnitTestClient();
    delete bare.config.packages.waterx_credit;
    expect(() => bare.getCredit()).toThrow(/waterx_credit not configured/);
    expect(() => bare.creditType()).toThrow(/credit_type missing/);

    const noBridge = createUnitTestClient();
    delete noBridge.config.packages.wormhole_bridge;
    expect(() => noBridge.getBridge()).toThrow(/wormhole_bridge not configured/);

    const noCustody = createUnitTestClient();
    delete noCustody.config.packages.native_custody;
    expect(() => noCustody.getNativeAssets()).toThrow(/native_custody not configured/);
  });
});

describe("client.pyth (fixed Core infra + caller-supplied credential/policy)", () => {
  it("is the per-network Pyth Core constant regardless of oracleSource", () => {
    expect(createUnitTestClient().pyth).toEqual(PYTH_DEFAULTS.TESTNET);
    // The lazer source reads only api_key/fetch from client.pyth; its on-chain
    // infra is LAZER_DEFAULTS + config, so client.pyth stays Core here too.
    expect(createUnitTestClient({ oracleSource: "pyth_lazer_rule" }).pyth).toEqual(
      PYTH_DEFAULTS.TESTNET,
    );
  });

  it("a `pyth` block in the config JSON is ignored — infra comes from the constant only", () => {
    // The canonical waterx-config JSON has never carried one; the SDK no
    // longer looks. State ids / endpoint are not deployment-overridable.
    const config = {
      ...structuredClone(MOCK_TESTNET_CONFIG),
      pyth: {
        state_id: "0x" + "ab".repeat(32),
        wormhole_state_id: "0x" + "cd".repeat(32),
        hermes_endpoint: "https://hermes.example.invalid",
        api_key: "from-json",
      } satisfies PythInfraConfig,
    } as unknown as WaterXConfig;

    const client = new PerpClient("TESTNET", config, { oracleSource: "pyth_lazer_rule" });

    expect(client.pyth).toEqual(PYTH_DEFAULTS.TESTNET);
    expect(client.pyth.api_key).toBeUndefined();
  });

  it("pythApiKey is supplied at client init, never through the config JSON", () => {
    const client = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
      oracleSource: "pyth_lazer_rule",
      pythApiKey: "caller-supplied",
    });

    expect(client.pyth).toEqual({ ...PYTH_DEFAULTS.TESTNET, api_key: "caller-supplied" });
  });

  it("pythFetch is supplied at client init and rides on client.pyth", () => {
    const client = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
      pythFetch: { timeoutMs: 8_000, retries: 1 },
    });

    expect(client.pyth).toEqual({
      ...PYTH_DEFAULTS.TESTNET,
      fetch: { timeoutMs: 8_000, retries: 1 },
    });
  });
});

describe("PerpClient.create", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns async client with loaded config", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    const client = await PerpClient.create("TESTNET", { cache: true });
    expect(loadConfig).toHaveBeenCalledWith("TESTNET", { cache: true });
    expect(client.config.packages.waterx_perp.markets.BTCUSD).toBeDefined();
    expect(client.network).toBe("TESTNET");
  });

  it("create() threads oracleSource + pythApiKey through to the client", async () => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(MOCK_TESTNET_CONFIG);
    const client = await PerpClient.create("TESTNET", {
      oracleSource: "pyth_lazer_rule",
      pythApiKey: "k",
    });
    expect(client.oracleSource).toBe("pyth_lazer_rule");
    expect(client.pyth).toEqual({ ...PYTH_DEFAULTS.TESTNET, api_key: "k" });
  });

  it("does NOT throw at init when the selected source has no feeds configured", async () => {
    // The old assertOracleSourceConfigured threw here; now selecting a source
    // with empty feeds is fine at init — it surfaces per-ticker at tx-build
    // (see refreshOraclePrices). No cross-source fallback, no init guard.
    const noLazerFeeds = structuredClone(MOCK_TESTNET_CONFIG);
    noLazerFeeds.packages.pyth_lazer_rule!.feeds = {};
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(noLazerFeeds);
    const client = await PerpClient.create("TESTNET", { oracleSource: "pyth_lazer_rule" });
    expect(client.oracleSource).toBe("pyth_lazer_rule");
  });

  it("mainnet() and testnet() delegate to create()", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockImplementation(async (network) => ({
      ...MOCK_TESTNET_CONFIG,
      network: network === "MAINNET" ? "mainnet" : "testnet",
    }));
    const testnet = await PerpClient.testnet();
    const mainnet = await PerpClient.mainnet();
    expect(testnet.network).toBe("TESTNET");
    expect(mainnet.network).toBe("MAINNET");
    expect(loadConfig).toHaveBeenCalledTimes(2);
  });
});
