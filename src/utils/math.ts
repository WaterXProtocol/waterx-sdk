import { BPS_SCALE, DOUBLE_SCALE, FLOAT_SCALE, MS_PER_YEAR } from "../constants.ts";

// ======== On-chain encoding ========

/**
 * Convert a human-readable USD price to the raw 1e9-scaled `u128` value
 * that on-chain `Float`-typed parameters expect.
 */
export function rawPrice(usd: number | string): bigint {
  const n = typeof usd === "string" ? Number(usd) : usd;
  if (!Number.isFinite(n)) throw new Error(`Invalid USD price: ${usd}`);
  return BigInt(Math.round(n * Number(FLOAT_SCALE)));
}

// ======== Basic position math ========

/** Notional value in USD: sizeInAsset × price. */
export function calcNotional(sizeInAsset: number, price: number): number {
  return sizeInAsset * price;
}

/** Trading fee in USD: notional × feeRate. */
export function calcFee(sizeUsd: number, feeRate: number): number {
  return sizeUsd * feeRate;
}

/** Unrealized perp Pnl in USD (before fees). */
export function calcUnrealizedPnl(
  isLong: boolean,
  entryPrice: number,
  spotPrice: number,
  sizeInAsset: number,
): number {
  return (isLong ? 1 : -1) * sizeInAsset * (spotPrice - entryPrice);
}

/** Position leverage = notional / collateralUsd. Returns Infinity when collateral is zero. */
export function calcLeverage(sizeUsd: number, collateralUsd: number): number {
  if (collateralUsd === 0) return Infinity;
  return sizeUsd / collateralUsd;
}

/**
 * Estimated liquidation price.
 *
 * Matches `calculate_est_liq_price` in `waterx_perp_view/sources/view.move`:
 *   maintenance = maintenanceMarginRate × (size × spotPrice)   ← uses current notional
 *   ratio       = (collateralUsd − totalFeesUsd − maintenance) / (size × avgPrice)
 *   long:  liq  = avgPrice × (1 − ratio)
 *   short: liq  = avgPrice × (1 + ratio)
 *
 * Returns 0 when the position is already liquidatable or has no size.
 *
 * @param totalFeesUsd  Sum of all accrued fees in USD: borrow + trading + net funding.
 */
export function calcEstLiqPrice(params: {
  isLong: boolean;
  avgPrice: number;
  sizeInAsset: number;
  collateralUsd: number;
  maintenanceMarginRate: number;
  spotPrice: number;
  totalFeesUsd: number;
}): number {
  const {
    isLong,
    avgPrice,
    sizeInAsset,
    collateralUsd,
    maintenanceMarginRate,
    spotPrice,
    totalFeesUsd,
  } = params;
  if (sizeInAsset === 0) return 0;

  const entryNotional = sizeInAsset * avgPrice;
  const maintenance = maintenanceMarginRate * sizeInAsset * spotPrice;
  const marginRemaining = collateralUsd - totalFeesUsd - maintenance;

  if (marginRemaining <= 0 || entryNotional === 0) return 0;

  const ratio = marginRemaining / entryNotional;
  if (isLong) {
    if (ratio >= 1) return 0;
    return avgPrice * (1 - ratio);
  }
  return avgPrice * (1 + ratio);
}

/**
 * Effective (fee-adjusted) collateral in USD.
 *
 * Mirrors `calculate_effective_collateral_amount` in `trading.move`: the contract
 * subtracts accrued borrow + trading fees and, **only when the position owes funding**
 * (`fundingSign === true`, i.e. `unrealized_funding_sign`), the funding fee too. Funding
 * *income* (position receives funding, `fundingSign === false`) is NOT added here —
 * matching the contract's saturating-subtract path. Result clamps at 0.
 *
 * This is the collateral the contract actually uses for the max-leverage and
 * min-collateral checks on `withdraw_collateral` — NOT the gross `collateral_amount`.
 * Displaying leverage / max-reducible off gross collateral is the common UI bug
 * (a position shows e.g. 23.3x on gross while the contract sees ~24.9x on effective).
 *
 * All inputs are human-readable USD. Convert raw collateral-token fee fields via
 * `feeUsd = (rawFee / 10 ** collateralDecimal) * collateralPriceUsd`.
 *
 * @param grossCollateralUsd      Position collateral in USD (`collateral_amount` → USD).
 * @param borrowFeeUsd            `unrealized_borrow_fee` in USD.
 * @param fundingSign             `unrealized_funding_sign` — true when the position owes funding.
 * @param fundingFeeUsd           `unrealized_funding_fee` magnitude in USD.
 * @param tradingFeeUsd           `unrealized_trading_fee` in USD.
 * @param projectedTradingFeeUsd  Closing fee to reserve (0 for a bare collateral withdrawal).
 */
