/**
 * Read-only testnet: error and edge-case behavior for fetch.ts helpers.
 */
import {
  getAccountDelegates,
  getAccountsByOwner,
  getPosition,
  getTokenPoolSummary,
  selectCoinsForAmount,
  TESTNET_MARKETS,
  TESTNET_OBJECTS,
  TESTNET_TYPES,
} from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client } from "../helpers/testnet";

describe("fetch error / edge cases (testnet simulate)", () => {
  it("getAccountsByOwner(zero address) returns empty list", async () => {
    const accounts = await getAccountsByOwner(
      client,
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBe(0);
  });

  it("getPosition for very unlikely position id throws or fails simulate", async () => {
    await expect(
      getPosition(client, TESTNET_MARKETS.BTC.marketId, 999_999n, TESTNET_MARKETS.BTC.baseType),
    ).rejects.toThrow();
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
    // Use a shared object ID that is not a funded UserAccount — no USDC coins as TTO children.
    await expect(
      selectCoinsForAmount(client, TESTNET_OBJECTS.GLOBAL_CONFIG, TESTNET_TYPES.USDC, 1n),
    ).rejects.toThrow(/Insufficient balance/);
  }, 60_000);
});
