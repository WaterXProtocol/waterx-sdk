/**
 * Read-only: error and edge-case behavior for fetch.ts helpers (`WATERX_E2E_NETWORK`).
 */
import {
  getAccountDelegates,
  getAccountsByOwner,
  getPosition,
  getTokenPoolSummary,
  selectCoinsForAmount,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`fetch error / edge cases (${e2eNetwork} simulate)`, () => {
  it("getAccountsByOwner(zero address) returns empty list", async () => {
    const accounts = await getAccountsByOwner(
      client,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBe(0);
  });

  it("getPosition for very unlikely position id throws or fails simulate", async () => {
    const m = client.getMarketEntry("BTC");
    await expect(getPosition(client, m.marketId, 999_999n, m.baseType)).rejects.toThrow();
  });

  it("getAccountDelegates for non-existent owner returns []", async () => {
    const delegates = await getAccountDelegates(
      client,
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000000000000000000000000001",
    );
    expect(delegates).toEqual([]);
  });

  it("getTokenPoolSummary(invalid large index) throws", async () => {
    await expect(getTokenPoolSummary(client, 999)).rejects.toThrow();
  });

  it("selectCoinsForAmount throws when balance insufficient", async () => {
    await expect(
      selectCoinsForAmount(
        client,
        client.config.globalConfig,
        client.config.collaterals.USDC.type,
        1n,
      ),
    ).rejects.toThrow(/Insufficient balance/);
  }, 60_000);
});
