import { BPS_SCALE, DOUBLE_SCALE, FLOAT_SCALE, MS_PER_YEAR } from "../constants.ts";

// ======== On-chain encoding ========

/**
 * Convert a human-readable USD price to the raw 1e9-scaled `u128` value
 * that on-chain `Float`-typed parameters expect.
 *
 * Use for **tx-build** price args only (`acceptablePrice` / `triggerPrice` /
 * size args). Do NOT use for the view-read params `basePriceUsd` /
 * `collateralPriceUsd` on `perp/fetch` (`getPosition`, `getMarketPositions`,
 * `getOrder`, …) — those take WHOLE-DOLLAR integer USD (the Move view applies
 * `float::from` internally; a 1e9-scaled value inflates pnl/notional-derived
 * fields by 1e9).
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

// ======== Numeric-domain validation (internal) ========

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, got ${value}`);
  }
}

function assertFiniteNonNegative(label: string, value: number): void {
  assertFinite(label, value);
  if (value < 0) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

function assertUnsignedBigInt(label: string, value: bigint): void {
  if (value < 0n) {
    throw new RangeError(`${label} must be >= 0, got ${value}`);
  }
}

/**
 * Accrued-fee inputs for the REAL-model liquidation estimate — see
 * `calcRealLiqNetCostUsd` for the rule and the Move-semantics note.
 *
 * `fundingFeeUsd` is SIGNED, cost-positive: > 0 the position owes funding,
 * < 0 is funding income (a genuine equity credit, applied in full).
 */
export type LiqFeeBundle = {
  borrowFeeUsd: number;
  openFeeUsd: number;
  closingFeeUsd: number;
  /** SIGNED, cost-positive: > 0 owed, < 0 income (credits equity in full). */
  fundingFeeUsd: number;
};

/**
 * Net fee cost (USD) of the REAL liquidation check — a plain SIGNED sum:
 *
 *   netCostUsd = borrowFeeUsd + openFeeUsd + closingFeeUsd + fundingFeeUsd
 *
 * `fundingFeeUsd` is SIGNED cost-positive, and the result MAY BE NEGATIVE
 * when funding income exceeds the other fees. That is deliberate:
 * `position.move::is_liquidatable` credits funding income IN FULL — income
 * first pays down any accumulated deficit, and the remainder is added back to
 * remaining equity — so the linearized equity model is a plain signed sum
 * with no floor. Flooring at 0 here would understate an income-rich
 * position's equity and show a liq price closer to spot than the real check.
 *
 * Three-way Move-semantics relationship (verified against the Move sources
 * 2026-07-30):
 * - the REAL liquidation check, `position.move::is_liquidatable`
 *   (waterx_perp): deducts borrow + open + CLOSING fee and credits funding
 *   income in full (deficit first, remainder back to equity) — exactly this
 *   function's signed sum;
 * - the view estimate, `view.move::calculate_est_liq_price`
 *   (waterx_perp_view): OMITS the closing fee AND floors its fee bundle at 0
 *   (`Float.saturating_sub` — Float is unsigned) — see `calcViewEstLiqFeesUsd`
 *   and the op-exact `calcEstLiqPriceRaw`;
 * - SDK `calcEffectiveCollateralUsd` does NOT credit funding income at all:
 *   it mirrors the withdrawable-collateral checks
 *   (`calculate_effective_collateral_amount` in `trading.move`), not the
 *   liquidation inequality.
 * Do not "fix" any of the three to match another.
 *
 * @throws RangeError when borrow/open/closing fees are not finite `>= 0`
 *   numbers, or `fundingFeeUsd` is not finite.
 */
export function calcRealLiqNetCostUsd(fees: LiqFeeBundle): number {
  assertFiniteNonNegative("fees.borrowFeeUsd", fees.borrowFeeUsd);
  assertFiniteNonNegative("fees.openFeeUsd", fees.openFeeUsd);
  assertFiniteNonNegative("fees.closingFeeUsd", fees.closingFeeUsd);
  assertFinite("fees.fundingFeeUsd", fees.fundingFeeUsd);

  return fees.borrowFeeUsd + fees.openFeeUsd + fees.closingFeeUsd + fees.fundingFeeUsd;
}

