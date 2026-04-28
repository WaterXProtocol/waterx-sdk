/**
 * View/query tests (read-only via simulateTransaction).
 */
import { getMarketSummary, getPoolSummary, getTokenPoolSummary } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client } from "../helpers/e2e/e2e-client.ts";
import {
  expectMarketOiFieldsParsed,
  expectMarketSizeFieldsParsed,
} from "../helpers/trading/market-summary-assertions.ts";

describe("View Functions", () => {
  describe("getMarketSummary", () => {
    it("returns BTC market info", async () => {
      const m = client.getMarketEntry("BTC");
      const summary = await getMarketSummary(client, m.marketId, m.baseType);
      expect(typeof summary.isActive).toBe("boolean");
      expectMarketOiFieldsParsed(summary);
      expect(summary.maxLeverageBps).toBeGreaterThan(0n);
      expectMarketSizeFieldsParsed(summary);
      expect(summary.tradingFeeBps).toBeGreaterThan(0n);
    }, 30_000);

    it("returns ETH market info", async () => {
      const m = client.getMarketEntry("ETH");
      const summary = await getMarketSummary(client, m.marketId, m.baseType);
      expect(summary.isActive).toBe(true);
      expectMarketOiFieldsParsed(summary);
      expectMarketSizeFieldsParsed(summary);
      expect(summary.maxLeverageBps).toBeGreaterThan(0n);
    }, 30_000);
  });

  describe("getPoolSummary / WLP metrics", () => {
    it("returns WLP pool info", async () => {
      const summary = await getPoolSummary(client);
      expect(summary.isActive).toBe(true);
      expect(summary.totalLpSupply).toBeGreaterThan(0n);
      expect(summary.tokenCount).toBeGreaterThan(0n);
    }, 30_000);

    it("pool totalLpSupply is accessible via getPoolSummary", async () => {
      const pool = await getPoolSummary(client);
      expect(pool.totalLpSupply).toBeGreaterThanOrEqual(0n);
    }, 30_000);

    it("pool tvlUsd is Float-scaled (bigint)", async () => {
      const pool = await getPoolSummary(client);
      expect(pool.tvlUsd >= 0n).toBe(true);
    }, 30_000);
  });

  describe("getTokenPoolSummary", () => {
    it("returns first token pool info", async () => {
      const summary = await getTokenPoolSummary(client, 0);
      expect(summary.tokenDecimal).toBeGreaterThan(0);
      expect(summary.liquidityAmount).toBeGreaterThanOrEqual(0n);
      expect(summary.lastPriceRefreshTimestamp).toBeGreaterThanOrEqual(0n);
    }, 30_000);
  });
});
