/**
 * Smoke: discovered market position owner resolves to accounts via `getAccountsByOwner`.
 */
import { getAccountsByOwner } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { discoverActivePosition } from "../helpers/e2e/discover-on-chain-position.ts";
import { client } from "../helpers/e2e/e2e-client.ts";
import { activeLifecycleTestBasesForClient } from "../helpers/e2e/lifecycle-test-markets.ts";

describe("Discovery owner (simulate)", () => {
  it("getAccountsByOwner lists the account that owns a scanned position", async (ctx) => {
    let hit = null as Awaited<ReturnType<typeof discoverActivePosition>>;
    for (const base of activeLifecycleTestBasesForClient(client)) {
      hit = await discoverActivePosition(client, base);
      if (hit) break;
    }
    if (!hit) {
      ctx.skip("No open position found on any lifecycle market.");
      return;
    }

    const accounts = await getAccountsByOwner(client, hit.ownerAddress);
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    expect(
      accounts.some(
        (a) =>
          a.accountId.replace(/^0x/i, "").toLowerCase() ===
          hit!.accountObjectAddress.replace(/^0x/i, "").toLowerCase(),
      ),
    ).toBe(true);
  }, 120_000);
});