export function calcEffectiveCollateralUsd(params: {
  grossCollateralUsd: number;
  borrowFeeUsd: number;
  fundingSign: boolean;
  fundingFeeUsd: number;
  tradingFeeUsd: number;
  projectedTradingFeeUsd?: number;
}): number {
  const {
    grossCollateralUsd,
    borrowFeeUsd,
    fundingSign,
    fundingFeeUsd,
    tradingFeeUsd,
    projectedTradingFeeUsd = 0,
  } = params;
  const eff =
    grossCollateralUsd -
    borrowFeeUsd -
    tradingFeeUsd -
    projectedTradingFeeUsd -
    (fundingSign ? fundingFeeUsd : 0);
  return Math.max(0, eff);
}

/**
 * Maximum collateral (in USD) a position can safely withdraw ("最大可减少").
 *
 * Reproduces the three post-withdrawal checks in `execute_withdraw_collateral`
 * (`trading.move`), all evaluated on **effective** (fee-adjusted) collateral, and
 * returns the smallest allowed withdrawal:
 *
 *   (A) max leverage — `notional / (effLeverage − w) ≤ maxLeverage`
 *   (B) min collateral — `(effLeverage − w) ≥ minCollValueUsd`
 *   (C) not liquidatable — `(liqRemaining − w) > maintenanceMargin × notional`
 *
 * where
 *   notional      = sizeInAsset × spotPrice
 *   effLeverage   = effective collateral with projectedTradingFee = 0
 *                   (the contract's leverage/min-coll checks ignore the closing fee and PnL)
 *   liqRemaining  = grossCollateralUsd + signedPnl − borrow − trading − closingFee ∓ funding
 *                   (the contract's `is_liquidatable` boundary; funding income is added back)
 *
 * The result is a USD figure (matching the "$X" the UI shows), already aligned so that
 * converting it to raw collateral units with floor is abort-safe:
 *   `rawAmount = floor((maxReducibleUsd / collateralPriceUsd) * 10 ** collateralDecimal)`.
 * The liquidation leg backs off one raw collateral unit because `is_liquidatable` aborts
 * on `remaining <= maintenance` (inclusive) — the safe withdrawal must leave remaining
 * *strictly* above maintenance. The leverage (`> max`) and min-collateral (`>=`) checks
 * are equality-safe on their own and floor-rounding only adds margin, so they need no offset.
 *
 * Funding handling is signed (income added, expense subtracted) — a close approximation
 * of the contract's deficit-aware sequencing, exact whenever the position is solvent
 * (the only case where a withdrawal can succeed). Clamps at 0.
 *
 * @param maxLeverage             Max leverage as a ratio (e.g. 25 for `max_leverage_bps` 250000).
 * @param maintenanceMarginRate   `maintenance_margin` as a fraction (e.g. 0.01 for 1%).
 * @param minCollValueUsd         `min_coll_value` in USD (raw scaled value ÷ 1e9).
 * @param closingFeeUsd           Full closing fee in USD (`close_fee` → USD).
 * @param collateralPriceUsd      Oracle price of the collateral token (USD per token).
 * @param collateralDecimal       Collateral token decimals — sets the smallest withdraw step.
 */
