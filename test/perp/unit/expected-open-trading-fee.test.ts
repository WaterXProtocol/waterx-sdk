import { describe, expect, it } from "vitest";

import {
  calculateTotalTradingFeeBps,
  expectedOpenTradingFeeRaw,
} from "../helpers/trading/expected-open-trading-fee.ts";

const PRECISION = 1_000_000_000n;

/** Aligns with `trading_tests::test_open_position_deducts_collateral` / `test_impact_fee_applies_only_when_lp_exposure_worsens`. */
describe("expectedOpenTradingFeeRaw (mirrors on-chain fee math)", () => {
  it("matches Move test: 1e9 size, $50k BTC, $100k pool TVL, 5 bps base → $50 fee (10 bps total)", () => {
    const fee = expectedOpenTradingFeeRaw({
      tradingFeeBps: 5n,
      longOi: 0n,
      shortOi: 0n,
      poolTvlUsdScaled: 100_000n * PRECISION,
      sizeAmount: 1_000_000_000n,
      sizeDecimal: 9,
      orderIsLong: true,
      entryPriceScaled: 50_000n * PRECISION,
      collateralDecimal: 6,
      collateralPriceScaled: 1n * PRECISION,
    });
    expect(fee).toBe(50_000_000n);
  });

  it("closing leg after long OI: short 1e9 has only base 5 bps (no worsening LP exposure)", () => {
    const total = calculateTotalTradingFeeBps({
      tradingFeeBps: 5n,
      longOi: 1_000_000_000n,
      shortOi: 0n,
      poolTvlUsdScaled: 100_000n * PRECISION,
      executionPriceScaled: 50_000n * PRECISION,
      sizeDecimal: 9,
      orderIsLong: false,
      orderSize: 1_000_000_000n,
    });
    expect(total).toBe(5n);
  });
});
