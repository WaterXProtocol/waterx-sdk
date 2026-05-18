import { createTestnetConfig, WaterXClient } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { MARKET_DEFINITIONS } from "../../../scripts/market-params.ts";
import type { BaseAsset } from "../../../src/constants.ts";
import { getMarketSummary } from "../../../src/fetch.ts";

/**
 * Read-only testnet checks: published `Market` must match `scripts/market-params.ts`.
 * `max_leverage_bps` is the on-chain cap; violating it aborts with code 104 (`err_exceed_max_leverage`).
 */
const client = new WaterXClient(createTestnetConfig());

const MARKET_BASES = Object.keys(MARKET_DEFINITIONS) as BaseAsset[];

describe("Integration: on-chain market params vs MARKET_DEFINITIONS", () => {
  it.each(MARKET_BASES)("%s", async (base) => {
    const entry = client.getMarketEntry(base);
    const s = await getMarketSummary(client, entry.marketId, entry.baseType);
    const def = MARKET_DEFINITIONS[base];

    expect(s.isActive).toBe(true);
    expect(s.maxLeverageBps).toBe(BigInt(def.maxLeverageBps));
    expect(s.tradingFeeBps).toBe(BigInt(def.tradingFeeBps));
    expect(s.maintenanceMarginBps).toBe(BigInt(def.maintenanceMarginBps));
    expect(s.maxLongOi).toBe(def.maxLongOi);
    expect(s.maxShortOi).toBe(def.maxShortOi);
    expect(s.minCollValue).toBe(def.minCollValue);
  });
});
