# Changelog

All notable changes to `@waterx/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Entries
reference the PR that introduced them.

## [Unreleased]

### Added

- **`PythLazerRule` — Lazer-generation price updates behind `oracleSource`
  routing.** `pyth_lazer_rule` now resolves to a real `PriceUpdateRule`
  (`src/oracle/rules/pyth-lazer-rule.ts`, exported as `PythLazerRule` +
  `PythLazerUpdatePayload`): it fetches ONE signed `leEcdsa` message for the
  routed tickers' integer Lazer feed ids (`packages.pyth_lazer_rule.feeds`)
  from the Lazer HTTP API (`POST /v1/latest_price`, endpoint from the new
  `LAZER_DEFAULTS` per-network map), authenticated with the new optional
  `pyth.api_key` config field (Lazer is auth-first; a missing key throws
  `LazerApiKeyMissing` at fetch time — the SDK never reads `process.env`), and
  verifies it on-chain ONCE via
  `pyth_lazer::parse_and_verify_le_ecdsa_update(state, clock, bytes)` (no
  update fee; `cache`/`sponsorFund` are Pyth-Core-specific and ignored).
  `buildUpdateCalls` may now return a `RuleUpdateHandle` (exported type)
  carrying the verified `Update` PTB value, and the collector-feed leg is
  rule-aware: each lazer-served ticker's `aggregateTicker` (new optional
  `lazerUpdate` arg) appends `pyth_lazer_rule::feed(collector, config, clock,
  update)` **in addition to** its unchanged `pyth_rule::feed` leg — required
  on-chain while `pyth_rule` stays in the ticker's weighted set
  (`remove_outliers` demands every weighted rule appear in the collector;
  `pyth_rule::feed` abstains on a stale `PriceInfoObject` rather than
  aborting, and an unweighted lazer contribution is silently dropped, so
  dual-registered tickers are safely lazer-routable ahead of the on-chain
  weight migration). `OracleHost` gains a `network` field (already satisfied
  by every client) for the per-network Lazer defaults.
- **`oracleSource` client create option — env-selected oracle rule routing.**
  `WaterXClient.create` / `PerpClient.create` accept a new `oracleSource?:
  OracleSource` option (`'pyth_rule' | 'pyth_lazer_rule'`, default
  `'pyth_rule'`) that selects which `PriceUpdateRule` `refreshOraclePrices`
  uses for the on-chain price-update leg before aggregating. Exposed
  read-only as `OracleHost.oracleSource` / `PerpClient.oracleSource`. Routing
  is driven **solely** by this option — never by a config JSON `enabled`
  flag and never by `process.env` (the SDK never reads it; consumers wire
  the option from their own env var, e.g. `ORACLE_SOURCE`).
  `refreshOraclePrices` groups tickers per rule: the selected rule serves
  every ticker in its `supportedTickers`, tickers it doesn't cover fall back
  to `pyth_rule` when they support it, and a ticker supported by neither is
  skipped from the update leg exactly as before (it's still aggregated via
  whichever rule `aggregateTicker` finds, e.g. `constant_rule`).
- **`PriceUpdateRule` port + `PythCoreRule`.** New strategy port
  (`src/oracle/price-update-rule.ts`, exported types `PriceUpdateRule`,
  `PriceUpdateRuleKind`, `RuleUpdateData`, `BuildUpdateOpts`, `OracleSource`)
  for one oracle rule generation: fetch its off-chain update payload, then
  emit the PTB calls that verify/push it on-chain. `PythCoreRule`
  (`src/oracle/rules/pyth-core-rule.ts`) wraps the existing Pyth Core
  (Hermes VAA) path mechanically — no logic change — and is the only rule
  registered today; a future `PythLazerRule` will register `'pyth_lazer_rule'`.
- **`pyth_lazer_rule` config typing.** `OraclePackages.pyth_lazer_rule?:
  PythLazerRulePackage` mirrors the deployed config JSON's `pyth_lazer_rule`
  entry (`config`, `state`, `enabled?`, `feeds: Record<string, number>`
  integer Lazer feed ids) for lossless round-tripping. Typed only — no SDK
  code reads `enabled` for routing (see `oracleSource` above), and
  `validateConfig` does not require the package.

## [3.1.1] - 2026-07-10

### Added

- **Prediction batch market/position views.** New `src/prediction/fetch.ts`
  helpers expose the on-chain `waterx_prediction::view` batch reads added in
  `waterx-contract#105`, so callers fetch all active exposure in a single
  `simulate`/`devInspect` instead of the N+1 cursor walk
  (`unresolved_market_cursor` → `market_by_key` → …): `getUnresolvedMarkets`
  (full walk, one call) plus paginated `getUnresolvedMarketsPage` /
  `getResolvedMarketsPage` / `getPositionsPage`. Pages take an optional
  `Option<u64>` `start` cursor (omit → from the front of the table) and return
  a `nextCursor` (`null` when exhausted). Adds `PageParams` / `MarketPage` /
  `PositionPage` to `src/prediction/types.ts`; reuses the existing
  `MarketView` / `PositionView` shapes and `mapMarketView` / `mapPositionView`
  mappers, so no new BCS types. Loading all active markets is now **one** RPC
  round-trip instead of N+1: measured read-only against staging (MAINNET) with
  57 unresolved markets, `getUnresolvedMarkets` / `getUnresolvedMarketsPage`
  (`limit=100`) returned in a single call (~0.2–1.6s, RPC-variance dependent)
  versus ~33s for the sequential `unresolved_market_cursor` + 57×
  `market_by_key` walk (58 serial round-trips) — roughly **20–140× faster**,
  and the gap widens as the market/position count grows. (`waterx-contract#105`)