export function calcMaxReducibleCollateralUsd(params: {
  grossCollateralUsd: number;
  sizeInAsset: number;
  spotPrice: number;
  isLong: boolean;
  entryPrice: number;
  maxLeverage: number;
  maintenanceMarginRate: number;
  minCollValueUsd: number;
  borrowFeeUsd: number;
  tradingFeeUsd: number;
  closingFeeUsd: number;
  fundingSign: boolean;
  fundingFeeUsd: number;
  collateralPriceUsd: number;
  collateralDecimal: number;
}): number {
  const {
    grossCollateralUsd,
    sizeInAsset,
    spotPrice,
    isLong,
    entryPrice,
    maxLeverage,
    maintenanceMarginRate,
    minCollValueUsd,
    borrowFeeUsd,
    tradingFeeUsd,
    closingFeeUsd,
    fundingSign,
    fundingFeeUsd,
    collateralPriceUsd,
    collateralDecimal,
  } = params;

  const notional = sizeInAsset * spotPrice;

  // effLeverage: matches calculate_effective_collateral_amount(..., projectedTradingFee = 0).
  const effLeverage = calcEffectiveCollateralUsd({
    grossCollateralUsd,
    borrowFeeUsd,
    fundingSign,
    fundingFeeUsd,
    tradingFeeUsd,
  });

  // (A) max leverage and (B) min collateral, both bounded by effLeverage. Both checks
  // pass at equality (`leverage_bps > max` / `collateral >= min`), so no offset needed.
  const leverageHeadroom = maxLeverage > 0 ? effLeverage - notional / maxLeverage : effLeverage;
  const minCollHeadroom = effLeverage - minCollValueUsd;

  // (C) is_liquidatable: aborts on `remaining <= maintenance`, so the post-withdrawal
  // remaining must stay STRICTLY above maintenance. Back off one raw collateral unit (the
  // smallest withdrawable step) so the floored raw amount can never land on equality.
  const signedPnl = calcUnrealizedPnl(isLong, entryPrice, spotPrice, sizeInAsset);
  const liqRemaining =
    grossCollateralUsd +
    signedPnl -
    borrowFeeUsd -
    tradingFeeUsd -
    closingFeeUsd -
    (fundingSign ? fundingFeeUsd : -fundingFeeUsd);
  const maintenanceUsd = maintenanceMarginRate * notional;
  const oneRawUnitUsd = collateralPriceUsd > 0 ? collateralPriceUsd / 10 ** collateralDecimal : 0;
  const liquidationHeadroom = liqRemaining - maintenanceUsd - oneRawUnitUsd;

  return Math.max(0, Math.min(leverageHeadroom, minCollHeadroom, liquidationHeadroom));
}

// ======== Impact fee ========

/**
 * Cost integral used by the impact fee curve (internal helper).
 * Matches `impact_fee_cost_usd` in `trading.move`.
 */
function impactFeeCostUsd(
  maxImpactFee: number,
  allocatedExposureUsd: number,
  exposureUsd: number,
  curvature: number,
  scale: number,
): number {
  if (exposureUsd === 0) return 0;
  const scaledRatio = Math.min(1, exposureUsd / (allocatedExposureUsd * scale));
  return exposureUsd * Math.pow(scaledRatio, curvature) * maxImpactFee;
}

/**
 * Impact fee rate for an order (as a fraction, not bps).
 *
 * Matches `calculate_impact_fee` in `trading.move`. Returns 0 when the order
 * reduces LP risk (new LP exposure ≤ original). Caller adds this to the base
 * trading fee rate to get the total fee rate.
 *
 * @param longOi                Current long open interest in base tokens.
 * @param shortOi               Current short open interest in base tokens.
 * @param orderIsLong           Direction of the order.
 * @param orderSize             Size of the order in base tokens.
 * @param executionPrice        Execution price (USD per base token).
 * @param maxImpactFee          Max impact fee rate (e.g. 0.0003).
 * @param allocatedLpExposureBps Bps of pool TVL allocated as LP exposure cap.
 * @param poolTvlUsd            Total pool TVL in USD.
 * @param curvature             Impact fee curve curvature exponent (default 1).
 * @param scale                 Impact fee curve scale (default 1).
 */
