import { describe, expect, it } from "vitest";

import { configuredOracleRules } from "../../../src/oracle/feeds.ts";
import type { WaterXConfig } from "../../../src/perp/config.ts";
import { getCollateralAssets, getMarketTickers } from "../../../src/utils/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

describe("config utils", () => {
  it("getMarketTickers returns waterx_perp market tickers", () => {
    const bases = getMarketTickers(MOCK_TESTNET_CONFIG);
    expect(bases).toEqual(expect.arrayContaining(["BTCUSD", "ETHUSD"]));
    expect(bases).toHaveLength(2);
  });

  it("getCollateralAssets returns wlp pool token tickers", () => {
    const collaterals = getCollateralAssets(MOCK_TESTNET_CONFIG);
    expect(collaterals).toEqual(["USDCUSD"]);
  });

  it("getCollateralAssets keeps a pool token another rule still wires when pyth_rule is gone", () => {
    // Retiring Core (testnet did exactly this) must not strand the pool's
    // collateral: USDCUSD is also in pyth_lazer_rule + waterx_rule feeds.
    const noPyth = {
      ...MOCK_TESTNET_CONFIG,
      packages: { ...MOCK_TESTNET_CONFIG.packages, pyth_rule: undefined },
    } as unknown as WaterXConfig;
    expect(getCollateralAssets(noPyth)).toEqual(["USDCUSD"]);
  });

  it("getCollateralAssets returns empty when NO rule wires the pool token", () => {
    const noRules = structuredClone(MOCK_TESTNET_CONFIG) as unknown as {
      packages: Record<string, unknown>;
    };
    delete noRules.packages.pyth_rule;
    delete noRules.packages.pyth_lazer_rule;
    delete noRules.packages.waterx_rule;
    delete noRules.packages.constant_rule;
    expect(getCollateralAssets(noRules as unknown as WaterXConfig)).toEqual([]);
  });

  it("a HALF-WIRED rule block does not count as wiring the ticker", () => {
    // Rollout hazard: `loadConfig` deliberately validates no optional rule
    // block, so a JSON can list feeds before every object id lands. A
    // feeds-only check would report the pool token usable right up until the
    // builder died on the missing ids — each rule must be all-or-nothing.
    const partial = structuredClone(MOCK_TESTNET_CONFIG) as unknown as {
      packages: Record<string, Record<string, unknown>>;
    };
    delete partial.packages.constant_rule;
    // lazer keeps its feeds but loses `state` (the verify entry's object);
    // waterx keeps its feeds but loses `enclave` (the signature check's).
    delete partial.packages.pyth_lazer_rule.state;
    delete partial.packages.waterx_rule.enclave;

    const cfg = partial as unknown as WaterXConfig;
    expect(configuredOracleRules(cfg, "USDCUSD")).toEqual([]);
    expect(getCollateralAssets(cfg)).toEqual([]);
  });

  it("a fully-wired rule block still counts", () => {
    // The other half of the guard: the readiness check must not reject a
    // complete block. USDCUSD is wired under both lazer and waterx in the
    // fixture.
    expect(configuredOracleRules(MOCK_TESTNET_CONFIG, "USDCUSD")).toEqual([
      "pyth_lazer_rule",
      "waterx_rule",
    ]);
  });

  it("returns empty arrays when maps are empty", () => {
    const bare = structuredClone(MOCK_TESTNET_CONFIG);
    bare.packages.waterx_perp.markets = {};
    bare.packages.wlp!.pool_tokens = {};
    expect(getMarketTickers(bare)).toEqual([]);
    expect(getCollateralAssets(bare)).toEqual([]);
  });
});
