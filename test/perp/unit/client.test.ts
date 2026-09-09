import { afterEach, describe, expect, it, vi } from "vitest";

import * as configModule from "../../../src/config.ts";
import type { WaterXConfig } from "../../../src/config.ts";
import { WATERX_INFRA } from "../../../src/oracle/rules/waterx-rule.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../../helpers/fixtures/mock-testnet-config.ts";
import { createUnitTestClient, withOracleSources } from "../helpers/test-client.ts";

describe("PerpClient (offline)", () => {
  const client = createUnitTestClient();

  it("exposes testnet config; source infra is rule-owned, not on the client", () => {
    expect(client.network).toBe("TESTNET");
    expect(client.config.network).toBe("testnet");
    expect(WATERX_INFRA.TESTNET.endpoint).toMatch(/^https:/);
    expect(client.config.objects.perp.global_config).toMatch(/^0x/);
  });

  it("getMarket returns market entry for BTCUSD", () => {
    const m = client.getMarket("BTCUSD");
    expect(m.market).toMatch(/^0x/);
    expect(m.config).toMatch(/^0x/);
  });

  it("getMarket throws for unknown ticker", () => {
    expect(() => client.getMarket("NOPE")).toThrow(/missing objects\.perp\.markets\.NOPE/);
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
    delete lazerOnly.config.oracle_rules.pyth_lazer!.lazer_feed_ids.USDCUSD;
    expect(lazerOnly.pricedPoolTickers()).toEqual([]);
  });

  it("pricedPoolTickers keeps a constant-pinned pool token with no source feed", () => {
    // Constant tickers need no update leg at all, so they stay servable even
    // when the fed set carries no feed for them.
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    delete client.config.oracle_rules.pyth_lazer!.lazer_feed_ids.USDCUSD;
    client.config.oracle_rules.constant.constant_prices.USDCUSD = { price: "1000000000" };
    expect(client.pricedPoolTickers()).toEqual(["USDCUSD"]);
  });

  it("isConstantTicker reflects oracle_rules.constant.constant_prices", () => {
    // Shared fixture carries the constant rule with an EMPTY pin map → every
    // ticker stays on the live sources.
    expect(client.isConstantTicker("USDCUSD")).toBe(false);
    expect(client.isConstantTicker("BTCUSD")).toBe(false);

    // A pinned ticker is constant-routed; the rest are untouched.
    client.config.oracle_rules.constant.constant_prices = { USDCUSD: { price: "1000000000" } };
    expect(client.isConstantTicker("USDCUSD")).toBe(true);
    expect(client.isConstantTicker("BTCUSD")).toBe(false);
  });

  it("throws for unknown aggregator and pool token", () => {
    expect(() => client.getAggregator("NOPE")).toThrow(
      /missing objects\.oracle\.aggregators\.NOPE/,
    );
    expect(() => client.getPoolTokenType("NOPE")).toThrow(/No pool token registered/);
  });

  it("prototype-key lookups are unknown, not inherited Functions", () => {
    // pool_tokens["toString"] hits Object.prototype.toString via a bare
    // bracket read — truthy, so it was returned as a declared coin type
    // instead of the unknown-token throw. Same class for the alias-keyed
    // rewarders/pools maps.
    for (const proto of ["toString", "constructor"]) {
      expect(() => client.getPoolTokenType(proto)).toThrow(/No pool token registered/);
      expect(() => client.getAggregator(proto)).toThrow(/missing objects\.oracle\.aggregators\./);
      expect(client.getRewarders(proto)).toEqual([]);
    }
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

  it("creditType reads objects.credit; the credit / bridge ids ride on objects.*", () => {
    // Every id the funding base reads is a deployment value under `objects.*`
    // — no client accessor wraps them, and none is network-defaulted.
    expect(client.creditType()).toBe(client.config.objects.credit.credit_type);
    expect(client.creditType()).toContain("::");
    expect(client.config.objects.credit.registry).toMatch(/^0x/);
    expect(client.config.objects.bridge.state).toMatch(/^0x/);
    expect(client.config.objects.bridge.wormhole_state).toMatch(/^0x/);
  });

  it("native custody assets ride on objects.custody; getNativeAsset resolves one by type", () => {
    const assets = client.config.objects.custody.assets;
    expect(assets.length).toBeGreaterThan(0);
    expect(client.getNativeAsset(MOCK_CUSTODY_ASSET_TYPE).type).toBe(MOCK_CUSTODY_ASSET_TYPE);
    expect(() => client.getNativeAsset("0xdead::nope::NOPE")).toThrow(
      /No native custody asset registered/,
    );
  });
});

describe("client.pyth (access-only: caller-supplied credential/policy, NO infra)", () => {
  it("is empty by default and never carries endpoints or object ids", () => {
    expect(createUnitTestClient().pyth).toEqual({});
    // Infra is per-source, rule-owned: the Lazer table lives in
    // rules/pyth-lazer-rule.ts — nothing source-shaped rides on the client for
    // another source to leak.
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

  it("a published source with an EMPTY lazer_feed_ids map is not in the fed set", () => {
    // Published-but-serving-nothing is not a source; feeding it would emit an
    // update leg that can never carry a ticker.
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    config.oracle_rules.pyth_lazer!.lazer_feed_ids = {};
    expect(new PerpClient("TESTNET", config, {}).oracleSources).toEqual(["waterx_rule"]);
  });

  it("the retired oracle_rules.pyth block is inert — it can never be derived", () => {
    // Pyth Core's block is schema-required and still published in the LIVE
    // configs. `pyth_rule` is not an ORACLE_SOURCES member (no rule module
    // could feed it), so populating its feed map changes nothing.
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    config.oracle_rules.pyth.pyth_price_feeds = {
      BTCUSD: { feed_id: "0x" + "ef".repeat(32), price_info_object: "0x" + "01".repeat(32) },
    };
    const client = new PerpClient("TESTNET", config, {});
    expect(client.oracleSources).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("construction throws when the config wires NO price-update source at all", () => {
    // Not a per-ticker coverage question (that is tx-build's job): a config
    // that can price nothing would skip every ticker and abort every trade.
    const config = withOracleSources(MOCK_TESTNET_CONFIG, []);
    expect(() => new PerpClient("TESTNET", config, {})).toThrow(/wires no price-update source/);
    // The message points at the two wiring locations an operator would fix.
    expect(() => new PerpClient("TESTNET", config, {})).toThrow(/oracle_rules\.pyth_lazer/);
    expect(() => new PerpClient("TESTNET", config, {})).toThrow(/symbols/);
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
    expect(client.config.objects.perp.markets.BTCUSD).toBeDefined();
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
    // wired with a partial feed map is a perfectly good source.
    const partial = structuredClone(MOCK_TESTNET_CONFIG);
    partial.oracle_rules.pyth_lazer!.lazer_feed_ids = { BTCUSD: 1 };
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
