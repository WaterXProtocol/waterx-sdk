import { describe, expect, it } from "vitest";

import { BPS_SCALE, DOUBLE_SCALE, FLOAT_SCALE, MS_PER_YEAR } from "../../src/constants.ts";
import {
  annualizedApyFromRatio,
  annualizeFundingRate,
  calcBorrowRate,
  calcBorrowRateAccrual,
  calcDynamicFeeBps,
  calcEffectiveCollateralUsd,
  calcEstLiqPrice,
  calcFee,
  calcFundingFeeUsd,
  calcFundingRate,
  calcImpactFeeRate,
  calcLeverage,
  calcMaxReducibleCollateralUsd,
  calcNotional,
  calcPositionBorrowFee,
  calcTokenUtilizationBps,
  calcTotalTradingFeeRate,
  calcUnrealizedPnl,
  calcWlpIncentiveApy,
  calcWlpMintOut,
  calcWlpPrice,
  calcWlpRedeemOut,
  decodeFundingIndexDelta,
  rawPrice,
} from "../../src/utils/math.ts";

describe("rawPrice", () => {
  it("scales USD to 1e9 fixed-point", () => {
    expect(rawPrice(50_000)).toBe(50_000_000_000_000n);
    expect(rawPrice("1.5")).toBe(1_500_000_000n);
  });

  it("throws on non-finite USD input", () => {
    expect(() => rawPrice(Number.NaN)).toThrow(/Invalid USD price/);
    expect(() => rawPrice("not-a-number")).toThrow(/Invalid USD price/);
    expect(() => rawPrice(Number.POSITIVE_INFINITY)).toThrow(/Invalid USD price/);
  });
});

describe("basic position math", () => {
  it("calcNotional and calcFee", () => {
    expect(calcNotional(2, 50_000)).toBe(100_000);
    expect(calcFee(100_000, 0.0003)).toBeCloseTo(30);
  });

  it("calcUnrealizedPnl long vs short", () => {
    expect(calcUnrealizedPnl(true, 100, 110, 1)).toBeCloseTo(10);
    expect(calcUnrealizedPnl(false, 100, 90, 1)).toBeCloseTo(10);
    expect(calcUnrealizedPnl(true, 100, 90, 1)).toBeCloseTo(-10);
  });

  it("calcLeverage handles zero collateral", () => {
    expect(calcLeverage(10_000, 2_000)).toBe(5);
    expect(calcLeverage(10_000, 0)).toBe(Infinity);
  });
});

describe("calcEstLiqPrice", () => {
  it("returns 0 when size is zero or already liquidatable", () => {
    expect(
      calcEstLiqPrice({
        isLong: true,
        avgPrice: 100,
        sizeInAsset: 0,
        collateralUsd: 100,
        maintenanceMarginRate: 0.015,
        spotPrice: 100,
        totalFeesUsd: 0,
      }),
    ).toBe(0);

    expect(
      calcEstLiqPrice({
        isLong: true,
        avgPrice: 100,
        sizeInAsset: 1,
        collateralUsd: 1,
        maintenanceMarginRate: 0.015,
        spotPrice: 100,
        totalFeesUsd: 0,
      }),
    ).toBe(0);
  });

  it("estimates long liquidation price below entry when collateral is healthy", () => {
    const liq = calcEstLiqPrice({
      isLong: true,
      avgPrice: 100,
      sizeInAsset: 1,
      collateralUsd: 50,
      maintenanceMarginRate: 0.015,
      spotPrice: 100,
      totalFeesUsd: 0,
    });
    expect(liq).toBeGreaterThan(0);
    expect(liq).toBeLessThan(100);
    expect(liq).toBeCloseTo(51.5, 5);
  });

  it("estimates short liquidation price above entry", () => {
    const liq = calcEstLiqPrice({
      isLong: false,
      avgPrice: 100,
      sizeInAsset: 1,
      collateralUsd: 50,
      maintenanceMarginRate: 0.015,
      spotPrice: 100,
      totalFeesUsd: 0,
    });
    expect(liq).toBeGreaterThan(100);
    expect(liq).toBeCloseTo(148.5, 5);
  });

  it("returns 0 for long when ratio would be >= 1", () => {
    const liq = calcEstLiqPrice({
      isLong: true,
      avgPrice: 100,
      sizeInAsset: 0.01,
      collateralUsd: 10_000,
      maintenanceMarginRate: 0.015,
      spotPrice: 100,
      totalFeesUsd: 0,
    });
    expect(liq).toBe(0);
  });

  it("returns 0 when entry notional is zero (avgPrice zero)", () => {
    expect(
      calcEstLiqPrice({
        isLong: true,
        avgPrice: 0,
        sizeInAsset: 10,
        collateralUsd: 100,
        maintenanceMarginRate: 0.015,
        spotPrice: 100,
        totalFeesUsd: 0,
      }),
    ).toBe(0);
  });

  it("accounts for totalFeesUsd eroding margin", () => {
    const withoutFees = calcEstLiqPrice({
      isLong: true,
      avgPrice: 100,
      sizeInAsset: 1,
      collateralUsd: 50,
      maintenanceMarginRate: 0.015,
      spotPrice: 100,
      totalFeesUsd: 0,
    });
    const withFees = calcEstLiqPrice({
      isLong: true,
      avgPrice: 100,
      sizeInAsset: 1,
      collateralUsd: 50,
      maintenanceMarginRate: 0.015,
      spotPrice: 100,
      totalFeesUsd: 40,
    });
    expect(withFees).toBeGreaterThan(withoutFees);
  });
});

