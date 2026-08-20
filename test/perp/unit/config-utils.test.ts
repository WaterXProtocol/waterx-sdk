import { describe, expect, it } from "vitest";

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

  it("returns empty arrays when maps are empty", () => {
    const bare = structuredClone(MOCK_TESTNET_CONFIG);
    bare.packages.waterx_perp.markets = {};
    bare.packages.wlp!.pool_tokens = {};
    expect(getMarketTickers(bare)).toEqual([]);
    expect(getCollateralAssets(bare)).toEqual([]);
  });
});
