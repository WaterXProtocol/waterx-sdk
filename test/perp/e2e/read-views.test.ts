/**
 * E2E: global / market / pool / token-pool views + client shorthand accessors.
 */
import { getGlobalConfigData, getMarketData, getPoolData, getTokenPoolData } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`read chain views (${e2eNetwork})`, () => {
  it("loads BTCUSD market entry from config", () => {
    expect(client.config.packages.waterx_perp.markets.BTCUSD).toBeDefined();
    expect(client.getMarket("BTCUSD").market).toMatch(/^0x/);
  });

  it("getGlobalConfigData", async () => {
    const cfg = await getGlobalConfigData(client);
    expect(Array.isArray(cfg.allowed_versions)).toBe(true);
    expect(BigInt(cfg.protocol_fee_share_bps)).toBeGreaterThan(0n);
  }, 60_000);

  it("getMarketData (BTCUSD)", async () => {
    const m = await getMarketData(client, { ticker: "BTCUSD" });
    expect(m.symbol.length).toBeGreaterThan(0);
    expect(BigInt(m.max_leverage_bps)).toBeGreaterThan(0n);
  }, 60_000);

  it("getPoolData", async () => {
    const pool = await getPoolData(client);
    expect(BigInt(pool.total_lp_supply)).toBeGreaterThanOrEqual(0n);
  }, 60_000);

  it("getTokenPoolData (first pool token)", async () => {
    const tp = await getTokenPoolData(client, { tokenIndex: 0 });
    expect(Number(tp.token_decimal)).toBeGreaterThanOrEqual(0);
  }, 60_000);

  it("client.getAggregator / getPythFeed / wlpType / getPoolTokenType", () => {
    const agg = client.config.packages.waterx_oracle?.aggregators?.BTCUSD;
    if (agg) expect(client.getAggregator("BTCUSD")).toBe(agg);
    expect(client.getPythFeed("BTCUSD").feed_id).toBeTruthy();
    expect(client.wlpType()).toContain("::wlp::WLP");
    expect(client.getPoolTokenType("USDCUSD")).toContain("::");
  });
});
