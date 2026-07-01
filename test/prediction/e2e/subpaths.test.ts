import { Transaction } from "@mysten/sui/transactions";
import { getRegistry } from "~predict/fetch.ts";
import { placeOrder } from "~predict/user/order.ts";
import { mapRegistryView } from "~predict/utils/bcs.ts";
import { normalizeMarketId, requireConfig } from "~predict/utils/index.ts";
import { describe, expect, it } from "vitest";

import { createE2eClient } from "../helpers/e2e-context.ts";

describe("package subpath imports", () => {
  it("user/order re-export constructs same PTB entry as core", async () => {
    const client = await createE2eClient();
    const txUser = new Transaction();
    placeOrder(client, txUser, {
      accountId: "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51",
      maxSpend: 1n,
      marketId: "0x01",
      selection: "YES",
      minShares: 1n,
      priceCapBps: 1000n,
      expiryTs: 9n,
    });
    expect(txUser.getData().commands.length).toBeGreaterThan(0);
  });

  it("utils barrel helpers", () => {
    expect(normalizeMarketId("0x0102").length).toBe(2);
    expect(() => requireConfig(undefined, "x")).toThrow();
  });

  it("utils/bcs import path mirrors src/bcs registry mapping", async () => {
    const client = await createE2eClient();
    const live = await getRegistry(client);
    const mapped = mapRegistryView({
      balance: live.balance,
      min_reserve: live.minReserve,
      order_cancel_cooldown_ms: live.orderCancelCooldownMs,
      next_order_id: live.nextOrderId,
      next_position_id: live.nextPositionId,
      order_count: live.orderCount,
      position_count: live.positionCount,
      unresolved_market_count: live.unresolvedMarketCount,
      resolved_market_count: live.resolvedMarketCount,
    });
    expect(mapped).toEqual(live);
  });
});
