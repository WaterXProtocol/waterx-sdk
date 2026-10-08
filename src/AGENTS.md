# src/ — layout and invariants

Read before changing anything under `src/`. The root `AGENTS.md` holds the repo-wide rules; this file
holds what the folders own and the invariants between them. Each file's own header comment is the
authority for its exports — this file does not restate them.

## Shape

A thin shared root holds the umbrella and cross-cutting infra; each product line is a self-contained
folder, `perp/` mirroring `prediction/`:

```
src/
  sdk.ts             package root (`.` export) — umbrella + flat perp surface + namespaces
  unified-client.ts  WaterXClient umbrella (account / perp / predict); `create(opts)` / `fromClients(perp, predict)`
  base-client.ts     BaseLineClient — transport both line clients extend (gRPC, read wrappers, simulate, signAndExecute, packageIds, config)
  config.ts          THE loader: loadConfig (retry + last-known-good, cache keyed network:url), parseConfigDocument,
                     assertRequiredPackages / REQUIRED_PACKAGES, clearConfigCache, the WaterXConfig types — both lines
  config-url.ts      waterxConfigUrlFromRoot (CDN root + network → document URL; throws on the old full-document form)
  constants.ts       shared, line-agnostic primitives only (Network, scaling, decimals, MS_PER_YEAR, DRY_RUN_SENDER)
  account/           THE BASE — wxa framework + funding; imports NOTHING from perp/ or prediction/
  oracle/            oracle freshness: rules, derivation, refresh orchestration, read plane
  perp/              perp product line (client, config-view, constants, liq-view, fetch/, tx-builders/, user/)
  prediction/        prediction product line (client, constants, fetch, tx-builders, user/, utils/)
  utils/             shared helpers (math, config, format, record, validate)
  generated/         the single sui-ts-codegen output root for every package in sui-codegen.config.mjs
```

## Import direction

- `account/` is the base. It exports **down** (`account/index.ts` re-exports `account.ts`, `credit-stack.ts`,
  `funding/credit.ts` and `funding/custody.ts`; the sweep, balance and wormhole helpers are imported by path),
  never up into `perp/`. The builders are typed to the `AccountClientLike`
  capability interface (`account/client.ts`), which `PerpClient` satisfies structurally; account reads
  are typed to `WxaClientLike` (`account/fetch/referral.ts`). The generic simulate/decode plumbing lives
  in `account/fetch/simulate.ts`; `perp/fetch/simulate.ts` re-exports it and adds the perp-only `withLp`.
- `perp/` → `utils/`, never the reverse. `perp/liq-view.ts` lives perp-side for that reason: it maps a
  `PositionDataView` (a perp read type) onto `utils/math.ts::calcEstLiqPriceRaw`, and carries the invariant
  that `opts.basePriceUsd` / `opts.collateralPriceUsd` must be the prices the row was read at (the row does
  not carry them, so nothing can check it).
- `oracle/` is decoupled from the concrete client through `OracleHost` (`oracle/host.ts`); `PerpClient`
  satisfies it.
- `account/config.ts` (`WORMHOLE_DEFAULTS`) is the only non-document infra the base needs; `oracle/config.ts`
  holds only the access slices (`PythAccessConfig`, `WaterxAccessConfig`) — no deployment data anywhere
  outside the parsed document and the rule-owned `*_INFRA` tables.

## Per-folder invariants

- **`perp/user/`** — low-level perp builders, one moveCall per file, and only these: `trading.ts`,
  `order.ts`, `wlp.ts`, `staking.ts`. Account / funding / referral builders live in `account/`.
- **`perp/tx-builders/`** — the async `build*Tx` composers (`common.ts` envelope + WLP oracle refresh,
  `trading.ts`, `wlp.ts`, `rewards.ts`, `credit.ts`). `common.ts` prepends the parked-balance → wxUSD
  pre-sweep from `account/funding/consolidate.ts` (`consolidateToUsd` default `true`). **Sync low-level
  builders never auto-prepend the sweep** — apps call async `build*Tx` or `buildConsolidateToUsdTx` separately.
