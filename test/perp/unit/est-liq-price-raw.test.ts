import { describe, expect, it } from "vitest";

import { calcEstLiqPriceRaw } from "../../../src/utils/math.ts";

/**
 * VIEW-model verification matrix for the canonical BigInt mirror of
 * `view.move::calculate_est_liq_price` (WL-2248). Expected values are
 * HAND-DERIVED: transcribed line-by-line from the Move sources
 * (float.move truncating u128 ops, math.move::amount_to_usd two-step
 * composition) into independent integer arithmetic — NOT computed with the
 * SDK implementation under test.
 *
 * These fixtures exercise the VIEW model only (fee bundle saturates at 0,
 * close fee omitted). The REAL model (`calcRealLiqNetCostUsd`, close fee
 * included, signed) is tested separately in math.test.ts — the two models
 * are intentionally different and must never be validated against each other.
 */

const BASE = {
  collateralPriceUsd: 1n,
};

describe("calcEstLiqPriceRaw — hand-derived VIEW-model fixtures", () => {
  it("F1: long, 6-dec collateral, funding owed", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: true,
        sizeRaw: 2_500_000_000n, // 2.5 base tokens
        avgPriceRaw: 97_531_246_789n, // ~$97.53, truncation-sensitive
        collateralAmountRaw: 50_000_000n, // 50 USDC (6 dec)
        collateralDecimal: 6,
        basePriceUsd: 100n,
        maintenanceMarginRaw: 15_000_000n, // 1.5%
        borrowFeeRaw: 2_345_678n,
        fundingSign: true,
        fundingFeeRaw: 500_001n,
        tradingFeeRaw: 1_234_567n,
      }),
    ).toBe(80_663_345_227n);
  });

  it("F2: short, 9-dec collateral, funding income partially credited", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: false,
        sizeRaw: 1_357_000_000n,
        avgPriceRaw: 123_456_789_123n,
        collateralAmountRaw: 75_000_000_123n, // 9-dec token
        collateralDecimal: 9,
        basePriceUsd: 120n,
        maintenanceMarginRaw: 50_000_000n, // 5% (stock-market MMR)
        borrowFeeRaw: 3_000_000_001n,
        fundingSign: false, // income
        fundingFeeRaw: 2_000_000_007n, // < borrow + trading → partial credit
        tradingFeeRaw: 1_000_000_003n,
      }),
    ).toBe(171_251_925_525n);
  });

  it("F3: long, income > all fees — VIEW saturates the bundle to 0 (≡ zero-fee run)", () => {
    const incomeBeyondFees = calcEstLiqPriceRaw({
      ...BASE,
      isLong: true,
      sizeRaw: 1_000_000_000n,
      avgPriceRaw: 100_000_000_000n,
      collateralAmountRaw: 30_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n,
      borrowFeeRaw: 1_000_000n,
      fundingSign: false,
      fundingFeeRaw: 50_000_000n, // income far beyond borrow + trading
      tradingFeeRaw: 1_000_000n,
    });
    const zeroFees = calcEstLiqPriceRaw({
      ...BASE,
      isLong: true,
      sizeRaw: 1_000_000_000n,
      avgPriceRaw: 100_000_000_000n,
      collateralAmountRaw: 30_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n,
      borrowFeeRaw: 0n,
      fundingSign: true,
      fundingFeeRaw: 0n,
      tradingFeeRaw: 0n,
    });
    expect(incomeBeyondFees).toBe(71_500_000_000n);
    // The view discards income beyond the other fees — unlike the REAL check.
    expect(incomeBeyondFees).toBe(zeroFees);
  });

  it("F3b: short, income > all fees — saturating floor (≡ zero-fee run)", () => {
    const incomeBeyondFees = calcEstLiqPriceRaw({
      ...BASE,
      isLong: false,
      sizeRaw: 1_000_000_000n,
      avgPriceRaw: 100_000_000_000n,
      collateralAmountRaw: 30_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n,
      borrowFeeRaw: 700_000n,
      fundingSign: false,
      fundingFeeRaw: 9_000_000n,
      tradingFeeRaw: 300_000n,
    });
    expect(incomeBeyondFees).toBe(128_500_000_000n);
  });

  it("F4: near-liquidation boundary — collateral == deductions is 0n; one raw unit above is not", () => {
    const boundary = {
      ...BASE,
      isLong: true,
      sizeRaw: 1_000_000_000n,
      avgPriceRaw: 100_000_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n, // maintenance = $1.50
      borrowFeeRaw: 500_000n, // + trading 0.5 → fees $1.00; deductions $2.50
      fundingSign: true,
      fundingFeeRaw: 0n,
      tradingFeeRaw: 500_000n,
    };
    // collateral_usd == deductions → lte() → 0n (already liquidatable)
    expect(calcEstLiqPriceRaw({ ...boundary, collateralAmountRaw: 2_500_000n })).toBe(0n);
    // one raw collateral unit ($0.000001) above the boundary → tiny nonzero margin
    expect(calcEstLiqPriceRaw({ ...boundary, collateralAmountRaw: 2_500_001n })).toBe(
      99_999_999_000n,
    );
  });

  it("F5: long, 9-dec collateral, funding income partially credited", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: true,
        sizeRaw: 3_141_592_653n,
        avgPriceRaw: 87_654_321_987n,
        collateralAmountRaw: 200_000_000_042n,
        collateralDecimal: 9,
        basePriceUsd: 90n,
        maintenanceMarginRaw: 20_000_000n, // 2%
        borrowFeeRaw: 4_000_000_009n,
        fundingSign: false,
        fundingFeeRaw: 1_500_000_011n,
        tradingFeeRaw: 2_000_000_003n,
      }),
    ).toBe(27_224_739_238n);
  });

  it("F6: short, 6-dec collateral, funding owed", () => {
    expect(
      calcEstLiqPriceRaw({
        ...BASE,
        isLong: false,
        sizeRaw: 750_000_000n,
        avgPriceRaw: 64_128_256_512n,
        collateralAmountRaw: 40_000_000n,
        collateralDecimal: 6,
        basePriceUsd: 60n,
        maintenanceMarginRaw: 25_000_000n, // 2.5%
        borrowFeeRaw: 1_111_111n,
        fundingSign: true,
        fundingFeeRaw: 2_222_222n,
        tradingFeeRaw: 3_333_333n,
      }),
    ).toBe(107_072_701_817n);
  });

  it("F7/F8: long ratio >= 1 and zero size both return 0n", () => {
    const overCollateralized = {
      ...BASE,
      isLong: true,
      avgPriceRaw: 100_000_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n,
      borrowFeeRaw: 0n,
      fundingSign: true,
      fundingFeeRaw: 0n,
      tradingFeeRaw: 0n,
    };
    // $10k collateral against a $1 notional → ratio >= 1 → 0n
    expect(
      calcEstLiqPriceRaw({
        ...overCollateralized,
        sizeRaw: 10_000_000n,
        collateralAmountRaw: 10_000_000_000n,
      }),
    ).toBe(0n);
    // zero size → entry_notional == 0 → 0n
    expect(
      calcEstLiqPriceRaw({
        ...overCollateralized,
        sizeRaw: 0n,
        collateralAmountRaw: 50_000_000n,
      }),
    ).toBe(0n);
  });

  it("throws RangeError on negative bigints and bad collateralDecimal", () => {
    const valid = {
      ...BASE,
      isLong: true,
      sizeRaw: 1_000_000_000n,
      avgPriceRaw: 100_000_000_000n,
      collateralAmountRaw: 50_000_000n,
      collateralDecimal: 6,
      basePriceUsd: 100n,
      maintenanceMarginRaw: 15_000_000n,
      borrowFeeRaw: 0n,
      fundingSign: true,
      fundingFeeRaw: 0n,
      tradingFeeRaw: 0n,
    };
    expect(() => calcEstLiqPriceRaw({ ...valid, sizeRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, avgPriceRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralAmountRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, basePriceUsd: -100n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, maintenanceMarginRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, fundingFeeRaw: -1n })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: 1.5 })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: 20 })).toThrow(RangeError);
    expect(() => calcEstLiqPriceRaw({ ...valid, collateralDecimal: -1 })).toThrow(RangeError);
  });
});