export function calcImpactFeeRate(params: {
  longOi: number;
  shortOi: number;
  orderIsLong: boolean;
  orderSize: number;
  executionPrice: number;
  maxImpactFee: number;
  allocatedLpExposureBps: number;
  poolTvlUsd: number;
  curvature?: number;
  scale?: number;
}): number {
  const {
    longOi,
    shortOi,
    orderIsLong,
    orderSize,
    executionPrice,
    maxImpactFee,
    allocatedLpExposureBps,
    poolTvlUsd,
    curvature = 1,
    scale = 1,
  } = params;

  if (maxImpactFee === 0 || orderSize === 0) return 0;

  const lpOriginalSide = longOi > shortOi ? false : true;
  const lpOriginalSize = Math.abs(longOi - shortOi);

  const lpNewSize =
    lpOriginalSide === orderIsLong
      ? lpOriginalSize > orderSize
        ? lpOriginalSize - orderSize
        : orderSize - lpOriginalSize
      : lpOriginalSize + orderSize;

  if (lpNewSize <= lpOriginalSize) return 0;

  if (allocatedLpExposureBps === 0 || poolTvlUsd === 0) return 0;
  const allocatedExposureUsd = (poolTvlUsd * allocatedLpExposureBps) / Number(BPS_SCALE);
  if (allocatedExposureUsd === 0) return 0;

  const originalExposureUsd = lpOriginalSize * executionPrice;
  const newExposureUsd = lpNewSize * executionPrice;
  if (newExposureUsd <= originalExposureUsd) return 0;

  const orderNotionalUsd = orderSize * executionPrice;
  if (orderNotionalUsd === 0) return 0;

  const originalCost = impactFeeCostUsd(
    maxImpactFee,
    allocatedExposureUsd,
    originalExposureUsd,
    curvature,
    scale,
  );
  const newCost = impactFeeCostUsd(
    maxImpactFee,
    allocatedExposureUsd,
    newExposureUsd,
    curvature,
    scale,
  );

  return (newCost - originalCost) / orderNotionalUsd;
}

/** Total trading fee rate = base fee + impact fee. */
export function calcTotalTradingFeeRate(baseFeeRate: number, impactFeeRate: number): number {
  return baseFeeRate + impactFeeRate;
}

// ======== Funding rate ========

/**
 * Per-interval funding rate for a market.
 *
 * Matches `calculate_funding_rate` in `market_config.move`.
 * OI values must be in USD (multiply raw OI by base price before calling).
 *
 * @returns `{ sign, rate }` where sign=true means longs pay shorts.
 */
export function calcFundingRate(
  longOiUsd: number,
  shortOiUsd: number,
  basicRate: number,
  tvlUsd: number,
): { sign: boolean; rate: number } {
  if ((longOiUsd === 0 && shortOiUsd === 0) || tvlUsd === 0) return { sign: true, rate: 0 };

  if (longOiUsd >= shortOiUsd) {
    return { sign: true, rate: (basicRate * (longOiUsd - shortOiUsd)) / tvlUsd };
  }
  return { sign: false, rate: (basicRate * (shortOiUsd - longOiUsd)) / tvlUsd };
}

/**
 * Funding fee in USD for a position over a period.
 *
 * Simplified from `calculate_funding_fee` in `position.move` for off-chain estimation.
 * For exact on-chain accounting use the Double-precision index from `position.move`.
 *
 * @param sizeInAsset        Position size in base tokens.
 * @param deltaIndexUsdPerAsset  Change in cumulative funding index (USD per base token).
 * @param positionIsLong     Position direction.
 * @param fundingSignIsLong  True if the current funding interval charges longs.
 */
export function calcFundingFeeUsd(
  sizeInAsset: number,
  deltaIndexUsdPerAsset: number,
  positionIsLong: boolean,
  fundingSignIsLong: boolean,
): number {
  const fee = sizeInAsset * Math.abs(deltaIndexUsdPerAsset);
  const shouldPay = positionIsLong ? fundingSignIsLong : !fundingSignIsLong;
  return shouldPay ? fee : -fee; // positive = cost to position, negative = receipt
}

/**
 * Decode raw Double-precision cumulative funding index delta into USD per base token.
 *
 * Raw index values from on-chain use Double scale (1e18). This converts them to
 * human-readable form (USD per base token) so they can be passed to `calcFundingFeeUsd`.
 */
export function decodeFundingIndexDelta(rawDelta: bigint): number {
  return Number((rawDelta * FLOAT_SCALE) / DOUBLE_SCALE) / Number(FLOAT_SCALE);
}

// ======== Borrow rate ========

/**
 * Per-interval borrow rate using the 3-slope utilization curve.
 *
 * Matches `calculate_borrow_rate` in `lp_pool.move`.
 * Rates are Float values (e.g. 0.000001 per interval).
 */
