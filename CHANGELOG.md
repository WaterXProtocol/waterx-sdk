# Changelog

All notable changes to `@waterx/perp-sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries
reference the PR that introduced them.

## [Unreleased]

### Added

- **Effective-collateral margin math.** Two offline helpers in `utils/math`:
  - `calcEffectiveCollateralUsd(...)` — mirrors `calculate_effective_collateral_amount`
    in `trading.move` (gross − borrow − trading fees − funding-when-owed − optional
    closing fee). This is the collateral the contract actually uses for leverage /
    min-collateral checks; displaying leverage or max-reducible off **gross**
    `collateral_amount` is the long-standing UI bug (a position reads e.g. 23.3x on
    gross while the contract sees ~24.9x on effective).
  - `calcMaxReducibleCollateralUsd(...)` — the true "最大可减少" for an adjust-margin
    UI, taking the min of all three post-withdrawal checks in
    `execute_withdraw_collateral` (max leverage, min collateral, not-liquidatable),
    all on effective collateral. Returns a USD figure; convert to the
    `withdrawCollateralRequest` `amount` via
    `floor((usd / collateralPriceUsd) * 10 ** collateralDecimal)`.

## [2.3.0] - 2026-06-17

### Added

- **Dual-feed transition routing for constant tickers.** A new `waterx_constant_rule.dual_feed`
  list (subset of `prices`) marks tickers mid-migration: `refreshOraclePrices` feeds them via *both*
  `pyth_rule::feed` and `constant_rule::feed` into one collector (new `aggregateTickerWithDual`), so
  the aggregator can hold the `{Pyth, Constant}` weight set without an `EMissingPriceSource` window
  while rule weights are flipped (on-chain `aggregator::remove_outliers` requires every weighted rule
  present in the collector). New `WaterXClient.isDualFeedTicker` / `isConstantOnlyTicker`; dual
  tickers keep the Pyth update, constant-only tickers still skip it. Enables the zero-downtime
  (path A) rollout in the `waterx-contract` USDCUSD runbook. (#46)
- **`getBridgeFee(client, { evmDestinationChain, amount, creditType? })`** — one-shot read of the
  v4 `withdrawal_queue` bridge-fee estimate in a single `simulate`, returning a typed
  `BridgeFeeView` (`feeAmount` / `wouldExecute` / `effectiveRate` / `effectiveMinFee` /
  `netAmount`). Surface "estimated fee" UI off `wouldExecute`, not `feeAmount` alone. (#43)
- **`withdrawal_queue` v4 bindings** — regenerated for the bridge fee + per-chain min-fee floor. (#43, was #40)
- **`waterx_supra_rule` codegen + second-rule feed support.** (#43, was #42)

### Changed

- **Route the `USDCUSD` collateral ticker through `constant_rule` ($1) instead of Pyth** —
  `waterx_constant_rule` codegen plus `aggregateTickerWithConstant` wiring in
  client / config / pyth utils. (#43, was #41)

### Fixed

- **`WaterXClient.isConstantTicker()` now requires the constant rule to be fully wired**
  (`published_at` + `config`) before routing a ticker off Pyth. A half-populated
  `waterx_constant_rule` block (prices listed mid-rollout, before the rule is deployed)
  previously made the ticker skip Pyth and then threw in `aggregateTickerWithConstant`,
  aborting the whole price-refresh PTB; it now falls back to Pyth. Mirrors the keeper's
  all-or-nothing guard. (#43)
