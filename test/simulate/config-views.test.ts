/**
 * E2E: read-only view queries against testnet via simulateTransaction.
 */
import { getGlobalConfigData, getMarketData, getPoolData, positionExists } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`config + view simulate (${e2eNetwork})`, () => {
  it("client loaded canonical markets", () => {
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

  it("positionExists for unlikely id", async () => {
    const exists = await positionExists(client, { ticker: "BTCUSD", positionId: 999_999_999n });
    expect(exists).toBe(false);
  }, 60_000);
});
