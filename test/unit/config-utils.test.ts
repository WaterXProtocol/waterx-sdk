import { describe, expect, it } from "vitest";

import { getBaseAssets, getCollateralAssets } from "../../src/utils/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

describe("config utils", () => {
  it("getBaseAssets returns waterx_perp market tickers", () => {
    const bases = getBaseAssets(MOCK_TESTNET_CONFIG);
    expect(bases).toEqual(expect.arrayContaining(["BTCUSD", "ETHUSD"]));
    expect(bases).toHaveLength(2);
  });

  it("getCollateralAssets returns wlp pool token tickers", () => {
    const collaterals = getCollateralAssets(MOCK_TESTNET_CONFIG);
    expect(collaterals).toEqual(["USDCUSD"]);
  });

  it("returns empty arrays when maps are empty", () => {
    const bare = structuredClone(MOCK_TESTNET_CONFIG);
    bare.packages.waterx_perp.markets = {};
    bare.packages.wlp!.pool_tokens = {};
    expect(getBaseAssets(bare)).toEqual([]);
    expect(getCollateralAssets(bare)).toEqual([]);
  });
});