describe("calcEffectiveCollateralUsd", () => {
  it("subtracts borrow + trading fees and funding only when owed", () => {
    // Owes funding: all fees subtracted.
    expect(
      calcEffectiveCollateralUsd({
        grossCollateralUsd: 100,
        borrowFeeUsd: 2,
        fundingSign: true,
        fundingFeeUsd: 3,
        tradingFeeUsd: 1,
      }),
    ).toBeCloseTo(94, 9);

    // Receives funding: funding income is NOT added (matches saturating-subtract path).
    expect(
      calcEffectiveCollateralUsd({
        grossCollateralUsd: 100,
        borrowFeeUsd: 2,
        fundingSign: false,
        fundingFeeUsd: 3,
        tradingFeeUsd: 1,
      }),
    ).toBeCloseTo(97, 9);
  });

  it("subtracts the projected closing fee when reserved and clamps at 0", () => {
    expect(
      calcEffectiveCollateralUsd({
        grossCollateralUsd: 100,
        borrowFeeUsd: 0,
        fundingSign: false,
        fundingFeeUsd: 0,
        tradingFeeUsd: 0,
        projectedTradingFeeUsd: 5,
      }),
    ).toBeCloseTo(95, 9);

    expect(
      calcEffectiveCollateralUsd({
        grossCollateralUsd: 10,
        borrowFeeUsd: 20,
        fundingSign: true,
        fundingFeeUsd: 5,
        tradingFeeUsd: 0,
      }),
    ).toBe(0);
  });
});

