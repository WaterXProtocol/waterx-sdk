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

  it("getCollateralAssets returns empty when pyth_rule feeds are absent", () => {
    const noFeeds = {
      ...MOCK_TESTNET_CONFIG,
      packages: { ...MOCK_TESTNET_CONFIG.packages, pyth_rule: undefined },
    } as unknown as WaterXConfig;
    expect(getCollateralAssets(noFeeds)).toEqual([]);
  });

  it("returns empty arrays when maps are empty", () => {
    const bare = structuredClone(MOCK_TESTNET_CONFIG);
    bare.packages.waterx_perp.markets = {};
    bare.packages.wlp!.pool_tokens = {};
    expect(getMarketTickers(bare)).toEqual([]);
    expect(getCollateralAssets(bare)).toEqual([]);
  });
});
