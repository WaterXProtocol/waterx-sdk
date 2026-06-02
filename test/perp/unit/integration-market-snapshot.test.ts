import { describe, expect, it } from "vitest";

/** Legacy no-op kept for integration porting reference. */
function alignPositionSizeToMarket(size: bigint): bigint {
  return size;
}

function assertMarketSnapshotTradeable(snap: { isActive: boolean }, label = "market"): void {
  if (!snap.isActive) throw new Error(`${label}: market inactive`);
}

describe("alignPositionSizeToMarket", () => {
  it("returns size unchanged (no-op)", () => {
    expect(alignPositionSizeToMarket(2003n)).toBe(2003n);
  });
});

describe("assertMarketSnapshotTradeable", () => {
  it("throws when market is inactive", () => {
    expect(() => assertMarketSnapshotTradeable({ isActive: false }, "t")).toThrow(/inactive/);
  });
});
