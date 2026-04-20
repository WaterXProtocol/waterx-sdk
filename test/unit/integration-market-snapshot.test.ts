import { describe, expect, it } from "vitest";

import {
  alignPositionSizeToMarket,
  assertMarketSnapshotTradeable,
} from "../integration/helpers/integration-market-snapshot.ts";

describe("alignPositionSizeToMarket", () => {
  // v2 removed `lot_size` / `min_size`; helper is a no-op for legacy call-sites.
  it("returns size unchanged (no-op in v2)", () => {
    expect(alignPositionSizeToMarket(2003n)).toBe(2003n);
    expect(alignPositionSizeToMarket(3n)).toBe(3n);
    expect(alignPositionSizeToMarket(2000n)).toBe(2000n);
  });
});

describe("assertMarketSnapshotTradeable", () => {
  it("throws when market is inactive", () => {
    expect(() =>
      assertMarketSnapshotTradeable(
        {
          marketId: `0x${"00".repeat(32)}`,
          baseToken: "0x2::sui::SUI",
          lpToken: "0x0::wlp::WLP",
          isActive: false,
          longOi: 0n,
          shortOi: 0n,
          maxLongOi: 1n,
          maxShortOi: 1n,
          maxLeverageBps: 1n,
          tradingFeeBps: 1n,
          maxImpactFeeBps: 1n,
          allocatedLpExposureBps: 2_000n,
          impactFeeCurvature: 2n,
          impactFeeScale: 1n,
          maintenanceMarginBps: 1n,
          minCollValue: 0n,
          cooldownMs: 0n,
          basicFundingRate: 0n,
          fundingIntervalMs: 0n,
          orderPriceTick: 1n,
          cumulativeFundingSign: true,
          cumulativeFundingIndex: 0n,
          lastFundingTimestamp: 0n,
          nextPositionId: 0n,
          nextOrderId: 0n,
        },
        "t",
      ),
    ).toThrow(/inactive/);
  });
});