### Changed

- **BREAKING — the config URL is supplied only via the `waterxConfigUrl` option.**
  `loadConfig` (both `perp/config.ts` and `prediction/config.ts`) reads the URL
  solely from `opts.waterxConfigUrl`, fetches it **as-is** (no `<network>.json` /
  git ref appended), and **throws** when unset. There is **no `WATERX_CONFIG_URL`
  env-var fallback and no built-in default** — the SDK never reads `process.env`.
  The load option was **renamed `configUrl` → `waterxConfigUrl`** across
  `loadConfig`, `PerpClient` / `PredictClient` `create` / `testnet` / `mainnet`,
  and `WaterXClient.create` (shared + per-line). The `defaultConfigUrl()` helper
  and the perp `configRef` option (removed in this cycle) stay gone; the
  `CONFIG_URL_ENV` export is also removed. Migrate by passing an explicit
  `waterxConfigUrl` (apps that want env-driven config read `process.env` themselves
  and pass it through, e.g.
  `create("TESTNET", { waterxConfigUrl: process.env.WATERX_CONFIG_URL })`). (#73)

## [3.1.0] - 2026-07-03

### Changed

- **Prediction view decoding now uses the generated codegen schemas directly.**
  `src/prediction/bcs.ts` no longer hand-defines the `*View` BCS structs / enums
  — it re-exports them from `src/generated/waterx_prediction/*` (regenerated by
  `pnpm codegen` from the deployed Move ABI) under the same `*Bcs` names, and
  keeps only the `map*` helpers that translate the raw parse output to the public
  camelCase view types. This removes the hand-written mirror that had silently
  drifted from the contract (cause of the `OrderView` / `RegistryView` bugs
  below); a future ABI change now flows in via codegen instead of needing a
  manual edit. Public surface (`@waterx/sdk/prediction/utils/bcs`,
  `OrderViewBcs`, `mapOrderView`, …) is unchanged. The `getChainOrderView` test
  helper, previously a second hand-written `OrderView` mirror, now delegates to
  `getOrder`. (#69)

### Fixed

- **`deriveGiftAddress` (prediction gift links) now survives a package
  upgrade.** The off-chain `gift_id` derivation built the `GiftKey` type tag
  from `packages.waterx_prediction_gift.published_at`, but Sui pins a struct's
  type identity to its defining package's _original_ id — the on-chain
  `derive_gift_address` always hashes `GiftKey` under that original id, which
  never advances across upgrades. So after the first gift-package upgrade (once
  `published_at` moved off `original_id`), `deriveGiftAddress` computed the
  wrong address for **every** gift — old share links and freshly created ones
  alike — even though on-chain state was fine. The type tag now resolves via a
  new `PredictClient.waterxPredictionGiftTypeOriginId()` (config `original_id`,
  falling back to `published_at` when absent), matching the existing
  `wlpType()` convention; moveCall targets correctly stay on `published_at`. A
  `giftTypeOriginId` override was added to `GiftBaseParams` for offline
  derivation against custom deployments. The share URL/seed was never affected
  (no package id in it). (#72)
- **Dual ESM + CJS exports so CommonJS consumers can `require()` the SDK.** The
  package was published ESM-only — the `exports` map declared only the `import`
  condition — so any `require("@waterx/sdk")` (e.g. a webpack/NestJS backend
  emitting CommonJS) crashed at resolution with `ERR_PACKAGE_PATH_NOT_EXPORTED`,
  even though it type-checked and built. The build now emits a real CommonJS
  output (`tsconfig.cjs.json` → `dist/cjs/`, with a `"type": "commonjs"` marker)
  alongside the ESM one, and every `exports` entry gains `require` + `default`
  conditions — each with its own CJS-flavored `.d.ts` — pointing at it. No public
  subpath or exported symbol changed; the only surface change is the added
  conditions. A `publint` + `@arethetypeswrong/cli` check runs in CI (`pnpm
check:exports`) so an import-only exports map can never ship again. (#71)
- **`getOrder` (prediction) BCS decode** — `OrderViewBcs` was missing the
  `receiver_account_id` field the deployed `view::OrderView` returns (between
  `account_id` and `market_id`), so every `getOrder` call aborted with
  "Offset is outside the bounds of the DataView". Added the field to the BCS
  struct, surfaced it as `OrderView.receiverAccountId`, and mapped it in
  `mapOrderView`. (#68)
- **`getRegistry` (prediction) silent mis-decode** — the deployed
  `view::RegistryView` has a `next_position_id` field (between `next_order_id`
  and `order_count`) that the hand-written `RegistryViewBcs` was missing, so
  `getRegistry` read `orderCount` / `positionCount` / `unresolvedMarketCount` /
  `resolvedMarketCount` from offsets shifted by one and returned wrong values
  without erroring. Fixed by decoding via the generated schema (which has the
  field) and surfaced as `RegistryView.nextPositionId`. (#69)

## [3.0.0] - 2026-06-30

### Added

- **Prediction config `configRef` (#65).** `prediction` `loadConfig` /
  `defaultConfigUrl` / `PredictClient.create` now accept `configRef?: string` to
  pin the canonical `waterx-config` JSON to a specific git ref (commit SHA, branch,
  or tag), reaching parity with the perp line. `configUrl` still takes precedence
  when both are set.
- **Prediction user-side position builders: `requestPartialClose`, `transferPosition`,
  `splitPosition`.** Fills the gap between the on-chain `waterx_prediction` user
  entrypoints and the SDK. `requestPartialClose` peels `closeShares` off a position
  into a new same-account position and runs the close (partial sell) flow on it,
  leaving the remainder `Open`. `transferPosition` moves an open position to another
  WXA account; `splitPosition` splits an open position into two independent positions
  with proportional cost basis for a recipient account. Exposed from
  `@waterx/sdk/prediction` (root, `user`, and `user.position` namespaces), matching
  the existing `requestClose` / `selfCancelClose` shape.

### Changed

- **Predict/perp E2E discovery prefers runnable fixtures over skip.** (#66) Wallet coin
  discovery falls back from settlement `::usd::USD` to MOCK_USDC + PSM deposit path;
  perp custody resolves canonical wxa rows; order/position scans walk recent cursors
  and upgrade to `filledShares >= 2` positions when available. Order reads in e2e/seed
  use a test-only `getChainOrderView` decoder (includes on-chain `receiver_account_id`)
  until the SDK `OrderView` BCS schema catches up in a separate release.

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
    same object. The credit/custody _high-level_ `build*Tx` wrappers
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
    `WaterXClient.create` now emits a `console.warn` in this case so it isn't
    a silent footgun.
- **Internal: shared transport extracted to `BaseLineClient`.** (#55)
  `PerpClient` and `PredictClient` no longer each duplicate the gRPC client
  construction, the read wrappers, `simulate` / `signAndExecuteTransaction`, and
  `packageIds()` — these now live on a shared `BaseLineClient` base; the perp
  config-schema lookups (`getMarket`, `wlpType`, `creditType`, …) move to a
  `PerpConfigView` that `PerpClient` composes. Public surface is unchanged
  (`PerpClient` / `PredictClient` keep all their methods); `PerpClient`'s
  `signAndExecuteTransaction` signature widens additively (now accepts the same
  generic `include` / `additionalSignatures` / `Uint8Array` form as the predict
  line). A new unit guard asserts no grafted builder name collides with a
  sub-client prototype method.
- **Internal: symmetric two-line source layout.** (#55) The perp product line
  moved from the `src/` root into `src/perp/` (`client.ts`, `config.ts`,
  `config-view.ts`, `constants.ts`, `fetch.ts`, `tx-builders.ts`, `index.ts`,
  `user/`), mirroring `src/prediction/`. The root now holds only the umbrella
  (`sdk.ts`, `unified-client.ts`), the shared `base-client.ts`, shared primitive
  `constants.ts`, and the shared `account/` / `utils/` / `core/` / `generated/`
  dirs. Public entry points are unchanged: `@waterx/sdk`, `@waterx/sdk/perp`, and
  `@waterx/sdk/perp/*` resolve as before (the `exports` map now points `./perp`
  at `dist/src/perp/`). Perp-domain enums split into `perp/constants.ts` (which
  re-exports the shared primitives), so `@waterx/sdk/perp/constants` is unchanged.
- **Internal: split the two oversized perp files by domain.** (#55)
  `perp/tx-builders.ts` (992 LOC) and `perp/fetch.ts` (915 LOC) became thin
  barrels over per-domain modules under `perp/tx-builders/`
  (common / consolidate / trading / wlp / rewards / credit) and `perp/fetch/`
  (simulate / market / positions / referral / account / custody / bridge), each
  ≤ ~285 LOC. The barrels re-export the full public surface unchanged
  (`@waterx/sdk/perp/tx-builders`, `@waterx/sdk/perp/fetch`, and the flat
  `@waterx/sdk/perp` namespace resolve as before).

- **Generic wxa builders are now line-agnostic (`WxaClientLike`) — shared by both
  the perp and prediction lines.** The shared `account/` create-account / delegate /
  alias builders were typed to the funding-capable `AccountClientLike`; they only
  need `waterx_account` + `bucket_framework`, so they are retyped to the narrower
  **`WxaClientLike`** (`account/client.ts`), which **both** `PerpClient` and
  `PredictClient` satisfy structurally (CI-enforced by `wxa-capability.test.ts`).
  `AccountConfig` / `AccountPackages` now extend `WxaConfig` / `WxaPackages`.
  The **entire generic wxa account framework** in prediction now **delegates to the
  shared `account/` builders** — `createAccount`, `addDelegate`, `removeDelegate`,
  `requestDeposit`, `requestWithdraw`, `transferCoinToAccount`,
  `requestDepositFromReceivings` (prediction keeps its public wrapper signatures +
  `settlementCoinType` defaulting). Since `waterx_account` is a single shared
  contract, these are the same on-chain calls; verified byte-equivalent by the PTB
  snapshot tests — the only delta is `Result` vs `NestedResult` for the
  sender-request handle on the request-signed ops, which is equivalent for a
  single-return Move call and is the form perp already ships. Only genuinely
  prediction-specific account ops stay line-side: the prediction-protocol permission
  config (`setDelegatePredictionPermission`, `whitelist`/`allow`/`disallow protocol
asset`) and the `direct_rule` same-coin consume helpers (thin wrappers over the
  shared generated `direct_rule`).
- **Account/funding config schema hoisted into `account/config.ts`; `account/`
  now imports nothing from `perp/`.** The account/funding/referral package
  interfaces (`BasePackageEntry`, `WxaAccountPackage`, `WaterxCreditPackage`,
  `NativeCustody*`, `WormholeBridgePackage`, `WithdrawalQueuePackage`,
  `WaterxReferralPackage`, `WormholeInfraConfig`) plus new `AccountPackages` /
  `AccountConfig` types now live in `src/account/config.ts`. `perp/config.ts`
  imports + re-exports them (so `@waterx/sdk/perp` type imports are unchanged) and
  `WaterXPackages extends AccountPackages`. `AccountClientLike` is now typed to
  `AccountConfig`, removing the last type-only `account → perp` edge — the base
  layer is fully decoupled (`PerpClient`'s `WaterXConfig` stays assignable to
  `AccountConfig`). Dependency direction is now strictly `perp → account`.
- **Single `generated/` root; `waterx_prediction` is now reproducible by
  `pnpm codegen`.** The prediction line had its own orphaned `src/prediction/generated/`
  (`waterx_prediction` + duplicate `bucket_v2_framework` / `waterx_account` / codegen
  runtime) that was **not** in `sui-codegen.config.mjs`, so `pnpm codegen` could not
  reproduce it. `waterx_prediction` is now registered in the codegen config +
  summaries script and emitted into the shared `src/generated/`; `src/prediction/`
  imports it from there and `src/prediction/generated/` is deleted. Also dropped a
  duplicate `native_custody` codegen entry and taught `scripts/fix-generated-imports.ts`
  to annotate the `Market` / `MarketView` structs (TS2883, they embed the `Outcome`
  MoveEnum). **Note:** regenerating brought all `generated/` packages up to the current
  contract ABI — this surfaces additive contract features (`pyth_rule` max-confidence-bps
  config, `waterx_account::isAccountOwner`, …) and drops unused `*ForTesting` bucket
  helpers; no SDK code referenced the removed symbols.
- **`account/` is now the real base layer; the prediction→perp dependency edge is
  cut.** The account framework + funding (credit / custody / bridge / consolidate /
  wormhole) previously lived under `perp/` and were typed to the concrete
  `PerpClient`, so `account/index.ts` re-exported **up** into `perp/user/*` and
  `prediction/tx-builders.ts` imported `perp/` for the wxUSD consolidate sweep
  (dependency arrows running backwards). The whole cluster now lives under
  `src/account/` (`account.ts`, `account-request.ts`, `waterx-account.ts`,
  `referral.ts`, `funding/{credit,custody,wormhole,balance,consolidate}.ts`) and is
  retyped to a new **`AccountClientLike`** capability interface (`account/client.ts`)
  that `PerpClient` satisfies structurally — no builder imports `PerpClient`
  anymore. `prediction/tx-builders.ts` imports the sweep from `account/funding/`
  and no longer imports `perp/` at all. The `@waterx/sdk/perp` barrel still surfaces
  all of these builders unchanged — `perp/user/index.ts` and `perp/index.ts` now
  re-export them from `account/` — so the main public entry is identical; only the
  un-advertised granular deep paths (`perp/user/<file>`, `utils/{wormhole,
account-request,consolidate-balance}`) moved. `src/core/waterx-account.ts` folded
  into `account/`. (The config-schema hoist and the single-`generated/`-root
  unification that this entry once deferred are now done — see the entries above.)

- **Oracle / rule code split out of `utils/pyth.ts` into a dedicated `src/oracle/`
  module.** The old `utils/pyth.ts` had fused four concerns into one file (Pyth
  Hermes/update PTB, the `pyth_sponsor_rule` flow, **and** `supra_rule` /
  `constant_rule` feeds via the aggregation orchestrator). It is now decomposed:
  - `oracle/pyth.ts` — Pyth as a price _source_ only (Hermes REST + on-chain
    update PTB + `PythCache`); imports **no** rule package.
  - `oracle/rules/{pyth-rule,supra-rule,constant-rule,sponsor}.ts` — one file per
    oracle rule (Pyth no longer "contains" Supra).
  - `oracle/aggregate.ts` — the single orchestrator that composes rules into a
    collector and aggregates (`aggregateTicker` / `refreshOraclePrices` / …).
  - `oracle/host.ts` — new `OracleHost` structural interface; the oracle code no
    longer depends on the concrete `PerpClient` (which satisfies `OracleHost`
    without an `implements` clause). The public API surface (`refreshOraclePrices`,
    `PythCache`, `openPythSponsorFund`, …) is re-exported unchanged from
    `oracle/index.ts`; only the internal import path moves
    (`utils/pyth.ts` → `oracle/`).
- **Oracle config hoisted into `oracle/config.ts`; the last base→product type
  edge is gone.** (#55) `oracle/host.ts` imported `WaterXConfig` / `PythInfraConfig`
  from `perp/config.ts`, leaving one residual oracle→perp type edge. The oracle-rule
  package schema (`PythRulePackage`, `PythSponsorRulePackage`, `SupraRulePackage`,
  `WaterxConstantRulePackage` + `ConstantFeedEntry` / `SupraFeedEntry`,
  `WaterxOraclePackage`) plus `PythInfraConfig` / `PYTH_DEFAULTS` and the new narrow
  `OracleConfig` / `OraclePackages` now live in `src/oracle/config.ts`.
  `OracleHost.config` is typed to `OracleConfig`, so the oracle layer imports
  **nothing** from `perp/`. `perp/config.ts` imports + re-exports them (so
  `@waterx/sdk/perp` type imports are unchanged) and `WaterXPackages extends
AccountPackages, OraclePackages`.
- **Referral reads consolidated under the `account/` base.** (#55) The referral
  queries (`getRefererFor` / `isValidReferralCode` / `referralCodeExists`) were
  split off from their builders and needlessly typed to `PerpClient` in
  `perp/fetch/referral.ts`. They move to `account/fetch/referral.ts` (co-located
  with the `account/referral.ts` builders) retyped to `WxaClientLike`, and the perp
  `fetch.ts` barrel re-exports them — the `@waterx/sdk` / `@waterx/sdk/perp` surface
  is unchanged. The generic simulate/decode plumbing also moves to the base
  (`account/fetch/simulate.ts`); `perp/fetch/simulate.ts` re-exports it and keeps
  only the perp-only `withLp`. `DRY_RUN_SENDER` (the zero-address simulate sender)
  is hoisted from `perp/constants.ts` to the shared `constants.ts` and re-exported
  for back-compat.

### Added

- **`@waterx/sdk/account` and `@waterx/sdk/oracle` subpath exports.** (#55) The
  shared base layer (account framework + funding + referral) and the oracle module
  are now part of the published surface via `./account`, `./account/*`, `./oracle`,
  and `./oracle/*` package exports.

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
  list (subset of `prices`) marks tickers mid-migration: `refreshOraclePrices` feeds them via _both_
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

| Old import              | New import                                     |
| ----------------------- | ---------------------------------------------- |
| `@waterx/perp-sdk`      | `@waterx/sdk` (flat perp re-export deprecated) |
| `@waterx/perp-sdk/perp` | `@waterx/sdk/perp`                             |
| `@waterx/predict-sdk`   | `@waterx/sdk/prediction`                       |
