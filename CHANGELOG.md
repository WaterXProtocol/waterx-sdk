# Changelog

All notable changes to `@waterx/perp-sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries
reference the PR that introduced them.

## [Unreleased]

### Added

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
