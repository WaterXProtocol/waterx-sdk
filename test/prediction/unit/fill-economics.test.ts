import { describe, expect, it } from "vitest";

import {
  assertFillEconomicsOnChain,
  assertKeeperFillArgsWithinCaps,
  effectiveFillPriceBps,
  keeperFillFromPlaceCaps,
  keeperFillTargetCost,
  lockedOddsCentsFromFillBps,
  placeCapsFromOrderPlacedEvent,
} from "../helpers/fill-economics.ts";

const POSITION = {
  positionId: 7n,
  accountId: `0x${"a".repeat(64)}`,
  marketId: new Uint8Array([1]),
  marketIdHex: "0x01",
  selection: "YES" as const,
  status: "OPEN" as const,
  filledShares: 1n,
  filledCost: 1n,
  openedTs: 1n,
  payout: 0n,
  closeOrderId: null,
  closeMinProceeds: 0n,
  closeExpiryTs: 0n,
  closeSelfCancelAfterTs: 0n,
};

describe("fill-economics", () => {
  it("effectiveFillPriceBps and lockedOddsCents mapping", () => {
    expect(effectiveFillPriceBps(1n, 1n)).toBe(10_000n);
    expect(lockedOddsCentsFromFillBps(10_000n)).toBe(100);
    expect(effectiveFillPriceBps(2n, 1n)).toBe(5_000n);
  });

  it("assertFillEconomicsOnChain enforces caps", () => {
    const placed = {
      type: "0x1::events::OrderPlaced",
      json: { max_spend: "1000", min_shares: "1", price_cap: "10000" },
    };
    const fill = {
      type: "0x1::events::OrderFilled",
      json: { filled_shares: "1", filled_cost: "1" },
    };
    const bps = assertFillEconomicsOnChain(placeCapsFromOrderPlacedEvent(placed), fill, POSITION);
    expect(bps).toBe(10_000n);
  });

  it("keeperFillFromPlaceCaps stays within low catalog price caps", () => {
    const caps = { maxSpend: 10_000_000n, minShares: 1n, priceCapBps: 2_100n };
    const fill = keeperFillFromPlaceCaps(caps);
    expect(() =>
      assertKeeperFillArgsWithinCaps(caps, fill.filledShares, fill.filledCost),
    ).not.toThrow();
  });

  it("keeperFillTargetCost fills ~$1.11 at 50¢ cap", () => {
    const caps = { maxSpend: 1_110_000n, minShares: 1n, priceCapBps: 5_000n };
    const fill = keeperFillTargetCost(caps, 1_110_000n);
    expect(fill.filledCost).toBe(1_110_000n);
    expect(() =>
      assertKeeperFillArgsWithinCaps(caps, fill.filledShares, fill.filledCost),
    ).not.toThrow();
  });

  it("rejects fill cost above max_spend", () => {
    const caps = { maxSpend: 1n, minShares: 1n, priceCapBps: 10_000n };
    expect(() =>
      assertFillEconomicsOnChain(
        caps,
        { type: "", json: { filled_shares: "1", filled_cost: "2" } },
        POSITION,
      ),
    ).toThrow();
  });
});