export function calcBorrowRate(
  utilizationBps: number,
  rate0: number,
  rate1: number,
  rate2: number,
  threshold0Bps: number,
  threshold1Bps: number,
): number {
  if (utilizationBps <= threshold0Bps) return rate0;
  if (utilizationBps <= threshold1Bps) {
    if (threshold1Bps === threshold0Bps) return rate1;
    return (
      rate0 + ((rate1 - rate0) * (utilizationBps - threshold0Bps)) / (threshold1Bps - threshold0Bps)
    );
  }
  const remaining = Number(BPS_SCALE) - threshold1Bps;
  if (remaining === 0) return rate2;
  return rate1 + ((rate2 - rate1) * (utilizationBps - threshold1Bps)) / remaining;
}

/**
 * Time-weighted borrow rate accrual for a given elapsed period.
 *
 * Matches `calculate_borrow_rate_accrual` in `lp_pool.move`.
 * `elapsedMs / intervalMs` gives the number of completed intervals.
 */
export function calcBorrowRateAccrual(
  borrowRate: number,
  elapsedMs: number,
  intervalMs: number,
): number {
  if (borrowRate === 0 || elapsedMs === 0 || intervalMs === 0) return 0;
  return (borrowRate * elapsedMs) / intervalMs;
}

/**
 * Unrealized borrow fee delta for a position (in raw collateral token units).
 *
 * Matches `calculate_borrow_fee` in `position.move`.
 * Returns 0 when cumulative rate has not advanced past the entry index.
 *
 * @param borrowReserveAmount   Position's borrow reserve in raw collateral units.
 * @param cumulativeBorrowRate  Current cumulative borrow rate (Float).
 * @param entryBorrowIndex      Cumulative borrow rate at position entry (Float).
 */
export function calcPositionBorrowFee(
  borrowReserveAmount: number,
  cumulativeBorrowRate: number,
  entryBorrowIndex: number,
): number {
  if (cumulativeBorrowRate <= entryBorrowIndex) return 0;
  return (cumulativeBorrowRate - entryBorrowIndex) * borrowReserveAmount;
}

/** Token utilization in bps: reservedAmount / liquidityAmount × BPS_SCALE. */
export function calcTokenUtilizationBps(reservedAmount: number, liquidityAmount: number): number {
  if (liquidityAmount === 0) return 0;
  return Math.floor((reservedAmount / liquidityAmount) * Number(BPS_SCALE));
}

// ======== Funding annualization ========

/**
 * Annualize a per-interval funding rate.
 *
 * @param rate        Per-interval funding rate (e.g. from `calcFundingRate`).
 * @param intervalMs  Funding interval in milliseconds (e.g. 3_600_000 for 1H).
 */
export function annualizeFundingRate(rate: number, intervalMs: number): number {
  if (intervalMs === 0) return 0;
  return rate * (MS_PER_YEAR / intervalMs);
}

// ======== WLP APY ========

/**
 * Annualized APY from a NAV ratio over a given number of days.
 *
 * Compounds `ratio` (WLP price now / WLP price past) to a 365-day return.
 * Returns 0 when the result is not finite (e.g. ratio ≤ 0 or days = 0).
 *
 * @param ratio  Current NAV divided by past NAV (e.g. 1.05 for 5% growth).
 * @param days   Number of days elapsed between the two NAV samples.
 */
export function annualizedApyFromRatio(ratio: number, days: number): number {
  if (days === 0 || ratio <= 0) return 0;
  const apy = Math.pow(ratio, 365 / days) - 1;
  return Number.isFinite(apy) ? apy : 0;
}

/**
 * Convert a continuously-compounded incentive APR to APY.
 *
 * Rewards stream via `flow_rate` (continuous compounding), so APY = e^APR − 1.
 * Returns 0 when the result is not finite.
 *
 * @param apr  Time-weighted incentive APR as a decimal fraction (e.g. 0.12 for 12%).
 */
export function calcWlpIncentiveApy(apr: number): number {
  const apy = Math.expm1(apr);
  return Number.isFinite(apy) ? apy : 0;
}

// ======== WLP ========

/**
 * WLP share price in USD.
 *
 * @param tvlUsd      Total pool TVL in USD (AUM equity).
 * @param totalSupply Total WLP supply (in raw LP token units).
 * @param lpDecimals  WLP token decimals (6).
 */
export function calcWlpPrice(tvlUsd: number, totalSupply: number, lpDecimals: number): number {
  if (totalSupply === 0) return 0;
  return (tvlUsd * Math.pow(10, lpDecimals)) / totalSupply;
}