- **`account/funding/consolidate.ts`** — the sweep is **per credit**: `appendConsolidate{ToUsd,AddressCredit,ForSpend}(client, tx, accountId, credit?)`
  probe and fold into the named credit's stack (perp sweeps the default USD collateral; the prediction
  composers sweep into the market's `settlementCoinType`). `account/funding/balance.ts` holds the shared
  gRPC probe/rescale helpers it and `getSpendableCreditBalance` use.
- **`account/credit-stack.ts`** is **the only place that joins a credit's three objects** (registry, custody
  vault, withdrawal queue — three parallel alias-keyed maps in the document; the singular
  `objects.credit.{registry,credit_type}` / `objects.custody.{vault,assets}` / `objects.withdrawal_queue.{queue,executors}`
  are the default USD stack kept for pre-map readers). `resolveCreditStack(config, ref?)` takes an alias or a
  Move type and **throws on an unknown credit — no fallback to USD**, so a non-USD credit can never pair with
  the USD registry. Every builder or probe taking `credit?` / `creditType?` resolves through it; never index
  the singular fields for a caller-chosen credit. The `(config, …)` functions are listed in `NON_CLIENT_FIRST`
  and deliberately not bound onto `client.account` (binding would pass the client where a config is expected).
- **`account/funding/custody.ts`** — PSM mint side only (`mintCredit*`). There is no witness-free
  `custody_vault::burn`; CREDIT redemption routes through the withdraw queue in `account/funding/credit.ts`
  (`routeWormhole` / `routeNative` → `requestCreditWithdraw` → `enqueueWithdrawal`; keeper drain
  `executeWithdrawal{Wormhole,Native}` needs the executor allowlist).
- **`perp/config-view.ts`** (`PerpConfigView`) holds the document lookups that *do* something — a keyed-map
  read with a throwing miss (`getMarket`, `getAggregator`, `getPoolTokenType`, `getNativeAsset`,
  `getRewarders`) or a derived identifier (`wlpType`, `creditType`, `isConstantTicker`). Pure, no gRPC. A
  plain block read stays `client.config.objects.*` at the call site.
- **`perp/constants.ts`** — perp enums only (`PERM_*`, `ORDER_*`, `ACTION_*`); re-exports the shared
  primitives and `ACCUMULATOR_ROOT` from `account/constants.ts`. There are deliberately no fee-rate or
  maintenance-margin constants anywhere: per-market on-chain `MarketConfig` is the only source.
- **`oracle/`** — one rule per file under `rules/` (`pyth-lazer-rule`, `waterx-rule`, `constant-rule`),
  each owning its INFRA table and credential declaration; `price-update-rule.ts` is the `PriceUpdateRule`
  port; `source-list.ts` derives the fed set; `aggregate.ts` is the sole orchestrator
  (`aggregateTicker` / `aggregateTickerWithConstant` / `refreshOraclePrices`); `validate.ts`
  (`assertOracleWriteCoverage`, `servableTickers`, `missingOracleCredentials`), `weight-coverage.ts`
  (`assertOracleWeightCoverage`, reads the on-chain aggregators), `served-tickers.ts`, `update-fetch.ts`,
  `canonical.ts` + `canonical/{frame,read,stream}.ts` (THE price read — see `src/oracle/AGENTS.md`),
  `quote-center-error.ts` (the quote-center error contract shared by the leaf fetch and the canonical reads),
  `read-plane.ts` + `read-prices.ts` (the per-LEG lazer / quote-center readers, `@deprecated` for price
  reads), `schedule.ts` (Pyth market hours,
  `getMarketStatus`), `symbol-catalog.ts` + `pyth-pro-history.ts`, `rule-registry.ts` (`resolveOracleRule`).
  Public surface is re-exported from `oracle/index.ts`.
- **`prediction/tx-builders.ts`** — async `buildPlaceOrderTx` / `buildBatchClaimTx` with the same optional
  pre-sweep (needs `PerpClient` + `PredictClient`; the umbrella wraps them as `buildPredictPlaceOrderTx` /
  `buildPredictBatchClaimTx`). The sync `placeOrder` / `batchClaim` in `prediction.ts` do not sweep.
- **`generated/`** — never hand-edit; rerun `pnpm codegen` after Move ABI changes. The prediction line
  imports from here too. `scripts/fix-generated-imports.ts` normalizes paths post-codegen and annotates the
  MoveStructs that embed a MoveEnum with `: MoveStruct<any, any>` to dodge TS2883.