describe("calcMaxReducibleCollateralUsd", () => {
  // HYPE/USD long regression: gross $14.96, ~23.3x on gross but the contract sees
  // ~24.9x on effective collateral, so only ~$0.075 is withdrawable before hitting
  // the 25x cap — not the ~$8 a gross-based UI would show. Reproduces the reported
  // 0.0749 limit (current price ~$2 above the $65.877 liq price, so leverage binds,
  // not liquidation). collateralPrice = 1 (USD), so USD == raw amount here.
  it("reproduces the HYPE 25x-leverage-bound limit (~0.0749)", () => {
    // notional 348.6 = size * spot; pick spot $67.88 (~$2 above liq), size 5.135.
    const grossCollateralUsd = 14.96;
    const spotPrice = 67.88;
    const sizeInAsset = 348.6 / spotPrice;
    // ~$0.94 of accrued fees push effective collateral to ~$14.02 (≈24.86x).
    const max = calcMaxReducibleCollateralUsd({
      grossCollateralUsd,
      sizeInAsset,
      spotPrice,
      isLong: true,
      entryPrice: 64, // below spot → position in profit, so liquidation is not the binding wall
      maxLeverage: 25,
      maintenanceMarginRate: 0.01,
      minCollValueUsd: 0,
      borrowFeeUsd: 0.6,
      tradingFeeUsd: 0.34,
      closingFeeUsd: 0.2,
      fundingSign: true,
      fundingFeeUsd: 0,
      collateralPriceUsd: 1,
      collateralDecimal: 6,
    });
    // effLeverage = 14.96 - 0.6 - 0.34 = 14.02; floor = 348.6/25 = 13.944.
    // Leverage (A) binds here, not liquidation, so no one-raw-unit offset applies.
    expect(max).toBeCloseTo(14.02 - 348.6 / 25, 5); // ≈ 0.076
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThan(0.1);
  });

  it("liquidation constraint binds and leaves remaining strictly above maintenance", () => {
    // Long deep in loss: spot just above liq, so (C) is the smallest headroom.
    const collateralDecimal = 6;
    const collateralPriceUsd = 1;
    const params = {
      grossCollateralUsd: 15,
      sizeInAsset: 5,
      spotPrice: 66,
      isLong: true,
      entryPrice: 68, // loss of 5 * 2 = $10
      maxLeverage: 25,
      maintenanceMarginRate: 0.01,
      minCollValueUsd: 0,
      borrowFeeUsd: 0,
      tradingFeeUsd: 0,
      closingFeeUsd: 0.1,
      fundingSign: false,
      fundingFeeUsd: 0,
      collateralPriceUsd,
      collateralDecimal,
    };
    const max = calcMaxReducibleCollateralUsd(params);
    // liqRemaining = 15 - 10 - 0.1 = 4.9; maintenance = 0.01 * 330 = 3.3.
    // inclusive headroom_C = 1.6; leverage headroom = 15 - 330/25 = 1.8 → C binds.
    // The helper backs off one raw unit (1e-6) so the value is just under 1.6.
    const oneRawUnitUsd = collateralPriceUsd / 10 ** collateralDecimal;
    expect(max).toBeCloseTo(1.6 - oneRawUnitUsd, 9);
    expect(max).toBeLessThan(1.6);

    // Converting to a raw tx amount with floor must keep remaining strictly above
    // maintenance (the contract aborts on equality).
    const rawAmount = Math.floor((max / collateralPriceUsd) * 10 ** collateralDecimal);
    const withdrawnUsd = (rawAmount / 10 ** collateralDecimal) * collateralPriceUsd;
    const remainingAfter = 4.9 - withdrawnUsd;
    const maintenanceUsd = 0.01 * 330;
    expect(remainingAfter).toBeGreaterThan(maintenanceUsd);
  });

  it("clamps to 0 when the position is already over the limit", () => {
    const max = calcMaxReducibleCollateralUsd({
      grossCollateralUsd: 10,
      sizeInAsset: 5,
      spotPrice: 67,
      isLong: true,
      entryPrice: 67,
      maxLeverage: 25,
      maintenanceMarginRate: 0.01,
      minCollValueUsd: 0,
      borrowFeeUsd: 0,
      tradingFeeUsd: 0,
      closingFeeUsd: 0,
      fundingSign: false,
      fundingFeeUsd: 0,
      collateralPriceUsd: 1,
      collateralDecimal: 6,
    });
    // notional 335, floor 335/25 = 13.4 > collateral 10 → already over 25x.
    expect(max).toBe(0);
  });

  it("min collateral value can be the binding constraint", () => {
    const max = calcMaxReducibleCollateralUsd({
      grossCollateralUsd: 100,
      sizeInAsset: 1,
      spotPrice: 100, // notional 100, leverage 1x — lots of leverage headroom
      isLong: true,
      entryPrice: 100,
      maxLeverage: 25,
      maintenanceMarginRate: 0.01,
      minCollValueUsd: 95, // can't drop effective collateral below $95
      borrowFeeUsd: 0,
      tradingFeeUsd: 0,
      closingFeeUsd: 0,
      fundingSign: false,
      fundingFeeUsd: 0,
      collateralPriceUsd: 1,
      collateralDecimal: 6,
    });
    expect(max).toBeCloseTo(5, 5);
  });
});

