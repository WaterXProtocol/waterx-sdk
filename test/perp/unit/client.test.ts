import { afterEach, describe, expect, it, vi } from "vitest";

import { WATERX_INFRA } from "../../../src/oracle/rules/waterx-rule.ts";
import { PerpClient, type CreateClientOptions } from "../../../src/perp/client.ts";
import * as configModule from "../../../src/perp/config.ts";
import type { WaterXConfig, WlpPackage } from "../../../src/perp/config.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { createUnitTestClient, withOracleSources } from "../helpers/test-client.ts";

describe("PerpClient (offline)", () => {
  const client = createUnitTestClient();

  it("exposes testnet config; source infra is rule-owned, not on the client", () => {
    expect(client.network).toBe("TESTNET");
    expect(client.config.network).toBe("testnet");
    expect(WATERX_INFRA.TESTNET.endpoint).toMatch(/^https:/);
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

  it("getAggregator / getPoolTokenType / wlpType", () => {
    expect(client.getAggregator("BTCUSD")).toMatch(/^0x/);
    expect(client.getPoolTokenType("USDCUSD")).toContain("::");
    expect(client.wlpType()).toContain("::wlp::WLP");
  });

  it("pricedPoolTickers returns pool tokens the FED SET can price", () => {
    // The shared fixture's pool token is USDCUSD, served by waterx + lazer.
    expect(createUnitTestClient({ oracleSource: "waterx_rule" }).pricedPoolTickers()).toEqual([
      "USDCUSD",
    ]);
    expect(createUnitTestClient({ oracleSource: "pyth_lazer_rule" }).pricedPoolTickers()).toEqual([
      "USDCUSD",
    ]);
  });

  it("pricedPoolTickers drops a pool token NO listed source serves", () => {
    // The regression the old config-only helper could not catch: a token some
    // OTHER rule serves is still unpriceable to this client, and handing it to
    // refreshOraclePrices would throw "no feed configured" mid-build.
    const lazerOnly = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    delete lazerOnly.config.packages.pyth_lazer_rule!.feeds.USDCUSD;
    expect(lazerOnly.pricedPoolTickers()).toEqual([]);
  });

  it("pricedPoolTickers keeps a constant-pinned pool token with no source feed", () => {
    // Constant tickers need no update leg at all, so they stay servable even
    // when the fed set carries no feed for them.
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    delete client.config.packages.pyth_lazer_rule!.feeds.USDCUSD;
    client.config.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    expect(client.pricedPoolTickers()).toEqual(["USDCUSD"]);
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

  it("throws for unknown aggregator and pool token", () => {
    expect(() => client.getAggregator("NOPE")).toThrow(/No aggregator listed/);
    expect(() => client.getPoolTokenType("NOPE")).toThrow(/No pool token registered/);
  });

  it("prototype-key lookups are unknown, not inherited Functions", () => {
    // pool_tokens["toString"] hits Object.prototype.toString via a bare
    // bracket read — truthy, so it was returned as a declared coin type
    // instead of the unknown-token throw. Same class for the alias-keyed
    // rewarders/pools maps.
    for (const proto of ["toString", "constructor"]) {
      expect(() => client.getPoolTokenType(proto)).toThrow(/No pool token registered/);
      expect(() => client.getAggregator(proto)).toThrow(/No aggregator listed/);
      expect(client.getRewarders(proto)).toEqual([]);
    }
  });

  it("throws for missing wlp package", () => {
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

describe("client.pyth (access-only: caller-supplied credential/policy, NO infra)", () => {
  it("is empty by default and never carries endpoints or object ids", () => {
    expect(createUnitTestClient().pyth).toEqual({});
    // Infra is per-source, rule-owned: the Core table lives in oracle/pyth.ts
    // (`PYTH_CORE_INFRA`), the Lazer table in rules/pyth-lazer-rule.ts —
    // nothing source-shaped rides on the client for another source to leak.
    expect(createUnitTestClient({ oracleSource: "pyth_lazer_rule" }).pyth).toEqual({});
  });

  it("a `pyth` block in the config JSON is ignored — access comes from create options only", () => {
    // The canonical waterx-config JSON has never carried one; the SDK no
    // longer looks. State ids / endpoints are not deployment-overridable.
    const config = {
      ...structuredClone(MOCK_TESTNET_CONFIG),
      pyth: {
        state_id: "0x" + "ab".repeat(32),
        wormhole_state_id: "0x" + "cd".repeat(32),
        hermes_endpoint: "https://hermes.example.invalid",
        api_key: "from-json",
      },
    } as unknown as WaterXConfig;

    const client = new PerpClient("TESTNET", config, {});

    expect(client.pyth).toEqual({});
    expect(client.pyth.api_key).toBeUndefined();
  });

  it("pythApiKey is supplied at client init, never through the config JSON", () => {
    const client = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
      pythApiKey: "caller-supplied",
    });

    expect(client.pyth).toEqual({ api_key: "caller-supplied" });
  });

  it("derives the fed set from the config — no option, no env", () => {
    // Both sources wired in the fixture ⇒ both fed. This is the whole contract:
    // what a deployment wires is what it feeds.
    const both = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {});
    expect(both.oracleSources).toEqual(["pyth_lazer_rule", "waterx_rule"]);

    // Unwire lazer ⇒ it drops out, with nothing to keep in sync by hand.
    expect(
      new PerpClient("TESTNET", withOracleSources(MOCK_TESTNET_CONFIG, ["waterx_rule"]), {})
        .oracleSources,
    ).toEqual(["waterx_rule"]);
  });

  it("a published source with an EMPTY feeds map is not in the fed set", () => {
    // Published-but-serving-nothing is not a source; feeding it would emit an
    // update leg that can never carry a ticker.
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    config.packages.pyth_lazer_rule!.feeds = {};
    expect(new PerpClient("TESTNET", config, {}).oracleSources).toEqual(["waterx_rule"]);
  });

  it("retired rule blocks in the config are inert — they can never be derived", () => {
    // `pyth_rule` / `pyth_sponsor_rule` are still present in the LIVE configs.
    // Neither is an ORACLE_SOURCES member (no rule module could feed one), so
    // their presence changes nothing.
    const config = structuredClone(MOCK_TESTNET_CONFIG) as unknown as {
      packages: Record<string, unknown>;
    };
    config.packages.pyth_rule = { published_at: "0x1", feeds: { BTCUSD: {} } };
    config.packages.pyth_sponsor_rule = { published_at: "0x2" };
    const client = new PerpClient("TESTNET", config as unknown as WaterXConfig, {});
    expect(client.oracleSources).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("construction throws when the config wires NO price-update source at all", () => {
    // Not a per-ticker coverage question (that is tx-build's job): a config
    // that can price nothing would skip every ticker and abort every trade.
    const config = withOracleSources(MOCK_TESTNET_CONFIG, []);
    expect(() => new PerpClient("TESTNET", config, {})).toThrow(/wires no price-update source/);
  });

  it("pythFetch is supplied at client init and rides on client.pyth", () => {
    const client = new PerpClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
      pythFetch: { timeoutMs: 8_000, retries: 1 },
    });

    expect(client.pyth).toEqual({ fetch: { timeoutMs: 8_000, retries: 1 } });
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

  it("create() derives the fed set from the loaded config and threads pythApiKey", async () => {
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(
      withOracleSources(MOCK_TESTNET_CONFIG, ["pyth_lazer_rule"]),
    );
    const client = await PerpClient.create("TESTNET", { pythApiKey: "k" });
    expect(client.oracleSources).toEqual(["pyth_lazer_rule"]);
    expect(client.pyth).toEqual({ api_key: "k" });
  });

  it("does NOT throw at init when a wired source cannot serve every ticker", async () => {
    // Per-TICKER coverage is still tx-build's business, not init's: a source
    // wired with a partial feeds map is a perfectly good source.
    const partial = structuredClone(MOCK_TESTNET_CONFIG);
    partial.packages.pyth_lazer_rule!.feeds = { BTCUSD: 1 };
    vi.spyOn(configModule, "loadConfig").mockResolvedValue(partial);
    const client = await PerpClient.create("TESTNET", {});
    expect(client.oracleSources).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("mainnet() and testnet() delegate to create()", async () => {
    const loadConfig = vi.spyOn(configModule, "loadConfig").mockImplementation(async (network) => ({
      ...MOCK_TESTNET_CONFIG,
      network: network === "MAINNET" ? "mainnet" : "testnet",
    }));
    const testnet = await PerpClient.testnet({});
    const mainnet = await PerpClient.mainnet({});
    expect(testnet.network).toBe("TESTNET");
    expect(mainnet.network).toBe("MAINNET");
    expect(loadConfig).toHaveBeenCalledTimes(2);
  });
});