/**
 * Fee bundle (USD) of the VIEW estimate `view.move::calculate_est_liq_price`:
 *
 *   viewFeesUsd = max(0, borrowFeeUsd + openFeeUsd + fundingFeeUsd)
 *
 * Mirrors the view's unsigned Float arithmetic: funding income is credited
 * via `Float.saturating_sub`, so the bundle FLOORS AT 0 — income beyond the
 * other fees is discarded by the view. There is deliberately NO
 * `closingFeeUsd` field: the view omits the close-fee term, and this shape
 * makes it structurally impossible to include one. For the REAL liquidation
 * check's semantics use `calcRealLiqNetCostUsd`; for chain-bit-identical
 * output use `calcEstLiqPriceRaw`.
 *
 * @throws RangeError when borrow/open fees are not finite `>= 0` numbers, or
 *   `fundingFeeUsd` is not finite.
 */
export function calcViewEstLiqFeesUsd(fees: {
  borrowFeeUsd: number;
  openFeeUsd: number;
  /** SIGNED, cost-positive: > 0 owed, < 0 income (bundle floors at 0). */
  fundingFeeUsd: number;
}): number {
  assertFiniteNonNegative("fees.borrowFeeUsd", fees.borrowFeeUsd);
  assertFiniteNonNegative("fees.openFeeUsd", fees.openFeeUsd);
  assertFinite("fees.fundingFeeUsd", fees.fundingFeeUsd);

  return Math.max(0, fees.borrowFeeUsd + fees.openFeeUsd + fees.fundingFeeUsd);
}

/**
 * Estimated liquidation price — Number (f64) UI convenience.
 *
 * An approximation for display. The CANONICAL implementation is
 * `calcEstLiqPriceRaw` (BigInt fixed-point, op-for-op mirror of
 * `calculate_est_liq_price` in `waterx_perp_view/sources/view.move`); use that
 * wherever exact parity with the on-chain `est_liq_price` matters.
 *
 * Same linear model as the view:
 *   maintenance = maintenanceMarginRate × (size × spotPrice)   ← uses current notional
 *   ratio       = (collateralUsd − totalFeesUsd − maintenance) / (size × avgPrice)
 *   long:  liq  = avgPrice × (1 − ratio)
 *   short: liq  = avgPrice × (1 + ratio)
 *
 * Returns 0 when the position is already liquidatable or has no size.
 *
 * Fees — pass EITHER:
 * - `fees`: the structured bundle, matching the REAL liquidation check
 *   (`position.move::is_liquidatable`). `totalFeesUsd` is derived via
 *   `calcRealLiqNetCostUsd` — a SIGNED sum including the closing fee, with
 *   funding income credited IN FULL, so a caller structurally cannot omit a
 *   term or mis-handle income. A negative net cost ADDS to the remaining
 *   margin, pushing the estimate FARTHER from spot. Takes precedence when
 *   both are given; or
 * - `totalFeesUsd`: a pre-computed number (back-compat path) — the caller
 *   owns the fee model.
 * NOTE the deliberate model difference vs the on-chain VIEW: the view both
 * floors its fee bundle at 0 and omits the close fee (`calcViewEstLiqFeesUsd`
 * / `calcEstLiqPriceRaw`); the `fees` path here matches the REAL check.
 *
 * @throws RangeError when sizeInAsset / avgPrice / spotPrice / collateralUsd
 *   are not finite `>= 0` numbers, when `maintenanceMarginRate` is not finite
 *   inside `[0, 1]`, or when `totalFeesUsd` is not finite.
 *   (`sizeInAsset === 0` stays a documented domain case returning 0.)
 */
