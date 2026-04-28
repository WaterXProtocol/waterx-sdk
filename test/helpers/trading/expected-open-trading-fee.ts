/**
 * Mirrors `waterx_perp::trading::calculate_total_trading_fee_bps` + open-path
 * `math::fee_from_bps` / `math::usd_to_amount` for e2e fee assertions (Bucket Float 1e9).
 */
const PRECISION = 1_000_000_000n;
const BP_SCALE = 10_000n;

/** `market_config::ALLOCATED_LP_EXPOSURE_BPS` */
const ALLOCATED_LP_EXPOSURE_BPS = 2_000n;
/** `market_config::IMPACT_FEE_CURVATURE` */
const IMPACT_FEE_CURVATURE = 2n;
/** `market_config::IMPACT_FEE_SCALE` */
const IMPACT_FEE_SCALE = 1n;

type F = bigint;

function fMul(a: F, b: F): F {
  return (a * b) / PRECISION;
}

function fDiv(a: F, b: F): F {
  if (b === 0n) throw new Error("Float div by zero");
  return (a * PRECISION) / b;
}

function fFromFraction(n: bigint, m: bigint): F {
  if (m === 0n) throw new Error("fromFraction div by zero");
  return (n * PRECISION) / m;
}

function fFromBps(bps: bigint): F {
  return (bps * PRECISION) / BP_SCALE;
}

function fFloor(v: F): bigint {
  return v / PRECISION;
}

function fMin(a: F, b: F): F {
  return a < b ? a : b;
}

function fOne(): F {
  return PRECISION;
}

function fMulU64(a: F, b: bigint): F {
  return a * b;
}

function fDivU64(a: F, b: bigint): F {
  if (b === 0n) throw new Error("div_u64 by zero");
  return a / b;
}

function fPow(b: F, mutE: bigint): F {
  let cur = b;
  let result = fOne();
  let e = mutE;
  while (e > 0n) {
    if (e % 2n === 1n) result = fMul(result, cur);
    cur = fMul(cur, cur);
    e = e / 2n;
  }
  return result;
}

function pow10_u64(d: number): bigint {
  let x = 1n;
  for (let i = 0; i < d; i++) x *= 10n;
  return x;
}

function amountToUsd(amount: bigint, tokenDecimal: number, price: F): F {
  const den = pow10_u64(tokenDecimal);
  return fMul(fFromFraction(amount, den), price);
}

function feeFromBps(notional: F, feeBps: bigint): F {
  return fMul(notional, fFromBps(feeBps));
}

function usdToAmount(usd: F, tokenDecimal: number, price: F): bigint {
  if (price === 0n) return 0n;
  const mult = pow10_u64(tokenDecimal);
  return fFloor(fMulU64(fDiv(usd, price), mult));
}

/**
 * Same control flow as `trading::calculate_impact_fee_bps` (package visibility on-chain).
 */
export function calculateImpactFeeBps(params: {
  tradingFeeBps: bigint;
  longOi: bigint;
  shortOi: bigint;
  poolTvlUsdScaled: F;
  executionPriceScaled: F;
  sizeDecimal: number;
  orderIsLong: boolean;
  orderSize: bigint;
}): bigint {
  const maxImpactFeeBps = params.tradingFeeBps;
  if (maxImpactFeeBps === 0n || params.orderSize === 0n) return 0n;

  let lpOriginalSide: boolean;
  let lpOriginalSize: bigint;
  if (params.longOi > params.shortOi) {
    lpOriginalSide = false;
    lpOriginalSize = params.longOi - params.shortOi;
  } else {
    lpOriginalSide = true;
    lpOriginalSize = params.shortOi - params.longOi;
  }

  let lpNewSize: bigint;
  if (lpOriginalSide === params.orderIsLong) {
    if (lpOriginalSize > params.orderSize) {
      lpNewSize = lpOriginalSize - params.orderSize;
    } else {
      lpNewSize = params.orderSize - lpOriginalSize;
    }
  } else {
    lpNewSize = lpOriginalSize + params.orderSize;
  }

  if (lpNewSize <= lpOriginalSize) return 0n;

  // `pool.pool_tvl_usd().mul_u64(bps).div_u64(bp_scale)` — not `Float.mul` (would wrongly /PRECISION).
  const allocatedExposureUsd = (params.poolTvlUsdScaled * ALLOCATED_LP_EXPOSURE_BPS) / BP_SCALE;
  if (allocatedExposureUsd === 0n) return 0n;

  const exposureChangeUsd = amountToUsd(
    lpNewSize - lpOriginalSize,
    params.sizeDecimal,
    params.executionPriceScaled,
  );

  const scaledRatio = fDivU64(fDiv(exposureChangeUsd, allocatedExposureUsd), IMPACT_FEE_SCALE);
  const normalizedRatio = fMin(fOne(), scaledRatio);
  const p = fPow(normalizedRatio, IMPACT_FEE_CURVATURE);
  return fFloor(fMulU64(p, maxImpactFeeBps));
}

export function calculateTotalTradingFeeBps(params: {
  tradingFeeBps: bigint;
  longOi: bigint;
  shortOi: bigint;
  poolTvlUsdScaled: F;
  executionPriceScaled: F;
  sizeDecimal: number;
  orderIsLong: boolean;
  orderSize: bigint;
}): bigint {
  return (
    params.tradingFeeBps +
    calculateImpactFeeBps({
      tradingFeeBps: params.tradingFeeBps,
      longOi: params.longOi,
      shortOi: params.shortOi,
      poolTvlUsdScaled: params.poolTvlUsdScaled,
      executionPriceScaled: params.executionPriceScaled,
      sizeDecimal: params.sizeDecimal,
      orderIsLong: params.orderIsLong,
      orderSize: params.orderSize,
    })
  );
}

/** Expected `PositionOpened.open_fee_amount` for a fresh open (no prior borrow/funding). */
export function expectedOpenTradingFeeRaw(params: {
  tradingFeeBps: bigint;
  longOi: bigint;
  shortOi: bigint;
  poolTvlUsdScaled: F;
  sizeAmount: bigint;
  sizeDecimal: number;
  orderIsLong: boolean;
  entryPriceScaled: F;
  collateralDecimal: number;
  collateralPriceScaled: F;
}): bigint {
  const totalBps = calculateTotalTradingFeeBps({
    tradingFeeBps: params.tradingFeeBps,
    longOi: params.longOi,
    shortOi: params.shortOi,
    poolTvlUsdScaled: params.poolTvlUsdScaled,
    executionPriceScaled: params.entryPriceScaled,
    sizeDecimal: params.sizeDecimal,
    orderIsLong: params.orderIsLong,
    orderSize: params.sizeAmount,
  });
  const notional = amountToUsd(params.sizeAmount, params.sizeDecimal, params.entryPriceScaled);
  const tradingFeeUsd = feeFromBps(notional, totalBps);
  return usdToAmount(tradingFeeUsd, params.collateralDecimal, params.collateralPriceScaled);
}
