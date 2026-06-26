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
[`waterx-config`](https://github.com/WaterXProtocol/waterx-config) JSON
(default URL: GitHub raw):

```
https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/<network>.json
```

The JSON is package-centric — each package nests its own object IDs and
per-ticker maps. See `waterx-config/README.md` for the canonical schema.
SDK types (`WaterXConfig`, `WaterxPerpPackage`, `WlpPackage`, etc.) in
`src/perp/config.ts` mirror that schema 1:1, snake_case included.

External chain infra (Pyth state, Wormhole state, Hermes endpoint) is
**not** in the JSON — it lives in `PYTH_DEFAULTS[network]` (`src/perp/config.ts`)
and is exposed on `client.pyth`. Override per-deployment by setting
`pyth` on the JSON if you ever need to.

`WaterXClient` is the **umbrella** entry point exposing three namespaces:
`client.account` (shared `waterx_account` + credit/custody), `client.perp` (the
`PerpClient` instance + perp builders), `client.predict` (the `PredictClient`
instance + prediction builders). `client.perp` / `client.predict` **are** the
line clients — config lookups, gRPC, and signing live on them. (The former
perp-line `WaterXClient` class is now `PerpClient`; `Client` is a deprecated
alias of the umbrella.) The factory is **async**:

```ts
import { WaterXClient } from "@waterx/sdk";

const client = await WaterXClient.create({ network: "TESTNET" });
// override URL / gRPC (shared, or per-line via { perp: {...}, predict: {...} }):
const c2 = await WaterXClient.create({
  network: "MAINNET",
  configUrl: "https://my.cdn/main/mainnet.json",
  grpcUrl: "https://my-fullnode/",
  cache: true, // optional in-process cache, default off
});

// Canonical-schema lookups live on the perp sub-client (client.perp):
client.perp.config.packages.waterx_perp.global_config;  // shared GlobalConfig
client.perp.config.packages.waterx_perp.markets["BTCUSD"]; // { market, config }
client.perp.config.packages.wlp.pool_tokens["USDCUSD"];    // pool token Move type
client.perp.getMarket("BTCUSD");                        // throwing helper
client.perp.getPythFeed("BTCUSD");                      // { feed_id, price_info_object }
client.perp.wlpType();                                  // `${wlp.original_id}::wlp::WLP`
client.perp.pyth.state_id;                              // network default

// Or construct a single line directly:
import { PerpClient } from "@waterx/sdk/perp";
const perp = await PerpClient.create("TESTNET", { configRef: "a1b2c3d" });
```

`src/constants.ts` holds only shared, line-agnostic primitives (`Network`,
`FLOAT_SCALE` / `BPS_SCALE` / `DOUBLE_SCALE`, decimals, `MS_PER_YEAR`). Perp-domain
enums (`PERM_*`, `ORDER_*`, `ACTION_*`, fee rates) live in `src/perp/constants.ts`,
which re-exports the shared ones. Both stay **chain-agnostic**.

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
`waterx_rule` is excluded because of a `nautilus/move/enclave` dependency
with a Windows-style path bug; SDK builders can use raw `tx.moveCall` if ever
needed.

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
refresh flow per ticker:

```
collector = oracle::new_collector(ticker)
pyth_rule::feed(collector, pythRuleConfig, clock, pythState, priceInfoObj)
oracle::aggregate(oracle, collector, clock)
```

`oracle/aggregate.ts::refreshOraclePrices(tx, client, tickers, opts?)` does
Hermes fetch + Pyth on-chain update + per-ticker aggregate in one call.

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
  account/           THE BASE — wxa framework + funding; both lines depend DOWN here
    client.ts        AccountClientLike capability interface (PerpClient satisfies it)
    account.ts  account-request.ts  waterx-account.ts  referral.ts  constants.ts
    funding/         credit.ts custody.ts wormhole.ts balance.ts consolidate.ts
  utils/  generated/   shared helpers (math/config/pyth-less) / codegen
  perp/              ← perp product line (was the src/ root)
    client.ts  config.ts  config-view.ts  constants.ts
    fetch.ts  tx-builders.ts  index.ts  user/
  prediction/        ← prediction product line (client.ts, config.ts, constants.ts, …)
```

- **`base-client.ts`** — `BaseLineClient<Cfg>`: the transport half shared by both
  line clients (gRPC construction, read wrappers, `simulate`,
  `signAndExecuteTransaction`, `packageIds()`). `PerpClient` / `PredictClient` extend it.
- **`unified-client.ts`** — `WaterXClient`, the umbrella entry point (`client.account` / `client.perp` / `client.predict`), with async `static create(opts)` / `fromClients(perp, predict)`. `Client` is a deprecated alias. `account/index.ts` aggregates the shared `waterx_account` + credit + custody builders for `client.account` from the **`account/` base itself** (re-exports **down** from `account/account.ts` + `account/funding/*`, never up into `perp/`). The builders are typed to the `AccountClientLike` capability interface (`account/client.ts`), which `PerpClient` satisfies structurally; the old `perp/user/{account,credit,custody,referral}` + `utils/{wormhole,account-request,consolidate-balance}` paths remain as thin re-export shims for back-compat.
- **`constants.ts`** — shared, line-agnostic primitives only: `Network`, scaling (`BPS_SCALE` / `FLOAT_SCALE` / `DOUBLE_SCALE`), decimals, `MS_PER_YEAR`. **Nothing chain-specific.** Perp-domain enums live in `perp/constants.ts`.
- **`perp/config.ts`** — `WaterXConfig` schema, `loadConfig()`, `defaultConfigUrl()`, `clearConfigCache()`.
- **`perp/client.ts`** — `PerpClient` (the perp sub-client; formerly `WaterXClient`) with async `static create(network, opts)`. Extends `BaseLineClient`; delegates config-schema lookups (`getMarket`, `wlpType`, `creditType`, …) to `perp/config-view.ts`. Reached as `client.perp` on the umbrella.
- **`perp/config-view.ts`** — `PerpConfigView`: the canonical-schema lookups split off the transport client; pure, no gRPC.
- **`perp/constants.ts`** — perp-domain enums (permission bitmasks / order tags / action codes / fee rates / `DRY_RUN_SENDER` / `ACCUMULATOR_ROOT`); re-exports the shared primitives from `../constants.ts`.
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
- **`perp/fetch.ts`** — barrel over `perp/fetch/` read-only `simulate`-based queries, split by domain: `market.ts` (account data + market / pool / token-pool / global config via `waterx_perp_view`), `positions.ts` (position / order reads + paginated lists + redeem requests), `referral.ts` (`waterx_referral`), `account.ts` (wxa account reads + `getSpendableCreditBalance` inclusive wxUSD read), `custody.ts` (`native_custody` PSM: `getCustodyVaultData` / `getCustodyAssetData`), `bridge.ts` (`getBridgeLimits` rate-limit/cap snapshot + `getBridgeFee` withdrawal-queue estimate). Shared simulate/decode plumbing lives in `fetch/simulate.ts` (internal). Returns parsed BCS structs (`PositionDataView`, `MarketDataView`, `BridgeLimitsView`, etc.).
- **`perp/tx-builders.ts`** — barrel over `perp/tx-builders/` high-level async `build*Tx` composers, split by domain: `common.ts` (`CommonBuildOpts` + request/execute envelope + WLP oracle refresh), `consolidate.ts` (`appendConsolidate*` parked-balance → wxUSD pre-sweep, `consolidateToUsd` default `true`), `trading.ts` (position lifecycle + collateral + order lifecycle), `wlp.ts` (mint / mint+stake / unstake+redeem / cancel-redeem+restake), `rewards.ts` (claim staking rewards), `credit.ts` (cross-chain bridge). Sync low-level builders never auto-prepend the sweep — apps must call async `build*Tx` (or `buildConsolidateToUsdTx` separately).
- **`utils/consolidate-balance.ts`** — shared gRPC probe/rescale helpers for `appendConsolidateToUsd` and `getSpendableCreditBalance`.
- **`prediction/tx-builders.ts`** — async **`buildPlaceOrderTx`** / **`buildBatchClaimTx`** with the same optional pre-sweep (needs `PerpClient` + `PredictClient`). Umbrella `WaterXClient.buildPredictPlaceOrderTx` / `buildPredictBatchClaimTx` wrap both clients. Sync `placeOrder` / `batchClaim` in `prediction.ts` do not auto-sweep.
- **`oracle/`** — the single source of truth for oracle freshness, split by concern: `pyth.ts` (Hermes REST + on-chain Pyth update PTB + `PythCache`; **no** rule imports), `rules/{pyth-rule,supra-rule,constant-rule,sponsor}.ts` (one oracle rule per file), `aggregate.ts` (the sole orchestrator — `aggregateTicker` / `aggregateTickerWithPyth` / `refreshOraclePrices`), `host.ts` (`OracleHost` structural interface; `PerpClient` satisfies it, so the oracle code is decoupled from the concrete client). Public surface re-exported from `oracle/index.ts`. Was the monolithic `utils/pyth.ts`.
- **`generated/`** — `sui-ts-codegen` output for the packages in `sui-codegen.config.mjs` (incl. `native_custody`). Never hand-edit; rerun `pnpm codegen` after Move ABI changes. `scripts/fix-generated-imports.ts` normalizes paths post-codegen.

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
- `waterx_rule` (Nautilus enclave Binance/Bybit/Gate.io rule) is intentionally not in codegen — only `pyth_rule` is. If a deployment needs the enclave rule, add a raw `tx.moveCall` against the contract's published ID.
