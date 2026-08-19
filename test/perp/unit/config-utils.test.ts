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

  it("getCollateralAssets returns empty when NO live rule lists a pool-token feed", () => {
    // A pool-token key counts iff SOME live rule's feeds block lists it
    // (constant / lazer / waterx). Strip all three → nothing is servable.
    const noFeeds = {
      ...MOCK_TESTNET_CONFIG,
      packages: {
        ...MOCK_TESTNET_CONFIG.packages,
        constant_rule: undefined,
        pyth_lazer_rule: undefined,
        waterx_rule: undefined,
      },
    } as unknown as WaterXConfig;
    expect(getCollateralAssets(noFeeds)).toEqual([]);
  });

  it("getCollateralAssets counts a pool token served by ANY single live rule", () => {
    // constant_rule alone is enough — the shared fixture's constant feeds are
    // empty, so pin USDCUSD there and strip the other two rule blocks.
    const constantOnly = structuredClone(MOCK_TESTNET_CONFIG);
    constantOnly.packages.constant_rule!.feeds = { USDCUSD: { price: "1000000000" } };
    delete constantOnly.packages.pyth_lazer_rule;
    delete constantOnly.packages.waterx_rule;
    expect(getCollateralAssets(constantOnly)).toEqual(["USDCUSD"]);
  });

  it("returns empty arrays when maps are empty", () => {
    const bare = structuredClone(MOCK_TESTNET_CONFIG);
    bare.packages.waterx_perp.markets = {};
    bare.packages.wlp!.pool_tokens = {};
    expect(getMarketTickers(bare)).toEqual([]);
    expect(getCollateralAssets(bare)).toEqual([]);
  });
});
