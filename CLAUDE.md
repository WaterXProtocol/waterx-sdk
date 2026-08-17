# CLAUDE.md

Guidance for Claude Code when working in `waterx-sdk` (v3).

## Changelog

This repo keeps a [Keep a Changelog](https://keepachangelog.com/)–style [`CHANGELOG.md`](CHANGELOG.md). **Every PR with a user-visible change must add an entry under `## [Unreleased]`** (Added / Changed / Deprecated / Removed / Fixed / Security), referencing the PR number. Release tagging moves `[Unreleased]` into a dated, SemVer-numbered section (also bump `package.json` `version`).

## Project Overview

WaterX is a perpetual futures DEX on Sui. The v3 contracts live in
`../waterx-contract/` as several sibling Move packages:

```
waterx_perp           core perp protocol
waterx_perp_view      simulate-only view module (read paths)
waterx_account        generalized multi-account framework (Pool / Account / Request<P>)
waterx_oracle         single shared `Oracle` keyed by ticker string
waterx_staking        staking + reward vault (replaces v2 reward_distributor)
bucket_framework      Float / Double / LinkedTable / Account / Sheet
pyth_rule             Pyth pull-oracle rule (Hermes REST)
pyth_sponsor_rule     sponsor-pays-Pyth-update-fee witness
wlp                   WLP coin (OTW)
```

The SDK is **ticker-based** (`"BTC/USD"`-style strings), not base-token-witness-based.
There is one shared `Oracle`, one shared `MarketRegistry<LP_TOKEN>`, one shared
`WlpPool<LP_TOKEN>`, one shared `WlpAum<LP_TOKEN>`, one shared
`waterx_account::AccountRegistry`. Per-market `Market<LP_TOKEN>` objects live
inside `MarketRegistry`.

## Runtime config (canonical `waterx-config` JSON)

All chain-specific values are fetched at client init from the canonical
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON. The URL is
**required** and must be supplied via the explicit `waterxConfigUrl` option — there
is **no env-var fallback and no built-in default**. `loadConfig` reads the URL solely
from `opts.waterxConfigUrl`, fetches it **as-is** (no `<network>.json` / git ref
appended), and **throws** when it is unset. Applies to both line loaders
(`perp/config.ts`, `prediction/config.ts`).

Callers that want an env-driven URL read it themselves and pass it through, e.g.
`PerpClient.create("TESTNET", { waterxConfigUrl: process.env.WATERX_CONFIG_URL })`.
The repo test/smoke harnesses do exactly this at their boundary (e2e client,
`scripts/smoke-remote.ts`); the SDK itself never touches `process.env`.

The JSON is package-centric — each package nests its own object IDs and
per-ticker maps. See `waterx-config/README.md` for the canonical schema.
SDK types (`WaterXConfig`, `WaterxPerpPackage`, `WlpPackage`, etc.) in
`src/perp/config.ts` mirror that schema 1:1, snake_case included.

External chain infra (Pyth state, Wormhole state, Hermes endpoint) is
**not** in the JSON — every source's infra is a rule-owned per-network table:
`PYTH_CORE_INFRA` (`src/oracle/pyth.ts`), `LAZER_INFRA`
(`src/oracle/rules/pyth-lazer-rule.ts`), `WATERX_INFRA`
(`src/oracle/rules/waterx-rule.ts`). It is **fixed per network** and **not**
deployment-overridable — there is **no `pyth` block in the JSON** and the SDK
never reads one. `client.pyth` is `PythAccessConfig` — ONLY the caller-supplied
`pythApiKey` / `pythFetch` create options (a secret has no place in a public
CDN JSON); it carries no endpoints or object ids. Read-plane endpoint
accessors for consumers: `pythCoreHermesEndpoint(network)` /
`waterxQuoteCenterEndpoint(network)`.

Which price-update **sources** run is the client's REQUIRED `oracleSource`
create option — a single value or a LIST (the fed set): every listed source's
data is fetched and fed in one build, and the chain's per-ticker weight tables
arbitrate. There is **no default source**, **no cross-source fallback**, and
**no client-creation feeds guard**: a ticker no listed source serves fails at
**tx-build** (constant-only tickers are exempt), not at init; a
present-but-wrong feed id is left to abort on-chain at dry-run. The
`pyth_lazer_rule` source reads only `api_key`/`fetch` from `client.pyth` and
gets its on-chain infra from `LAZER_INFRA` + config. `'waterx_rule'`
(first-party Nautilus-TEE quote-center, ed25519 signed batches) touches no
Pyth infra: its host comes from `WATERX_INFRA[network]`, overridable per
client via the `waterxEndpoint` / `waterxFetch` create options (fetch policy
precedence: `waterxFetch` → the `fetchWithPolicy` defaults — deliberately no
`pythFetch` fallback).

`WaterXClient` is the **umbrella** entry point exposing three namespaces:
`client.account` (shared `waterx_account` + credit/custody), `client.perp` (the
`PerpClient` instance + perp builders), `client.predict` (the `PredictClient`
instance + prediction builders). `client.perp` / `client.predict` **are** the
line clients — config lookups, gRPC, and signing live on them. (The former
perp-line `WaterXClient` class is now `PerpClient`; `Client` is a deprecated
alias of the umbrella.) The factory is **async**:

```ts
import { WaterXClient } from "@waterx/sdk";
// network default

// Or construct a single line directly:
import { PerpClient } from "@waterx/sdk/perp";

const client = await WaterXClient.create({
  network: "TESTNET",
  waterxConfigUrl: "https://my.cdn/main/testnet.json", // required — no default
});
// override URL / gRPC (shared, or per-line via { perp: {...}, predict: {...} }):
const c2 = await WaterXClient.create({
  network: "MAINNET",
  waterxConfigUrl: "https://my.cdn/main/mainnet.json",
  grpcUrl: "https://my-fullnode/",
  cache: true, // optional in-process cache, default off
});

// Canonical-schema lookups live on the perp sub-client (client.perp):
client.perp.config.packages.waterx_perp.global_config; // shared GlobalConfig
client.perp.config.packages.waterx_perp.markets["BTCUSD"]; // { market, config }
client.perp.config.packages.wlp.pool_tokens["USDCUSD"]; // pool token Move type
client.perp.getMarket("BTCUSD"); // throwing helper
client.perp.getPythFeed("BTCUSD"); // { feed_id, price_info_object }
client.perp.wlpType(); // `${wlp.original_id}::wlp::WLP`
client.perp.pyth.state_id;

const perp = await PerpClient.create("TESTNET", { waterxConfigUrl: process.env.WATERX_CONFIG_URL });
```

`src/constants.ts` holds only shared, line-agnostic primitives (`Network`,
`FLOAT_SCALE` / `BPS_SCALE` / `DOUBLE_SCALE`, decimals, `MS_PER_YEAR`). Perp-domain
enums (`PERM_*`, `ORDER_*`, `ACTION_*`) live in `src/perp/constants.ts`,
which re-exports the shared ones. Both stay **chain-agnostic**. There are
deliberately **no fee-rate / maintenance-margin constants** — per-market
`MarketConfig` on chain is the only source for those values.

## Development Commands

```bash
pnpm install
pnpm build           # rm dist, tsc -p tsconfig.build.json, tsc-alias
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint + prettier --check
pnpm lint:fix        # eslint --fix
pnpm format          # prettier --write
pnpm env:init        # copy `.env.example` → `.env.local` once (gitignored); chmod 600 on Unix
pnpm codegen         # scripts/codegen-summaries.ts → sui-ts-codegen → fix-generated-imports.ts
```

`pnpm codegen` runs `sui move summary` for each package listed in
`scripts/codegen-summaries.ts` (resolves under `../waterx-contract/<pkg>/`).
`waterx_rule` **is** in codegen (`waterx_oracle_rule/waterx_rule`) and its
generated bindings are committed — `WaterxRule` calls them directly, so no raw
`tx.moveCall` is needed for the enclave rule.

## Contract surface (v3 specifics)

### Account abstraction (waterx_account)

`waterx_perp` has **no** account registry of its own. Per-account perp state
(positions / orders) lives on the wxa `Account` under
`ProtocolDataKey<WaterXPerp>()`, auto-installed on first `add_position` /
`add_order`. Funds move via `wxa_account::take` / `wxa_account::put` gated by
the `WaterXPerp` witness — no TTO `Receiving<Coin<C>>` anywhere in trading.

User-side `*_request` entrypoints share the signature shape:

```move
*_request<C_TOKEN, LP_TOKEN>(
  global_config: &GlobalConfig,
  wxa_registry: &mut WxaAccountRegistry,
  market_registry: &mut MarketRegistry<LP_TOKEN>,
  ticker: String,
  sender_request: &AccountRequest,
  account_id: ID,
  ... payload ...
  clock: &Clock,
): TradingRequest<C_TOKEN>
```

`execute<C, LP>` consumes the `TradingRequest` hot potato (no
`TradingResponse` / `destroy_response` anymore). The SDK pairs each
`*Request` builder with a single `executeTrading` call in the same PTB.

### No user-side `open_position_request`

Open-at-market is now: place a limit order with `trigger_price = None` and a
non-zero `acceptable_price`. The order parks at tick 0 in the limit book
and a keeper fills it via `match_orders`. SDK convenience: call
`placeOrderRequest({ main: { ..., triggerPrice: undefined, acceptablePrice: rawPrice(p) }})`.

### Pre-orders (TP / SL bundled with opener)

`place_order_request` takes `main: PlaceOrderArgument, preOrder: PlaceOrderArgument[]`.
Pre-orders are reduce-only TP/SL legs reserved against the freshly opened
position; they are validated at request creation, activated on fill, and
swept on cancel/liquidation. Per-leg cancel/add via
`cancel_pre_order_request` / `add_pre_order_request`. Per-market cap on
`MarketConfig.max_pre_orders` (default 2).

### Oracle (single shared object)

`waterx_oracle::Oracle` is one shared object keyed by ticker string. PTB
refresh flow per ticker — one `feed` leg per rule the ticker is configured for,
then one aggregate:

```
collector = oracle::new_collector(ticker)
[pyth_rule::feed(collector, pythRuleConfig, clock, pythState, priceInfoObj)]
[pyth_lazer_rule::feed(collector, …, verifiedUpdate)]   // selected source produced one
[waterx_rule::collect_single_with_proof(collector, …, leaf, proof)]  // verify + feed in ONE call
[supra_rule::feed / constant_rule::feed]
oracle::aggregate(oracle, collector, clock)
```

The fed set must cover the aggregator's on-chain `weights` — `remove_outliers`
aborts `EMissingPriceSource` when a weighted rule is absent from the collector
(an ABSTAINING feed counts as present).

`oracle/aggregate.ts::refreshOraclePrices(tx, client, tickers, opts?)` runs the
selected source's off-chain fetch + on-chain update leg, then the per-ticker
feeds + aggregate, in one call. Which source runs is `oracleSource`: Hermes
fetch + Pyth update for `'pyth_rule'`, a signed Lazer update for
`'pyth_lazer_rule'`, a quote-center signed Merkle leaf per ticker for
`'waterx_rule'` (that one emits no separate update leg — verify and feed are
bundled into `collect_single_with_proof`).

The waterx leg has TWO wire shapes and prefers the leaf: `GET
/v1/quotes/leaves` gives one independently-verifiable leaf per symbol (leaf +
proof + the enclave's signature over the snapshot root), so a PTB carries ONE
`new_batch_item` whatever the snapshot's width. `GET /v1/quotes/update` gives one
signature over a whole batch, which is indivisible — `collect_batch_latest` needs
every item rebuilt in-PTB to re-verify it (29 mainnet feeds ⇒ 58 extra moveCalls
per trade). The envelope path stays only as the fallback for a quote-center with
no leaf route (404), and for whole-batch pushes.

### WLP pool

`mint_wlp` / `settle_redeem` take `&WlpAum` (a separate AUM tracking shared
object) in addition to `&WlpPool`. SDK config exposes both: `objects.wlpPool`
and `objects.wlpAum`. The `mintWlpTo` / `cancelRedeemAndTransfer` convenience
wrappers are gone — every payout lands inside the recipient wxa account.

### Keeper paths are monolithic

`liquidate`, `batch_liquidate`, `match_orders`, `update_funding_rate`,
`open_position_by_keeper`, `close_position_by_keeper` are single-call
functions taking `sender_request: &AccountRequest` directly. No request /
response hot potato. They skip the witness checklist.

### Witness rules

`pyth_rule::feed` is **not** typed `<T>` anymore — works on any collector
by ticker (the rule's `Config.identifier_map` resolves the on-chain
`PriceInfoObject` ID). `pyth_sponsor_rule` keeps the `request` / `split` /
`reimburse` hot-potato fund pattern; its witness gets added to the
`TradingRequest` for the sponsor's bookkeeping.

## SDK Layout (src/)

**Symmetric two-line tree** — a thin shared root holds the umbrella + cross-cutting
infra; each product line is a self-contained folder (`perp/` mirrors `prediction/`):

```
src/
  sdk.ts             package root (`.` export) — umbrella + flat-perp + namespaces
  unified-client.ts  WaterXClient umbrella (account / perp / predict)
  base-client.ts     shared transport base both line clients extend
  constants.ts       shared primitives ONLY (Network, scaling, decimals, MS_PER_YEAR)
  account/           THE BASE — wxa framework + funding; imports NOTHING from perp/
    client.ts        AccountClientLike capability interface (PerpClient satisfies it)
    config.ts        account/funding/referral schema + AccountPackages/AccountConfig
    account.ts  account-request.ts  waterx-account.ts  referral.ts  constants.ts
    funding/         credit.ts custody.ts wormhole.ts balance.ts consolidate.ts
  utils/  generated/   shared helpers (math/config/pyth-less) / codegen
  perp/              ← perp product line (was the src/ root)
    client.ts  config.ts  config-view.ts  constants.ts  liq-view.ts
    fetch.ts  tx-builders.ts  index.ts  user/
  prediction/        ← prediction product line (client.ts, config.ts, constants.ts, …)
```

- **`base-client.ts`** — `BaseLineClient<Cfg>`: the transport half shared by both
  line clients (gRPC construction, read wrappers, `simulate`,
  `signAndExecuteTransaction`, `packageIds()`). `PerpClient` / `PredictClient` extend it.
- **`unified-client.ts`** — `WaterXClient`, the umbrella entry point (`client.account` / `client.perp` / `client.predict`), with async `static create(opts)` / `fromClients(perp, predict)`. `Client` is a deprecated alias. `account/index.ts` aggregates the shared `waterx_account` + credit + custody builders for `client.account` from the **`account/` base itself** (re-exports **down** from `account/account.ts` + `account/funding/*`, never up into `perp/`). The builders are typed to the `AccountClientLike` capability interface (`account/client.ts`), which `PerpClient` satisfies structurally. The account/funding/referral builders were **moved** out of perp into the `account/` base (`account/account.ts`, `account/account-request.ts`, `account/referral.ts`, `account/funding/{credit,custody,wormhole,balance,consolidate}.ts`) — there are no leftover `perp/user/*` or `utils/*` re-export shims; consumers import from `account/` (or the `.`/`@waterx/sdk/account` surface) directly.
- **`constants.ts`** — shared, line-agnostic primitives only: `Network`, scaling (`BPS_SCALE` / `FLOAT_SCALE` / `DOUBLE_SCALE`), decimals, `MS_PER_YEAR`, `DRY_RUN_SENDER` (zero-address simulate sender). **Nothing chain-specific.** Perp-domain enums live in `perp/constants.ts`.
- **`perp/config.ts`** — `WaterXConfig` schema (perp/wlp/staking packages; `WaterXPackages extends AccountPackages, OraclePackages`), `loadConfig()` (URL from the `waterxConfigUrl` opt only — no env fallback, no default; throws when unset), `clearConfigCache()`. The account/funding/referral package types live in `account/config.ts`; the oracle-rule package types + `PythAccessConfig`/`WaterxAccessConfig` live in `oracle/config.ts` (shared — `OracleHost` depends on its `OracleConfig`, not on `perp/`; per-source infra lives with each rule, not here). Both are re-exported here for back-compat.
- **`perp/client.ts`** — `PerpClient` (the perp sub-client; formerly `WaterXClient`) with async `static create(network, opts)`. Extends `BaseLineClient`; delegates config-schema lookups (`getMarket`, `wlpType`, `creditType`, …) to `perp/config-view.ts`. Reached as `client.perp` on the umbrella.
- **`perp/config-view.ts`** — `PerpConfigView`: the canonical-schema lookups split off the transport client; pure, no gRPC.
- **`perp/liq-view.ts`** — `calcEstLiqPriceRawFromView(position, opts)`: maps a fetched `PositionDataView` row onto `utils/math.ts::calcEstLiqPriceRaw`'s twelve raw fields (nine off the row, three off `opts`), and carries the invariant that `opts.basePriceUsd` / `opts.collateralPriceUsd` MUST be the prices the row was read at (the row does not carry them, so nothing can check it). Lives perp-side, not in `utils/math.ts`: `PositionDataView` is a perp read type and importing it into the shared `utils/` base would invert the `perp/ → utils/` direction. Pure mapping, no client — hence separate from `perp/fetch/`, which is transport.
- **`perp/constants.ts`** — perp-domain enums (permission bitmasks / order tags / action codes). Deliberately **no fee-rate / maintenance-margin constants** — per-market on-chain `MarketConfig` is the only source for those (see the note above); re-exports the shared primitives from `../constants.ts` (incl. `DRY_RUN_SENDER`, the line-agnostic zero-address simulate sender) and `ACCUMULATOR_ROOT` from `account/constants.ts`.
- **`perp/user/`** — low-level builders (one moveCall per file):
  - `account.ts` — wxa account: `createAccount`, `setAlias`, delegate management, `requestDeposit`, `requestWithdraw`, `transferToAccount`.
  - `trading.ts` — `closePositionRequest`, `increasePositionRequest`, `decreasePositionRequest`, `depositCollateralRequest`, `withdrawCollateralRequest`, `executeTrading`, keepers (`liquidate`, `batchLiquidate`, `matchOrders`, `updateFundingRate`, `openPositionByKeeper`, `closePositionByKeeper`).
  - `order.ts` — `buildPlaceOrderArgument`, `placeOrderRequest`, `cancelOrderRequest`, `updateOrderRequest`, `cancelPreOrderRequest`, `addPreOrderRequest`.
  - `wlp.ts` — `mintWlp`, `requestRedeemWlp`, `cancelRedeemWlp`, `settleRedeemWlp`, `updateTokenValue`.
  - `staking.ts` — `stake`, `unstake`, `claimReward` (with rewarder settle/destroy checker plumbing).
  - `custody.ts` — `native_custody` PSM (mint side only): `mintCredit`, `mintCreditFromRequest`, `mintCreditToAccount` (mint + `consume_deposit_direct`). Needs `waterx_credit` + `native_custody` in config. **Direct burn was removed (audit L03/M14)** — there is no witness-free `custody_vault::burn` anymore; CREDIT redemption routes through the withdraw queue in `credit.ts`.
  - `credit.ts` — cross-chain CREDIT / bridge:
    - Mint (EVM → Sui): `redeemVaa` → `DepositRequest<CREDIT>` hot potato, consumed in-PTB by `consumeCreditDeposit` (`direct_rule::consume_deposit_direct`).
    - Withdraw (Sui → EVM / native): `routeWormhole` / `routeNative` (`route_native` takes `min_output`, audit M15) encode `extra_data`, fed to `requestCreditWithdraw` (`account::request_withdraw<CREDIT>`) → `enqueueWithdrawal` parks a FIFO `Queue<CREDIT>` entry.
    - Keeper drain: `executeWithdrawalWormhole` / `executeWithdrawalNative` (caller must be on the executor allowlist).
    - PSM direct: `custodyMint` (against the native `CustodyVault`).
      Needs `waterx_credit` + `wormhole_bridge` + `withdrawal_queue` (+ `native_custody` for the native paths) in config.
  - `referral.ts` — referral builders backed by the standalone `waterx_referral` package (`setReferralCode` / `useReferralCode` / …). Requires `config.packages.waterx_referral.{published_at,referral_table}`; each builder throws (config guard) when that is unset so misconfigured deployments fail loudly rather than aborting on-chain.
- **`perp/fetch.ts`** — barrel over `perp/fetch/` read-only `simulate`-based queries, split by domain: `market.ts` (account data + market / pool / token-pool / global config via `waterx_perp_view`), `positions.ts` (position / order reads + paginated lists + redeem requests), `account.ts` (wxa account reads + `getSpendableCreditBalance` inclusive wxUSD read), `custody.ts` (`native_custody` PSM: `getCustodyVaultData` / `getCustodyAssetData`), `bridge.ts` (`getBridgeLimits` rate-limit/cap snapshot + `getBridgeFee` withdrawal-queue estimate). Referral reads (`waterx_referral`: `getRefererFor` / `isValidReferralCode` / `referralCodeExists`) live in the **account base** (`account/fetch/referral.ts`, typed to `WxaClientLike`) and are re-exported through this barrel for the perp surface. The generic simulate/decode plumbing also lives in the base (`account/fetch/simulate.ts`); `fetch/simulate.ts` re-exports it and adds the perp-only `withLp` (both internal). Returns parsed BCS structs (`PositionDataView`, `MarketDataView`, `BridgeLimitsView`, etc.).
- **`perp/tx-builders.ts`** — barrel over `perp/tx-builders/` high-level async `build*Tx` composers, split by domain: `common.ts` (`CommonBuildOpts` + request/execute envelope + WLP oracle refresh), `consolidate.ts` (`appendConsolidate*` parked-balance → wxUSD pre-sweep, `consolidateToUsd` default `true`), `trading.ts` (position lifecycle + collateral + order lifecycle), `wlp.ts` (mint / mint+stake / unstake+redeem / cancel-redeem+restake), `rewards.ts` (claim staking rewards), `credit.ts` (cross-chain bridge). Sync low-level builders never auto-prepend the sweep — apps must call async `build*Tx` (or `buildConsolidateToUsdTx` separately).
- **`account/funding/balance.ts`** — shared gRPC probe/rescale helpers for `appendConsolidateToUsd` (in `account/funding/consolidate.ts`) and `getSpendableCreditBalance`.
- **`prediction/tx-builders.ts`** — async **`buildPlaceOrderTx`** / **`buildBatchClaimTx`** with the same optional pre-sweep (needs `PerpClient` + `PredictClient`). Umbrella `WaterXClient.buildPredictPlaceOrderTx` / `buildPredictBatchClaimTx` wrap both clients. Sync `placeOrder` / `batchClaim` in `prediction.ts` do not auto-sweep.
- **`oracle/`** — the single source of truth for oracle freshness, split by concern: `pyth.ts` (Hermes REST + on-chain Pyth update PTB + `PythCache`; **no** rule imports), `rules/{pyth-rule,supra-rule,constant-rule,sponsor}.ts` (one oracle rule per file), `aggregate.ts` (the sole orchestrator — `aggregateTicker` / `aggregateTickerWithPyth` / `refreshOraclePrices`), `host.ts` (`OracleHost` structural interface; `PerpClient` satisfies it, so the oracle code is decoupled from the concrete client), `config.ts` (the oracle-rule package schema + the access-only `PythAccessConfig`/`WaterxAccessConfig` slices + the narrow `OracleConfig`/`OraclePackages` — hoisted out of `perp/config.ts`, which now re-exports them and `WaterXPackages extends OraclePackages`; per-source INFRA tables live with their rules: `PYTH_CORE_INFRA` in `pyth.ts`, `LAZER_INFRA`/`WATERX_INFRA` in their rule files), `read-plane.ts` (`resolveOracleReadPlan` — per-source read served-sets/ids), `rule-registry.ts` (`resolveOracleRule`, exported). Public surface re-exported from `oracle/index.ts`. Was the monolithic `utils/pyth.ts`.
- **`generated/`** — the **single** `sui-ts-codegen` output root for every package in `sui-codegen.config.mjs` (incl. `native_custody` and `waterx_prediction` — the prediction line imports from here too; there is no longer a separate `src/prediction/generated/`). Never hand-edit; rerun `pnpm codegen` after Move ABI changes. `scripts/fix-generated-imports.ts` normalizes paths post-codegen **and** annotates the MoveStructs that embed a MoveEnum (`VecSet`/`LinkedTable`/`Node`, `waterx_prediction` `Market`/`MarketView`) with `: MoveStruct<any, any>` to dodge TS2883.

## Naming conventions

- **Move**: snake_case modules/functions, PascalCase structs, type params `C_TOKEN`, `LP_TOKEN`.
- **SDK**: camelCase functions, PascalCase interfaces/types.
- **Tickers**: trading pairs use **`ticker`** (never `symbol`), format concatenated `BTCUSD` / `ETHUSD` / `SUIUSD` — never `BTC`, `BTC/USD`, or `BTC_USD`. Canonical source: `waterx-config/{network}.json` (`markets` and `packages.pyth_rule.feeds` keys). Collateral tokens (`USDC`, `USDSUI`) keep `symbol` — held on `TokenPoolInfo.ticker` (set at `add_token`); the SDK passes it explicitly when needed.
- **BCS field names**: snake_case on the Move / wire side (`account_object_address`, `request_timestamp`, `linked_position_id`); generated TS structs preserve those names — consumers use them as-is.

## Notes when hacking

- All `*_request` builders return the `TradingRequest` argument so you can pass it to `executeTrading` (or build a custom PTB).
- Pre-orders must be reduce-only, opposite side of main, no collateral, no linked position. `place_order_request` validates this at request creation before any wxa take.
- Cancel-order wildcard: pass `orderTypeTag: ORDER_TAG_WILDCARD` (255) and `triggerPrice: 0n` to scan all 4 books by `orderId`.
- Price scaling: human-readable USD (`50000`) → raw 1e9-scaled bigint via `rawPrice(usd)`. Pass the raw form to `acceptablePrice` / `triggerPrice` / size args.
- Mainnet config is **not yet deployed**; loading `MAINNET` will fail until the maintainers publish `mainnet.json` to the config repo.
- `waterx_rule` (Nautilus enclave CEX-price rule) ships as an `oracleSource` list entry (`'waterx_rule'`) — `src/oracle/rules/waterx-rule.ts` against the committed `src/generated/waterx_rule` bindings. It pulls one signed Merkle LEAF per ticker from the quote-center (`GET /v1/quotes/leaves`, public read) and then verifies AND feeds in a single `collect_single_with_proof` per collector, so its `buildUpdateCalls` emits nothing. Against a quote-center with no leaf route (404) it falls back to the older shape: ONE indivisible batch envelope (`GET /v1/quotes/update`) fed through `collect_batch_latest`, which has to rebuild every item in the batch in-PTB just to use one symbol's price. Every other status throws rather than falling back — see `fetchWaterxSignedLeaves` for why (and note 501 can NOT signal a missing route, since `fetchWithPolicy` retries all 5xx). The quote-center host comes from the rule-owned `WATERX_INFRA[network]` table (in `rules/waterx-rule.ts`; accessor `waterxQuoteCenterEndpoint(network)`), overridable per client via `waterxEndpoint` (base path preserved) and `waterxFetch` (policy precedence `waterxFetch` → defaults — deliberately NO `pythFetch` fallback; sources never share config) — browser consumers blocked by the quote-center's CORS allowlist point these at a same-origin proxy. A live response that does not cover every requested ticker is rejected at fetch, not left to abstain on-chain. REPLAY DISPOSITION: on the `collect_*` paths a replayed per-symbol signed timestamp ABSTAINS, it does not abort (audit F-014's high-water mark means the chain already holds a price at least this fresh), so two concurrent builds may share one snapshot; only the single-rule `feed_*` entries abort `EReplayedSignature`.
- Legacy oracle knobs are GONE: no `client.pyth.hermes_endpoint` / `PythInfraConfig` / `PYTH_DEFAULTS` (Core infra lives in the rule-owned `PYTH_CORE_INFRA` in `src/oracle/pyth.ts`; read-plane accessor `pythCoreHermesEndpoint(network)`), no `LAZER_DEFAULTS` (now `LAZER_INFRA` inside `rules/pyth-lazer-rule.ts`), no `WATERX_DEFAULTS` / `WaterxInfraConfig` (now `WATERX_INFRA` / `WaterxAccessConfig`). `client.pyth` is `PythAccessConfig` (caller `api_key` + `fetch` only); `client.waterx` is `WaterxAccessConfig` (caller overrides only). `oracleSource` is REQUIRED at client creation and accepts a list (the fed set) — there is no default source and no cross-source fallback anywhere.
