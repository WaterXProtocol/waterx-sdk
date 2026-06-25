# Changelog

All notable changes to `@waterx/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries
reference the PR that introduced them.

## [Unreleased]

## [3.0.0] - 2026-06-25

### Changed

- **BREAKING — `WaterXClient` is now the umbrella entry point.** (#55) The class
  previously named `WaterXClient` (the perp product line) is renamed
  **`PerpClient`**; the unified facade previously named `Client` is renamed
  **`WaterXClient`** and is the single main entry. It exposes three namespaces:
  - `client.account` — the shared `waterx_account` framework **plus** funding
    (credit + custody) builders. Backed by the perp sub-client config (which
    carries the shared `AccountRegistry`, bridge, native_custody,
    withdrawal_queue, credit_registry).
  - `client.perp` — **is** the `PerpClient` instance with the perp builders/views
    grafted on (trading / orders / WLP / staking / referral). Signing & config
    methods (`signAndExecuteTransaction`, `simulate`, `getMarket`, …) sit on the
    same object. The credit/custody *high-level* `build*Tx` wrappers
    (`buildRedeemVaaTx`, `buildRequestCreditWithdrawTx`, `buildExecuteWithdrawalTx`)
    remain here; only the low-level credit/custody builders move to `client.account`.
  - `client.predict` — **is** the `PredictClient` instance with the prediction
    builders/views grafted on. Generic account builders (`createAccount`,
    `requestDeposit`/`deposit`, `requestWithdraw`/`withdraw`, delegate add/remove,
    `transferCoinToAccount`, `consume*Direct`, `resolveRegistryAccountId`) are
    dropped from `client.predict`; prediction-specific account ops
    (`setDelegatePredictionPermission`, `whitelistPredictionProtocol`,
    `allow`/`disallowPredictionProtocolAsset`) are kept.
  - There are no longer separate `client.perpClient` / `client.predictClient`
    accessors — `client.perp` / `client.predict` are the clients.
  - `Client` remains as a deprecated alias of `WaterXClient` for one major cycle.
  - **No same-name alias for the old perp `WaterXClient`** — importers of the perp
    client must switch to `PerpClient` (flat at the root or `perp.PerpClient`).
  - **Cross-network caveat:** `client.account` follows the **perp** line; on
    split-network setups (`opts.perp.network !== opts.predict.network`), reach the
    predict line's generic account builders via the `prediction` namespace.

## [2.4.1] - 2026-06-24

### Added

- **Staking permission bitmasks exported.** New `STAKING_PERM_DEPOSIT_STAKE` /
  `STAKING_PERM_REDEEM_STAKE` / `STAKING_PERM_CLAIM_REWARD` / `STAKING_PERM_ALL`
  constants (matching `waterx_staking.move`), re-exported from the package root.
  Lets delegate-scoping callers compose staking permission masks symbolically
  the same way they already can for perp and prediction. (#53)

## [2.4.0] - 2026-06-24

### Changed

- **Rule config schema: `constant_rule` / `supra_rule` now follow `pyth_rule.feeds`.**
  Every oracle-rule package uses a `feeds: { TICKER: { … } }` map of per-ticker
  objects instead of scalar maps. The `waterx_constant_rule` package key is renamed
  to **`constant_rule`** (matching `pyth_rule` / `supra_rule`): `prices` (ticker →
  price string) → `feeds` (ticker → `{ price }`). `supra_rule`: `pairs` (ticker →
  number) → `feeds` (ticker → `{ pair_id, tolerance_ms? }`). New `ConstantFeedEntry`
  / `SupraFeedEntry` exports.
- **Oracle routing unified — one `aggregateTicker`; `dual_feed` flag + the dual
  helper/predicates removed.** A ticker is fed by every rule it is configured for:
  Pyth if it has a `pyth_rule.feeds` entry, Supra when enabled, Constant when it is
  a constant ticker — "feed rule R for ticker T iff T ∈ R.feeds". "Dual-feed"
  (Pyth + Constant) and "constant-only" fall out of membership, so the `dual_feed`
  flag is gone and a constant ticker is dual while it still has a Pyth feed, then
  constant-only once removed from `pyth_rule.feeds`. **Removed** `aggregateTickerWithDual`,
  `WaterXClient.isDualFeedTicker`, `WaterXClient.isConstantOnlyTicker`; added
  `aggregateTicker`. `aggregateTickerWithPyth` / `aggregateTickerWithConstant` stay as
  thin wrappers. **Breaking config-schema + API change** — the `waterx-config` JSON +
  keeper parser must move in lockstep (parser-first). (#51)

### Added

- **`getSpendableCreditBalance`** — read helper returning internal wxUSD slot +
  parked backing assets (same probe as `appendConsolidateToUsd`) plus CREDIT at
  the account address; `totalRaw` matches post-`appendConsolidateForSpend`
  spendable balance. (#49)
- **`appendConsolidateForSpend` / `appendConsolidateAddressCredit`** — pre-sweep
  backing assets (PSM) plus address CREDIT into the internal wxa slot; used by
  async tx-builders when `consolidateToUsd` is enabled (default). (#49)
- **`@waterx/sdk/prediction` `buildPlaceOrderTx` / `buildBatchClaimTx`** — async
  prediction builders with the same optional pre-sweep (requires `WaterXClient` +
  `PredictClient`); unified `Client.buildPredictPlaceOrderTx` /
  `Client.buildPredictBatchClaimTx` wrap both line clients. (#49)
- **`src/utils/consolidate-balance.ts`** — shared probe/rescale helpers used by
  the read path and `appendConsolidateToUsd` (refactored to reuse the probe). (#49)

## [2.3.0] - 2026-06-21

### Added

- **Unified package `@waterx/sdk`.** Renamed from `@waterx/perp-sdk`; publish under the new
  name. Subpath exports: `@waterx/sdk`, `@waterx/sdk/perp`, `@waterx/sdk/prediction`.
  `@waterx/perp-sdk@<=2.2.2` remains on npm — deprecate after publish, do not overwrite.
- **Prediction markets merged in.** Former `@waterx/predict-sdk` API lives at
  `@waterx/sdk/prediction`; unified `Client` facade (`client.perp.*` / `client.predict.*`).
  Includes full `waterx_prediction_gift` / claimable-link runtime (`createGift`,
  `claimShare`, `buildCreateGiftFlow`, `getGift`, …) ported from `@waterx/predict-sdk`.
  Explicit `./prediction/user` and `./prediction/utils` package exports match the
  old `@waterx/predict-sdk/user` and `/utils` subpath contract.
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

### Migration

| Old import | New import |
|------------|------------|
| `@waterx/perp-sdk` | `@waterx/sdk` (flat perp re-export deprecated) |
| `@waterx/perp-sdk/perp` | `@waterx/sdk/perp` |
| `@waterx/predict-sdk` | `@waterx/sdk/prediction` |
