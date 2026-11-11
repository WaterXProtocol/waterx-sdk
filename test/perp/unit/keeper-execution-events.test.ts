/** v4 lifecycle BCS fixtures pinned to waterx-contract #167 ed63a1d. */
import { bcs } from "@mysten/sui/bcs";
import { describe, expect, it } from "vitest";

import { ExecutionQueuedBcs, OrderRejectedByKeeperBcs } from "../../../src/perp/index.ts";

const market = "0x" + "11".repeat(32);
const account = "0x" + "22".repeat(32);

describe("Keeper execution event ABI", () => {
  it("decodes a queued close with exact u64/u128 values and no memo field", () => {
    // Independently compose the Move layout instead of round-tripping the same schema.
    const wire = bcs
      .struct("ExecutionQueuedFixture", {
        market: bcs.Address,
        account: bcs.Address,
        order: bcs.u64(),
        position: bcs.option(bcs.u64()),
        action: bcs.u8(),
        size: bcs.u128(),
        acceptable: bcs.u64(),
      })
      .serialize({
        market,
        account,
        order: 91n,
        position: 42n,
        action: 1,
        size: 16777216000000001n,
        acceptable: 123n,
      })
      .toBytes();
    expect(ExecutionQueuedBcs.parse(wire)).toEqual({
      market_id: market,
      account_id: account,
      order_id: "91",
      position_id: "42",
      requested_action: 1,
      size: { value: "16777216000000001" },
      acceptable_price: "123",
    });
  });

  it("decodes the rejection reason and contract-owned refund amount", () => {
    const wire = bcs
      .struct("RejectFixture", {
        market: bcs.Address,
        account: bcs.Address,
        order: bcs.u64(),
        reason: bcs.string(),
        refunded: bcs.u64(),
      })
      .serialize({ market, account, order: 91n, reason: "priority preemption", refunded: 1000000n })
      .toBytes();
    expect(OrderRejectedByKeeperBcs.parse(wire)).toMatchObject({
      order_id: "91",
      reason: "priority preemption",
      refunded_collateral_amount: "1000000",
    });
  });
});
