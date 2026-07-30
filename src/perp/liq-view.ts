/**
 * View→raw adapter for the canonical liquidation-price estimate.
 *
 * `calcEstLiqPriceRaw` (`utils/math.ts`) takes the twelve RAW on-chain values
 * the Move view takes, so every consumer that already holds a fetched
 * `PositionDataView` row had to hand-map nine of them 1:1 off the row (the
 * other three are the probe prices + maintenance margin, which the row does not
 * carry) — and hand-carry the price invariant below in prose. That mapping is
 * the SDK's job, so it lives here.
 *
 * ## Why perp-side and not in `utils/math.ts`
 *
 * `PositionDataView` is a perp read type (`perp/fetch/positions.ts`, decoded
 * from the `waterx_perp_view` BCS struct). `utils/` is the shared base that
 * `perp/` imports FROM — pulling a perp view type down into `utils/math.ts`
 * would invert that direction and couple the line-agnostic math to the perp
 * read layer. So the pure math stays in `utils/`, and the adapter that knows
 * the perp row shape sits here, one layer up. Kept out of
 * `perp/fetch/positions.ts` too: that module is transport (build PTB →
 * simulate → decode), this is a pure field mapping with no client.
 */

import { calcEstLiqPriceRaw } from "../utils/math.ts";
import type { PositionDataView } from "./fetch/positions.ts";

/**
 * Probe prices the position row was READ AT — see the invariant on
 * {@link calcEstLiqPriceRawFromView}. Whole-dollar u64, exactly as passed to
 * the `perp/fetch` read (`WholeDollarUsdPrice`), plus the market's maintenance
 * margin, which lives on `MarketData`, not on the position row.
 */
export type EstLiqPriceViewOpts = {
  /** `MarketData.maintenance_margin` — raw 1e9-scaled Float value. */
  maintenanceMarginRaw: bigint;
  /** The SAME `basePriceUsd` passed to the read that produced `position`. */
  basePriceUsd: bigint;
  /** The SAME `collateralPriceUsd` passed to the read that produced `position`. */
  collateralPriceUsd: bigint;
};

/**
 * Estimated liquidation price from a fetched `PositionDataView` row —
 * bit-identical to that row's `est_liq_price`.
 *
 * Maps the row's nine raw fields onto {@link calcEstLiqPriceRaw} (the op-for-op
 * mirror of `view.move::calculate_est_liq_price`) and takes the remaining
 * three — the two probe prices plus the market's maintenance margin — from
 * `opts`. Returns the raw 1e9-scaled u128 price; `0n` = already liquidatable /
 * zero size.
 *
 * ## INVARIANT — the prices must be the ones the row was READ AT
 *
 * `opts.basePriceUsd` / `opts.collateralPriceUsd` MUST be the same whole-dollar
 * values you passed to the `perp/fetch` read that produced `position`
 * (`getPosition`, `getMarketPositions`, `getAccountPositions`, …).
 *
 * `PositionDataView` does NOT carry the probe prices it was computed at, so
 * NOTHING — not this adapter, not the type system — can check this for you.
 * Feed different prices and the row's fee / notional-derived fields were
 * computed against one price while the estimate is computed against another:
 * the result is a plausible-looking number that silently disagrees with
 * `position.est_liq_price`. Thread the prices through from the read call site;
 * never re-fetch or re-guess them here.
 *
 * @throws RangeError via `calcEstLiqPriceRaw` when any raw value is negative or
 *   `collateral_decimal` is outside `[0, 19]`.
 */
export function calcEstLiqPriceRawFromView(
  position: PositionDataView,
  opts: EstLiqPriceViewOpts,
): bigint {
  return calcEstLiqPriceRaw({
    isLong: position.is_long,
    sizeRaw: BigInt(position.size),
    avgPriceRaw: BigInt(position.average_price),
    collateralAmountRaw: BigInt(position.collateral_amount),
    collateralDecimal: position.collateral_decimal,
    basePriceUsd: opts.basePriceUsd,
    collateralPriceUsd: opts.collateralPriceUsd,
    maintenanceMarginRaw: opts.maintenanceMarginRaw,
    // The view pre-combines accrued + unrealized into `borrow_fee` / `funding_fee`
    // — take those, NOT the `unrealized_*` pair, which would UNDER-count:
    // `view.move` sets `borrow_fee = calculate_borrow_fee(cumul) +
    // unrealized_borrow_fee`, and `position.move::calculate_funding_fee` returns
    // the unrealized leg combined with the current period's, so the row's
    // `unrealized_*` fields are strict SUBSETS of the combined pair.
    borrowFeeRaw: BigInt(position.borrow_fee),
    fundingSign: position.funding_fee_positive,
    fundingFeeRaw: BigInt(position.funding_fee),
    tradingFeeRaw: BigInt(position.unrealized_trading_fee),
  });
}