export function calcEstLiqPrice(
  params: {
    isLong: boolean;
    avgPrice: number;
    sizeInAsset: number;
    collateralUsd: number;
    maintenanceMarginRate: number;
    spotPrice: number;
  } & (
    | { totalFeesUsd: number; fees?: LiqFeeBundle }
    | { totalFeesUsd?: number; fees: LiqFeeBundle }
  ),
): number {
  const { isLong, avgPrice, sizeInAsset, collateralUsd, maintenanceMarginRate, spotPrice } = params;
  assertFiniteNonNegative("sizeInAsset", sizeInAsset);
  assertFiniteNonNegative("avgPrice", avgPrice);
  assertFiniteNonNegative("spotPrice", spotPrice);
  assertFiniteNonNegative("collateralUsd", collateralUsd);
  assertFinite("maintenanceMarginRate", maintenanceMarginRate);
  if (maintenanceMarginRate < 0 || maintenanceMarginRate > 1) {
    throw new RangeError(
      `maintenanceMarginRate must be within [0, 1], got ${maintenanceMarginRate}`,
    );
  }
  let totalFeesUsd: number;
  if (params.fees !== undefined) {
    totalFeesUsd = calcRealLiqNetCostUsd(params.fees);
  } else {
    totalFeesUsd = params.totalFeesUsd ?? 0;
    assertFinite("totalFeesUsd", totalFeesUsd);
  }
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

// ======== Move Float mirrors (internal) ========
// `bucket_v2_framework::float` — UNSIGNED u128 fixed-point at 1e9 where every
// operation truncates via integer division. These mirror exactly the ops
// `calcEstLiqPriceRaw` needs. Move's overflow aborts are not mirrored: JS
// BigInt cannot overflow, and an input that would abort on chain has no
// chain-produced value to be compared against.

/** `float::from_fraction(n, m)` — `(n × 1e9) / m`, truncating. */
const floatFromFraction = (n: bigint, m: bigint): bigint => (n * FLOAT_SCALE) / m;

/** `float::mul(a, b)` — `(a × b) / 1e9`, truncating. */
const floatMul = (a: bigint, b: bigint): bigint => (a * b) / FLOAT_SCALE;

/** `float::div(a, b)` — `(a × 1e9) / b`, truncating. */
const floatDiv = (a: bigint, b: bigint): bigint => (a * FLOAT_SCALE) / b;

/**
 * `waterx_perp::math::amount_to_usd(amount, decimal, price)` — the exact
 * two-step composition `from_fraction(amount, 10^decimal).mul(price)`, each
 * step truncating independently (NOT algebraically merged).
 */
const amountToUsdRaw = (amountRaw: bigint, pow10: bigint, priceRaw: bigint): bigint =>
  floatMul(floatFromFraction(amountRaw, pow10), priceRaw);

/**
 * Estimated liquidation price — CANONICAL raw fixed-point implementation.
 *
 * Op-for-op mirror of `calculate_est_liq_price` in
 * `waterx_perp_view/sources/view.move` under `bucket_v2_framework::float`
 * semantics: unsigned 1e9 fixed-point, every `mul` is `(a×b)/1e9` and every
 * `div` is `(a×1e9)/b` with truncating BigInt division at EACH step,
 * including `math::amount_to_usd`'s exact composition, the u64 addition of
 * borrow + open fee BEFORE the USD conversion, and the `saturating_sub`
 * funding credit (the VIEW model: fee bundle floors at 0, close fee omitted).
 * Given the same raw inputs the view receives, the result is bit-identical to
 * the chain's `PositionData.est_liq_price`.
 *
 * The Number `calcEstLiqPrice` is a UI convenience approximation of this
 * canonical form (and its `fees` path models the REAL liquidation check
 * instead of the view — see `calcRealLiqNetCostUsd`).
 *
 * Inputs are the raw on-chain values exactly as the view takes them.
 * Returns the raw 1e9-scaled u128 price; `0n` = already liquidatable /
 * zero size (the view's N/A signal).
 *
 * @throws RangeError when any bigint input is negative or
 *   `collateralDecimal` is not an integer in `[0, 19]` (u64 `10^decimal`).
 */
export function calcEstLiqPriceRaw(params: {
  isLong: boolean;
  /** `PositionData.size` — raw 1e9-scaled Float value. */
  sizeRaw: bigint;
  /** `PositionData.average_price` — raw 1e9-scaled Float value. */
  avgPriceRaw: bigint;
  /** `PositionData.collateral_amount` — raw collateral token units. */
  collateralAmountRaw: bigint;
  /** `PositionData.collateral_decimal`. */
  collateralDecimal: number;
  /** Whole-dollar u64 base price — the exact value passed to the view (pre `float::from`). */
  basePriceUsd: bigint;
  /** Whole-dollar u64 collateral price — the exact value passed to the view (pre `float::from`). */
  collateralPriceUsd: bigint;
  /** `MarketData.maintenance_margin` — raw 1e9-scaled Float value. */
  maintenanceMarginRaw: bigint;
  /** `PositionData.borrow_fee` (accrued + unrealized, pre-combined by the view) — raw collateral units. */
  borrowFeeRaw: bigint;
  /** `PositionData.funding_fee_positive` — true when the position owes funding. */
  fundingSign: boolean;
  /** `PositionData.funding_fee` magnitude — raw collateral units. */
  fundingFeeRaw: bigint;
  /** `PositionData.unrealized_trading_fee` (open fee) — raw collateral units. */
  tradingFeeRaw: bigint;
}): bigint {
  const {
    isLong,
    sizeRaw,
    avgPriceRaw,
    collateralAmountRaw,
    collateralDecimal,
    basePriceUsd,
    collateralPriceUsd,
    maintenanceMarginRaw,
    borrowFeeRaw,
    fundingSign,
    fundingFeeRaw,
    tradingFeeRaw,
  } = params;
  assertUnsignedBigInt("sizeRaw", sizeRaw);
  assertUnsignedBigInt("avgPriceRaw", avgPriceRaw);
  assertUnsignedBigInt("collateralAmountRaw", collateralAmountRaw);
  assertUnsignedBigInt("basePriceUsd", basePriceUsd);
  assertUnsignedBigInt("collateralPriceUsd", collateralPriceUsd);
  assertUnsignedBigInt("maintenanceMarginRaw", maintenanceMarginRaw);
  assertUnsignedBigInt("borrowFeeRaw", borrowFeeRaw);
  assertUnsignedBigInt("fundingFeeRaw", fundingFeeRaw);
  assertUnsignedBigInt("tradingFeeRaw", tradingFeeRaw);
  if (!Number.isInteger(collateralDecimal) || collateralDecimal < 0 || collateralDecimal > 19) {
    throw new RangeError(
      `collateralDecimal must be an integer in [0, 19], got ${collateralDecimal}`,
    );
  }

  // float::from(u64) — whole dollars onto the 1e9 grid (exact, no truncation).
  const basePrice = basePriceUsd * FLOAT_SCALE;
  const collPrice = collateralPriceUsd * FLOAT_SCALE;
  const pow10 = 10n ** BigInt(collateralDecimal); // 10u64.pow(collateral_decimal)

  // let entry_notional = p.size().mul(p.average_price());
  const entryNotional = floatMul(sizeRaw, avgPriceRaw);
  // let collateral_usd = math::amount_to_usd(p.collateral_amount(), dec, collateral_price);
  const collateralUsd = amountToUsdRaw(collateralAmountRaw, pow10, collPrice);
  // let current_notional = p.size().mul(base_price);
  const currentNotional = floatMul(sizeRaw, basePrice);
  // let maintenance = maintenance_margin.mul(current_notional);
  const maintenance = floatMul(maintenanceMarginRaw, currentNotional);

  // let accrued_fees_usd = math::amount_to_usd(borrow_fee + trading_fee, dec, collateral_price);
  // (u64 addition BEFORE the conversion — one from_fraction over the sum)
  const accruedFeesUsd = amountToUsdRaw(borrowFeeRaw + tradingFeeRaw, pow10, collPrice);
  // let funding_fee_usd = math::amount_to_usd(funding_fee, dec, collateral_price);
  const fundingFeeUsd = amountToUsdRaw(fundingFeeRaw, pow10, collPrice);
  // owed → add; income → Float.saturating_sub (unsigned: floors at 0)
  const totalFeesUsd = fundingSign
    ? accruedFeesUsd + fundingFeeUsd
    : accruedFeesUsd < fundingFeeUsd
      ? 0n
      : accruedFeesUsd - fundingFeeUsd;

  // let deductions = total_fees_usd.add(maintenance);
  const deductions = totalFeesUsd + maintenance;
  // if (collateral_usd.lte(deductions) || entry_notional.eq(zero)) return 0
  if (collateralUsd <= deductions || entryNotional === 0n) return 0n;
  // let ratio = collateral_usd.sub(deductions).div(entry_notional);
  const marginRemaining = collateralUsd - deductions;
  const ratio = floatDiv(marginRemaining, entryNotional);

  if (isLong) {
    // if (ratio.gte(one)) return 0; else avg.mul(one.sub(ratio))
    if (ratio >= FLOAT_SCALE) return 0n;
    return floatMul(avgPriceRaw, FLOAT_SCALE - ratio);
  }
  // avg.mul(one.add(ratio))
  return floatMul(avgPriceRaw, FLOAT_SCALE + ratio);
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
 * Continuous proration: `rate × elapsedMs / intervalMs`, matching the formula
 * of `lp_pool.move::calculate_borrow_rate_accrual`
 * (`borrow_rate.mul_u64(elapsed_ms).div_u64(interval_ms)`) — the contract does
 * NOT floor to completed intervals; a partial interval accrues pro rata
 * (verified against the Move source 2026-07-29).
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