describe("impact and trading fee rate", () => {
  it("calcTotalTradingFeeRate sums base and impact", () => {
    expect(calcTotalTradingFeeRate(0.0003, 0.0001)).toBeCloseTo(0.0004);
  });

  it("calcImpactFeeRate returns 0 when execution price zeroes order notional", () => {
    expect(
      calcImpactFeeRate({
        longOi: 2,
        shortOi: 10,
        orderIsLong: false,
        orderSize: 5,
        executionPrice: 0,
        maxImpactFee: 0.001,
        allocatedLpExposureBps: 10_000,
        poolTvlUsd: 1_000_000,
      }),
    ).toBe(0);
  });

  it("calcImpactFeeRate returns 0 for zero order or max fee", () => {
    expect(
      calcImpactFeeRate({
        longOi: 10,
        shortOi: 5,
        orderIsLong: true,
        orderSize: 0,
        executionPrice: 50_000,
        maxImpactFee: 0.0003,
        allocatedLpExposureBps: 5000,
        poolTvlUsd: 1_000_000,
      }),
    ).toBe(0);

    expect(
      calcImpactFeeRate({
        longOi: 10,
        shortOi: 5,
        orderIsLong: true,
        orderSize: 1,
        executionPrice: 50_000,
        maxImpactFee: 0,
        allocatedLpExposureBps: 5000,
        poolTvlUsd: 1_000_000,
      }),
    ).toBe(0);
  });

  it("calcImpactFeeRate is positive when order increases LP skew", () => {
    const rate = calcImpactFeeRate({
      longOi: 2,
      shortOi: 10,
      orderIsLong: false,
      orderSize: 5,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
      curvature: 1,
      scale: 1,
    });
    expect(rate).toBeGreaterThan(0);
  });

  it("calcImpactFeeRate uses orderSize - lpOriginalSize when same-side order is larger", () => {
    const rate = calcImpactFeeRate({
      longOi: 1,
      shortOi: 11,
      orderIsLong: true,
      orderSize: 25,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
    });
    expect(rate).toBeGreaterThan(0);
  });

  it("calcImpactFeeRate returns 0 when same-side order shrinks LP skew", () => {
    expect(
      calcImpactFeeRate({
        longOi: 5,
        shortOi: 15,
        orderIsLong: true,
        orderSize: 3,
        executionPrice: 100,
        maxImpactFee: 0.001,
        allocatedLpExposureBps: 10_000,
        poolTvlUsd: 1_000_000,
      }),
    ).toBe(0);
  });

  it("calcImpactFeeRate returns 0 when pool TVL or LP exposure cap is zero", () => {
    const base = {
      longOi: 2,
      shortOi: 10,
      orderIsLong: false,
      orderSize: 5,
      executionPrice: 100,
      maxImpactFee: 0.001,
    };
    expect(calcImpactFeeRate({ ...base, allocatedLpExposureBps: 0, poolTvlUsd: 1_000_000 })).toBe(
      0,
    );
    expect(calcImpactFeeRate({ ...base, allocatedLpExposureBps: 10_000, poolTvlUsd: 0 })).toBe(0);
  });

  it("calcImpactFeeRate handles long-heavy OI (lpOriginalSide false)", () => {
    const rate = calcImpactFeeRate({
      longOi: 20,
      shortOi: 5,
      orderIsLong: true,
      orderSize: 8,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
    });
    expect(rate).toBeGreaterThan(0);
  });

  it("calcImpactFeeRate handles balanced OI with zero initial skew", () => {
    const rate = calcImpactFeeRate({
      longOi: 5,
      shortOi: 5,
      orderIsLong: true,
      orderSize: 10,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
    });
    expect(rate).toBeGreaterThan(0);
  });

  it("calcImpactFeeRate respects curvature and scale on the impact curve", () => {
    const linear = calcImpactFeeRate({
      longOi: 1,
      shortOi: 11,
      orderIsLong: true,
      orderSize: 25,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
      curvature: 1,
      scale: 1,
    });
    const steep = calcImpactFeeRate({
      longOi: 1,
      shortOi: 11,
      orderIsLong: true,
      orderSize: 25,
      executionPrice: 100,
      maxImpactFee: 0.001,
      allocatedLpExposureBps: 10_000,
      poolTvlUsd: 1_000_000,
      curvature: 2,
      scale: 0.5,
    });
    expect(linear).toBeGreaterThan(0);
    expect(steep).not.toBe(linear);
  });
});