/**
 * WLP tokens minted for a deposit (post-fee net deposit).
 *
 * Matches the LP-amount formula in `mint_wlp_with_pricing_tvl` in `lp_pool.move`.
 * Pass `netDepositUsd` (after the dynamic mint fee is deducted).
 * Bootstrap path (totalSupply === 0): lpAmount = netDepositUsd × 10^lpDecimals.
 *
 * @param netDepositUsd  Deposit value in USD after dynamic mint fee.
 * @param tvlUsd         Pool TVL in USD at pricing time.
 * @param totalSupply    Current total WLP supply in raw units.
 * @param lpDecimals     WLP token decimals (6).
 */
export function calcWlpMintOut(
  netDepositUsd: number,
  tvlUsd: number,
  totalSupply: number,
  lpDecimals: number,
): number {
  const scale = Math.pow(10, lpDecimals);
  if (totalSupply === 0 || tvlUsd === 0) return Math.floor(netDepositUsd * scale);
  return Math.floor((netDepositUsd * totalSupply) / tvlUsd);
}

/**
 * Raw token amount redeemable for a given LP amount (before burn fee).
 *
 * Matches the settlement formula in `settle_redeem_with_pricing_tvl` in `lp_pool.move`.
 * Apply `calcDynamicFeeBps` separately to get the net output.
 *
 * @param lpAmount       LP tokens being redeemed (raw units).
 * @param tvlUsd         Pool TVL in USD at pricing time.
 * @param totalSupply    Current total WLP supply in raw units.
 * @param tokenPriceUsd  Oracle price of the output token.
 * @param tokenDecimals  Output token decimals.
 */
export function calcWlpRedeemOut(
  lpAmount: number,
  tvlUsd: number,
  totalSupply: number,
  tokenPriceUsd: number,
  tokenDecimals: number,
): number {
  if (totalSupply === 0 || tokenPriceUsd === 0) return 0;
  const burnValueUsd = (tvlUsd * lpAmount) / totalSupply;
  return Math.floor((burnValueUsd / tokenPriceUsd) * Math.pow(10, tokenDecimals));
}

/**
 * Dynamic mint/burn fee in bps based on weight deviation.
 *
 * Matches `calculate_dynamic_fee` in `lp_pool.move`. Returns `baseFeeBps` when
 * the operation moves the token closer to (or does not worsen) its target weight.
 * Adds an additional fee proportional to the average deviation when it moves
 * further away.
 *
 * @param tokenValueUsd      Current USD value of this token in the pool.
 * @param tvlUsd             Total pool TVL in USD.
 * @param operationValueUsd  USD value of the deposit or withdrawal.
 * @param targetWeightBps    Target allocation weight for this token (bps).
 * @param baseFeeBps         Base mint/burn fee (bps).
 * @param isDeposit          True for mint, false for redeem.
 */
export function calcDynamicFeeBps(
  tokenValueUsd: number,
  tvlUsd: number,
  operationValueUsd: number,
  targetWeightBps: number,
  baseFeeBps: number,
  isDeposit: boolean,
): number {
  if (tvlUsd === 0 || operationValueUsd === 0 || targetWeightBps === 0) return baseFeeBps;

  const targetValue = (tvlUsd * targetWeightBps) / Number(BPS_SCALE);
  const originalDiff = Math.abs(tokenValueUsd - targetValue);

  const newTokenValue = isDeposit
    ? tokenValueUsd + operationValueUsd
    : Math.max(0, tokenValueUsd - operationValueUsd);
  const newTvl = isDeposit ? tvlUsd + operationValueUsd : Math.max(0, tvlUsd - operationValueUsd);

  if (newTvl === 0) return baseFeeBps;

  const newTargetValue = (newTvl * targetWeightBps) / Number(BPS_SCALE);
  const newDiff = Math.abs(newTokenValue - newTargetValue);

  if (newDiff <= originalDiff) return baseFeeBps;

  const avgDiff = (originalDiff + newDiff) / 2;
  const avgTargetValue = (targetValue + newTargetValue) / 2;
  if (avgTargetValue === 0) return baseFeeBps;

  const additional = Math.floor((avgDiff / avgTargetValue) * baseFeeBps);
  return baseFeeBps + additional;
}