describe("funding", () => {
  it("calcFundingRate long-heavy vs short-heavy", () => {
    expect(calcFundingRate(0, 0, 0.01, 1_000_000)).toEqual({ sign: true, rate: 0 });
    expect(calcFundingRate(100, 50, 0.01, 0)).toEqual({ sign: true, rate: 0 });
    expect(calcFundingRate(100, 50, 0.01, 1_000_000)).toEqual({
      sign: true,
      rate: (0.01 * 50) / 1_000_000,
    });
    expect(calcFundingRate(50, 100, 0.01, 1_000_000)).toEqual({
      sign: false,
      rate: (0.01 * 50) / 1_000_000,
    });
  });

  it("calcFundingFeeUsd respects payer side", () => {
    expect(calcFundingFeeUsd(1, 0.5, true, true)).toBeCloseTo(0.5);
    expect(calcFundingFeeUsd(1, 0.5, true, false)).toBeCloseTo(-0.5);
    expect(calcFundingFeeUsd(1, 0.5, false, false)).toBeCloseTo(0.5);
  });

  it("decodeFundingIndexDelta converts Double-scale delta", () => {
    const oneUsdPerAsset = DOUBLE_SCALE;
    expect(decodeFundingIndexDelta(oneUsdPerAsset)).toBeCloseTo(1, 10);
    expect(decodeFundingIndexDelta(0n)).toBe(0);
  });

  it("annualizeFundingRate scales per-interval rate to a year", () => {
    const hourly = 0.0001;
    expect(annualizeFundingRate(hourly, 3_600_000)).toBeCloseTo(hourly * (MS_PER_YEAR / 3_600_000));
    expect(annualizeFundingRate(0.001, 0)).toBe(0);
  });
});

describe("WLP APY helpers", () => {
  it("annualizedApyFromRatio compounds NAV ratio over elapsed days", () => {
    expect(annualizedApyFromRatio(1.05, 30)).toBeCloseTo(Math.pow(1.05, 365 / 30) - 1, 10);
    expect(annualizedApyFromRatio(1, 0)).toBe(0);
    expect(annualizedApyFromRatio(0, 30)).toBe(0);
    expect(annualizedApyFromRatio(-1, 30)).toBe(0);
  });

  it("annualizedApyFromRatio returns 0 when compounding overflows", () => {
    expect(annualizedApyFromRatio(Number.MAX_VALUE, 1)).toBe(0);
  });

  it("calcWlpIncentiveApy converts continuous APR to APY", () => {
    expect(calcWlpIncentiveApy(0.12)).toBeCloseTo(Math.expm1(0.12), 10);
    expect(calcWlpIncentiveApy(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("borrow rate curve", () => {
  it("calcBorrowRate follows three slopes", () => {
    expect(calcBorrowRate(1000, 0.001, 0.002, 0.003, 5000, 8000)).toBe(0.001);
    expect(calcBorrowRate(6000, 0.001, 0.003, 0.01, 5000, 8000)).toBeCloseTo(0.002);
    expect(calcBorrowRate(9000, 0.001, 0.003, 0.01, 5000, 8000)).toBeGreaterThan(0.003);
  });

  it("calcBorrowRate interpolates between threshold0 and threshold1", () => {
    expect(calcBorrowRate(5500, 0.001, 0.003, 0.01, 5000, 6000)).toBeCloseTo(0.002);
  });

  it("calcBorrowRate returns rate2 when utilization exceeds threshold1 at 100% cap", () => {
    expect(calcBorrowRate(15_000, 0.001, 0.003, 0.05, 5000, 10_000)).toBe(0.05);
  });

  it("calcBorrowRateAccrual and calcPositionBorrowFee", () => {
    expect(calcBorrowRateAccrual(0, 1000, 1000)).toBe(0);
    expect(calcBorrowRateAccrual(0.001, 3600_000, 3600_000)).toBeCloseTo(0.001);
    expect(calcPositionBorrowFee(1000, 0.01, 0.02)).toBe(0);
    expect(calcPositionBorrowFee(1000, 0.02, 0.01)).toBeCloseTo(10);
  });

  it("calcTokenUtilizationBps", () => {
    expect(calcTokenUtilizationBps(0, 100)).toBe(0);
    expect(calcTokenUtilizationBps(50, 0)).toBe(0);
    expect(calcTokenUtilizationBps(2500, 10_000)).toBe(
      Math.floor((2500 / 10_000) * Number(BPS_SCALE)),
    );
  });
});

describe("WLP math", () => {
  it("calcWlpPrice and bootstrap mint", () => {
    expect(calcWlpPrice(0, 0, 6)).toBe(0);
    expect(calcWlpPrice(1, 1_000_000, 6)).toBeCloseTo(1, 5);
    expect(calcWlpMintOut(100, 0, 0, 6)).toBe(100 * 1_000_000);
  });

  it("calcWlpMintOut pro-rata when pool has supply", () => {
    expect(calcWlpMintOut(100, 1_000_000, 500_000, 6)).toBe(50);
  });

  it("calcWlpMintOut bootstraps when TVL is zero but supply exists", () => {
    expect(calcWlpMintOut(50, 0, 1_000_000, 6)).toBe(50 * 1_000_000);
  });

  it("calcWlpRedeemOut", () => {
    expect(calcWlpRedeemOut(100, 0, 1_000, 1, 6)).toBe(0);
    expect(calcWlpRedeemOut(100, 1_000_000, 0, 1, 6)).toBe(0);
    expect(calcWlpRedeemOut(100, 1_000_000, 1_000_000, 0, 6)).toBe(0);
    expect(calcWlpRedeemOut(100, 1_000_000, 1_000_000, 1, 6)).toBe(100 * 1_000_000);
  });

  it("calcDynamicFeeBps returns base when weight improves", () => {
    const base = 30;
    const improved = calcDynamicFeeBps(400_000, 1_000_000, 50_000, 5000, base, true);
    expect(improved).toBe(base);
  });

  it("calcDynamicFeeBps adds fee when deposit worsens target weight", () => {
    const base = 30;
    const worse = calcDynamicFeeBps(900_000, 1_000_000, 200_000, 5000, base, true);
    expect(worse).toBeGreaterThanOrEqual(base);
  });

  it("calcDynamicFeeBps early exits", () => {
    expect(calcDynamicFeeBps(0, 0, 100, 5000, 30, true)).toBe(30);
    expect(calcDynamicFeeBps(100, 1000, 0, 5000, 30, true)).toBe(30);
    expect(calcDynamicFeeBps(100, 1000, 50, 0, 30, true)).toBe(30);
  });

  it("calcDynamicFeeBps returns base when redeem drains pool TVL", () => {
    expect(calcDynamicFeeBps(900_000, 1_000_000, 1_000_000, 5000, 30, false)).toBe(30);
  });

  it("calcDynamicFeeBps redeem path clamps token value at zero", () => {
    const base = 30;
    const fee = calcDynamicFeeBps(50_000, 100_000, 80_000, 5000, base, false);
    expect(fee).toBeGreaterThanOrEqual(base);
  });

  it("calcDynamicFeeBps returns base when average target value is zero", () => {
    expect(calcDynamicFeeBps(1, 0, 1_000_000, 5000, 25, true)).toBe(25);
  });
});
