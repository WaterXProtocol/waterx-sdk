# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WaterX is a perpetual futures DEX on Sui blockchain. The SDK provides TypeScript transaction builders, BCS struct parsers, and query helpers for the WaterX perp protocol.

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build (rm dist, tsc -p tsconfig.build.json, tsc-alias)
pnpm test                 # Run unit + e2e tests (vitest)
pnpm test:unit            # Unit tests only
pnpm test:e2e             # E2E (simulate) tests only
pnpm test:integration     # Integration tests (requires WATERX_INTEGRATION_PRIVATE_KEY)
pnpm test:ci              # test:ci:unit (coverage + JUnit) then test:ci:simulate (e2e JUnit)
pnpm typecheck            # Type-check without emitting
pnpm lint                 # Run ESLint + Prettier check (src/, test/, scripts/)
pnpm lint:eslint          # ESLint only
pnpm lint:prettier        # Prettier check only
pnpm lint:fix             # Auto-fix ESLint issues
pnpm format               # Auto-format with Prettier (src/, test/, scripts/)
pnpm codegen              # Regenerate BCS types from Move contracts (sui-ts-codegen)
```

Move contracts live in `waterx-contracts/` (gitignored — separate working tree). Build/test with:

```bash
cd waterx-contracts/waterx_perp && sui move build
cd waterx-contracts/waterx_perp && sui move test
```

`pnpm codegen` runs `sui move summary` for `waterx_perp` / `bucket_framework` / `bucket_oracle` / `reward_distributor` under `waterx-contracts/`, then `sui-ts-codegen` regenerates `src/generated/`.

## Architecture

### Account Abstraction

All authenticated functions take `sender_request: &AccountRequest` from `bucket_v2_framework::account`. Two modes:

- `account::request(ctx)` — identity is the tx sender (normal wallet)
- `account::request_with_account(&Account)` — identity is an `Account` object address (multi-sig, shared)

**Callers that need `AccountRequest`** (all trading + keeper + lifecycle functions):

- **Trading**: `open_position_request`, `close_position_request`, `increase_position_request`, `decrease_position_request`, `place_order_request`, `cancel_order_request`, `deposit_collateral_request`, `withdraw_collateral_request`, `liquidate_request`, `match_orders`, `update_funding_rate`, `open_position_request_by_keeper`, `close_position_request_by_keeper`, `batch_liquidate_request`
- **Account / delegates**: `create_account`, `add_delegate`, `remove_delegate`, `update_delegate_permissions`, `receive_coin_with_amount`, `receive_coin_with_amount_to`
- **Referral**: `set_referral_code`, `use_referral_code`
- **LP lifecycle**: `cancel_redeem`, `cancel_redeem_and_transfer` (the user requester must match the `request_redeem` recipient)

**Callers that do NOT take `AccountRequest`** (anyone can call them): `mint_wlp`, `request_redeem`, `update_token_value`, and all admin / view functions.

SDK transaction builders construct `AccountRequest` internally. Most builders use `account::request(ctx)` by default. Several expose an optional `bucketAccount?: string | TransactionArgument` to switch to `account::request_with_account(&Account)`: `createAccount`, `stakeRewardDistributor`, `unstakeRewardDistributor`, `claimRewardDistributor`, `redeemRewardDistributorCoin`, `buildMintAndStakeWlpTx`, `buildStake/Unstake/ClaimRewardDistributorTx`, `buildUnstakeAndRequestRedeemWlpTx`, `cancelRedeemWlp`, `buildCancelRedeemWlpTx`.

### Hot-Potato Request/Response Pattern (Critical)

The core trading engine uses a **hot-potato request/response pattern**:

```
PTB flow:
1. sender_request = account::request(ctx)
2. request = trading::open_position_request(..., sender_request, ...)
3. (coin, response) = trading::execute(market, pool, request, prices, clock)
4. trading::destroy_response(global_config, market, response)
```

- **`request.move`** — `TradingRequest<C_TOKEN>` hot potato. Carries action type, collateral balance, and `VecSet<TypeName>` of witnesses.
- **`response.move`** — `TradingResponse` hot potato. Must be consumed by `destroy_response()`.
- All request functions take 3 type args: `<C_TOKEN, BASE_TOKEN, LP_TOKEN>`.
- `destroy_response` takes 2 type args: `<BASE_TOKEN, LP_TOKEN>`.
- **Batch operations**: `batch_liquidate_request` (paginated scan, skips non-liquidatable, returns `vector<TradingRequest>`), `batch_execute` (processes `vector<TradingRequest>`, returns merged coin + `vector<TradingResponse>`), `batch_destroy_response` (destroys `vector<TradingResponse>`).

### Contract Modules (waterx-contracts/waterx_perp/sources/)

- **trading.move** — Trading engine: `Market<BASE_TOKEN, LP_TOKEN>` shared object per pair (one per `market_symbol::<SYM>_USD`). All trading functions use request/response with `PriceResult<T>` from the oracle. Orders live in four `OrderBook` (limit_buys / limit_sells / stop_buys / stop_sells), each `OrderBook.levels: KeyedBigVector<u128, PriceLevel>` and `PriceLevel.orders: LinkedTable<u64, Order>`. Size is `Float` (1e9-scaled `u128`) end-to-end; public API accepts size as raw `u128` scaled value. No `lot_size` and no `size_decimal`.
- **position.move** — `Position` and `Order` structs, PnL calculation, fee tracking. `Position.size` / `Order.size` are `Float`. Collateral tracked in struct fields; actual balances in `GlobalVault`. `is_liquidatable()` takes `closing_fee: Float` (pre-computed USD value, NOT bps — callers inline `float::from_bps(bps).mul(notional)`). `math::fee_from_bps` was removed.
- **market_config.move** — `MarketConfig<BASE_TOKEN>` per pair. Funding rate calculation, OI (`long_oi` / `short_oi` / `max_long_oi` / `max_short_oi` — all `Float`), reentrancy lock (`position_locker: VecSet<u64>`). Impact fee params (`max_impact_fee_bps`, `allocated_lp_exposure_bps`, `impact_fee_curvature`, `impact_fee_scale`) are **struct fields** in v2 (configurable per-market, not module constants). Floor is `min_coll_value` (USD threshold against collateral value) — `min_size` / `lot_size` / `size_decimal` removed. Order-price normalization uses `order_price_tick: Float`.
- **lp_pool.move** — `WlpPool<LP_TOKEN>` (shared). Multi-token with target weights, dynamic fees, 3-slope borrow rates. `total_lp_supply` derives from the `TreasuryCap` (no separate field). Token balances live in `GlobalVault` on `GlobalConfig`, not on the pool. `mint_wlp`/`mint_wlp_to` and `settle_redeem` take `&mut GlobalConfig`. `request_redeem` takes `&GlobalConfig`. `cancel_redeem` returns `Coin<LP_TOKEN>`; `cancel_redeem_and_transfer` wraps it + transfers. `update_token_value<LP, TOKEN>` refreshes a single token pool's `last_price_refresh_timestamp`. `assert_prices_fresh` checks **every** pool token against `GlobalConfig.price_refresh_threshold_ms` — SDK must refresh all pool tokens in the same PTB before `mint_wlp` / `settle_redeem`.
- **user_account.move** — `AccountRegistry` (shared) for sub-accounts with delegate permissions (bitmask `u16`). TTO pattern. `UserAccount` objects are stored **inside** `AccountRegistry.accounts` (`KeyedBigVector<ID, UserAccount>`) — they are NOT standalone shared/owned objects. Access must go through registry view functions (e.g. `view::get_account_positions`), not by passing the account ID as a direct object reference. `transfer_coin` validates account exists before deposit. `receive_coin_with_amount` / `receive_coin_with_amount_to` merge multiple coins, split requested amount (or all if `none`), return remainder — requires `PERM_WITHDRAW`. Positions tracked per market via `positions: VecMap<ID, vector<u64>>`; orders tracked per market via `orders: VecMap<ID, vector<u64>>`.
- **global_config.move** — `GlobalConfig` singleton. Keepers, fees, insurance, OI cap, `price_refresh_threshold_ms`. `GlobalVault<C_TOKEN>` per collateral type via dynamic field.
- **keyed_big_vector.move** — `KeyedBigVector` replaces `Table` / `ObjectTable`. Untyped struct with typed functions. Pattern: `kbv.borrow_by_key<K, V>(key)` / `kbv.push_back(key, value)` / `kbv.swap_remove_by_key(key)`.
- **order_book.move** — v2 replacement for the old `VecMap<u64, vector<Order>>` order storage. `OrderBook` + `PriceLevel` + `trigger_price_key: u128`.
- **referral_table.move** — `ReferralTable` (shared) for referral codes and bindings.
- **view.move** — Read-only view functions returning BCS-serializable structs via `simulateTransaction`. All names use the `*_data` suffix: `account_data(registry, owner)` (delegates inlined), `market_data<B, L>`, `pool_data<L>`, `token_pool_data<L>`, `position_data<B, L>(market, pool, base_price_usd, collateral_price_usd, position_id)`, `order_data<B, L>`, `global_config_data(cfg)`. Paginated: `get_account_positions`, `get_account_orders`, `get_market_positions`, `get_market_orders(market, base_price_usd, cursor, page_size) → (vector<OrderData>, Option<u64>)`, `get_redeem_requests`. Price inputs are `u64` USD values (e.g. 50000), not `PriceResult`.
- **events.move** — v2 events carry `base_type` / `wlp_type` / `collateral_type` TypeNames and use `size: Float` (1e9-scaled `u128`) instead of `size_amount: u64`.
- **math.move** — Math utilities using `Float` from bucket_v2_framework. Decimals are `u8`.
- **admin.move** — `AdminCap` gating for privileged operations.
- **error.move** — Protocol error codes (ranges: 100-market, 200-position, 300-order, 400-pool, 500-oracle, 600-account, 700-referral, 800-admin, 900-request/response).

### SDK Layers (src/)

- **client.ts** — `WaterXClient` wraps `SuiGrpcClient`. Factories: `WaterXClient.mainnet()` and `WaterXClient.testnet()` (also `createMainnetConfig()` / `createTestnetConfig()`). `WaterXConfig` includes Pyth config (`pythRulePackageId`, `pythRuleConfigId`, `pythConfig`), shared objects (`globalConfig`, `referralTable`, `accountRegistry`, `wlpPool`, `rewardDistributorId`), `collaterals: Record<CollateralAsset, {type, aggregatorId, priceInfoId, feedKey}>`, and `markets: Record<LegacyBaseAsset, MarketEntry> & Partial<Record<ExtendedBaseAsset, MarketEntry>>` — the 13 legacy markets are non-nullable on every network, the 200K-tier batch (`ExtendedBaseAsset`) is mainnet-only and resolves to `MarketEntry | undefined`. Use `client.getMarketEntry(base)` for a runtime-checked lookup that throws on missing. **No Supra** (Pyth-only in v2). **No legacy `usdcAggregator` / `usdcPriceInfoId` / `usdcType` aliases** — always read via `client.config.collaterals.USDC.*`.
- **constants.ts** — Package IDs (`MAINNET_PACKAGE_IDS` / `TESTNET_PACKAGE_IDS` — `WATERX_PERP`, `WLP`, `MARKET_SYMBOL`, `MARKET_SYMBOL_V2` (mainnet only — host package for the 200K-tier witnesses), `PYTH_RULE`, `PYTH_SPONSOR_RULE`, `BUCKET_ORACLE`, `BUCKET_FRAMEWORK`, `REWARD_DISTRIBUTOR`; testnet also has `MOCK_USDC`, `MOCK_USDSUI`). Shared object IDs (`MAINNET_OBJECTS` / `TESTNET_OBJECTS`), token types (`MAINNET_TYPES` / `TESTNET_TYPES`). `BaseAsset` is split into two unions: `LegacyBaseAsset` (the original 13, deployed on both networks) and `ExtendedBaseAsset` (the 15 mainnet-only 200K-tier symbols — HYPE, XRP, BNB, ZEC, XAUT, XAG, EURUSD, USDJPY, MSTRX, COINX, HOODX, CRCLX, NFLXX, WTI, BRENT). Per-market config: `MAINNET_MARKETS: Record<BaseAsset, …>` (28 entries, full); `TESTNET_MARKETS: Record<LegacyBaseAsset, …>` (13 entries, strict). Per-collateral config (`MAINNET_COLLATERALS` / `TESTNET_COLLATERALS` keyed by `CollateralAsset`), Pyth feed IDs (`PYTH_PRICE_FEED_IDS` for mainnet, `PYTH_TESTNET_FEED_IDS`), permission constants. Most legacy base-token witnesses are `market_symbol::<SYM>_USD` under `MARKET_SYMBOL`; the 200K-tier batch lives under `MARKET_SYMBOL_V2` and the **FX pairs split** (`EUR_USD`, `USD_JPY` — not `EURUSD_USD` / `USDJPY_USD`), with feed keys `"EUR/USD"` and `"USD/JPY"`. xStock Pyth feeds use `Crypto.*X/USD` (24/7 synthetic) on mainnet, NOT `Equity.US.*/USD` (market-hours only). **Price helpers**: `FLOAT_SCALE` (1e9), `rawPrice(usd)` converts human-readable USD to 1e9-scaled bigint for `Float` params (`triggerPrice`, `acceptablePrice`, `size`).
- **user/** — Transaction builders. Each takes `(client, tx, params)` and uses **generated moveCall wrappers** from `generated/` (not raw `tx.moveCall`). All `waterx_perp` / `bucket_v2_framework` / `bucket_v2_oracle` / `reward_distributor` calls use generated wrappers; only external packages (Pyth, Wormhole) use raw `tx.moveCall`.
- **fetch.ts** — Read-only queries via simulateTransaction + BCS return-value parsing. Functions listed below under "View / Query Functions".
- **tx-builders.ts** — High-level builders that handle oracle feeds automatically (Pyth-only). Return ready-to-sign `Transaction`. All builders accept optional `tx?: Transaction` to append to an existing PTB (gas budget only set when creating a new tx), `collateral?: CollateralAsset` (default `"USDC"`), and `updatePythPrice?: boolean` (opt-in Hermes REST update before feeding Pyth on-chain). Pyth on-chain price is always fed via `pyth_rule::feed<T>()`. `buildOpenPositionTx` / `buildPlaceOrderTx` require either `size` (exact) or `approxPrice` (for leverage-based calculation); omitting both throws. `buildOpenPositionTx` supports `takeProfit` / `stopLoss` params to place linked reduce-only TP/SL orders in the same PTB. `buildPlaceOrderTx` skips TTO coin fetch when `collateralAmount` is 0 (TP/SL), preventing double-receive in multi-order PTBs. `buildCancelOrderTx` defaults to `orderTypeTag: 255` (wildcard scan all 4 books by `orderId`) and `triggerPriceKey: 0` — callers only need `orderId`. `buildMintWlpTx` / `buildMintAndStakeWlpTx` / `buildRequestRedeemWlpTx` / `buildSettleRedeemWlpTx` refresh **every** pool collateral (`lp_pool::update_token_value` per token) before the mint/redeem/settle call to satisfy `assert_prices_fresh`. `buildCancelRedeemWlpTx` cancels the redeem and re-stakes the recovered WLP into the reward distributor atomically. Price conversion: `triggerPrice` and `acceptablePrice` in builder params accept human-readable USD — internally scaled via `rawPrice()` to 1e9. Network→feed ID mapping is explicit via `PYTH_FEED_IDS_BY_NETWORK: Record<Network, ...>`.
- **utils/pyth.ts** — Pyth oracle helpers: `updatePythPrices()` fetches from Hermes, `feedPythRule()` feeds a single token into a `PriceCollector`. `PythCache` class for caching. No dependency on `@pythnetwork/pyth-sui-js` — uses direct Hermes REST + generated Move calls.
- **utils/receiving.ts** — `buildReceivingVector()` and `CoinForReceiving` type. Shared helper used by `trading.ts`, `order.ts`, and `tx-builders.ts`.
- **generated/** — Auto-generated BCS structs and typed moveCall helpers from `sui-ts-codegen`. Config: `sui-codegen.config.mjs`. Paths point at `waterx-contracts/{waterx_perp,bucket_framework,bucket_oracle,reward_distributor}`.
- **scripts/** — Admin setup + ops scripts (see "Admin Scripts" below).

### Transaction Builders (src/user/)

- **trading.ts**: `openPosition` (supports `takeProfit` / `stopLoss`), `closePosition`, `increasePosition`, `decreasePosition`, `depositCollateral`, `withdrawCollateral`, `liquidate`, `matchOrders`, `updateFundingRate`, `executeTradingRequest`, `destroyTradingResponse`
- **order.ts**: `placeOrder`, `cancelOrder`
- **wlp.ts**: `mintWlp` (requires `priceResult`), `requestRedeemWlp` (takes `globalConfig` + `recipient`), `cancelRedeemWlp` (returns `Coin<WLP>` for composability; accepts optional `bucketAccount`), `settleRedeemWlp` (requires `priceResult`)
- **account.ts**: `createAccount` (accepts string `name` or `{ name, bucketAccount? }` for external Account identity), `transferToAccount` (validates account via `transfer_coin`), `receiveCoin` (takes `coins: [{objectId, version, digest}]` + optional `amount?`), `addDelegate` / `removeDelegate` / `updateDelegatePermissions` (all build `AccountRequest`)
- **referral.ts**: `setReferralCode`, `useReferralCode` (both build `AccountRequest`)
- **reward-distributor.ts**: `stakeRewardDistributor`, `unstakeRewardDistributor`, `redeemRewardDistributorCoin`, `claimRewardDistributor` — all accept optional `bucketAccount?: string | TransactionArgument` to toggle between `account::request(ctx)` and `account::request_with_account(&Account)` identities. Identities must match across the stake/redeem/claim of the same position.

### View / Query Functions (src/fetch.ts)

- **Account**: `getAccountsByOwner(client, owner)` (returns `AccountData[]` with delegates inlined), `getAccountDelegates(client, owner, accountId)`, `getAccountObjectId(client, owner, accountId)`, `getAccountPositionIdsByMarket`, `getAccountCoins`, `getAccountBalance`, `selectCoinsForAmount`
- **Market**: `getMarketSummary(client, marketId, baseTokenType, lpTokenType?)` → `MarketData`; `getMarketCooldownMs`
- **Pool**: `getPoolSummary(client)` → `PoolData`; `getTokenPoolSummary(client, tokenIndex)` → `TokenPoolData`
- **Position**: `getPosition(client, marketId, positionId, baseTokenType, lpTokenType?, basePriceUsd?, collateralPriceUsd?)` → `PositionDataView`; `positionExists`
- **Enriched (paginated / multi-market)**:
  - `getAccountPositions(client, base, account, basePriceUsd, collateralPriceUsd?)` → `PositionDataView[]`
  - `getAllAccountPositions(client, account, prices, collateralPriceUsd?)` — single PTB across markets with prices
  - `getAccountOrders(client, base, account)` → `OrderDataView[]`
  - `getAllAccountOrders(client, account)` — single PTB all markets
  - `getMarketPositions(client, base, basePriceUsd, cursor?, pageSize?, collateralPriceUsd?)` → `{ positions, nextCursor? }`
  - `getMarketOrders(client, base, basePriceUsd?, cursor?, pageSize?)` → `{ orders, nextCursor? }` (v2: simulate-based via `view::get_market_orders`; the v1 JSON parser path was removed)
  - `getRedeemRequests(client, cursor?, pageSize?, lpTokenType?)` → `{ requests: RedeemRequestDataView[], nextCursor? }` — paginated pending-WLP-redeem queue via `view::get_redeem_requests<LP_TOKEN>`
- **Reward distributor**: `calculateRewardDistributorIncentive`, `calculateRewardDistributorApr`, `getRewardDistributorStakeData`

### Generated Types (src/generated/)

Generated by `sui-ts-codegen` (v0.8.3) from Move package summaries. Config: `sui-codegen.config.mjs`. Covers four packages: `waterx_perp`, `bucket_v2_framework`, `bucket_v2_oracle`, `reward_distributor`.

- **BCS structs**: `Position`, `Order`, `Market`, `MarketConfig`, `Float`, `Double`, `PriceResult`, and all v2 view structs — `AccountData`, `DelegateData`, `MarketData`, `PoolData`, `TokenPoolData`, `PositionData`, `OrderData`, `RedeemRequestData`, `GlobalConfigData` — via `MoveStruct` class with `.parse()` for deserialization.
- **Typed moveCall helpers**: `accountData()`, `marketData()`, `positionData()`, `orderData()`, `getMarketOrders()`, `getAccountPositions()`, `getRedeemRequests()`, `account.request()`, `account.requestWithAccount()`, `float.fromScaledVal()`, `collector._new()`, `aggregator.aggregate()`, `lpPool.updateTokenValue()`, etc.

Note: `deps/sui/vec_set.ts` and `linked_table.ts` require manual `: MoveStruct<any, any>` return-type annotations after codegen (TS2742 workaround for pnpm). `scripts/fix-generated-imports.ts` runs post-codegen to normalize imports.

### v1 → v2 compat aliases

Source-level aliases keep most v1 callers compiling under v2 (all marked `@deprecated`):

- **Type aliases** (in `src/view-types.ts` + re-exported from `src/index.ts`): `AccountInfo` → `AccountData`, `DelegateDetail` → `DelegateData`, `MarketSummary` → `MarketData`, `PoolSummary` → `PoolData`, `TokenPoolSummary` → `TokenPoolData`, `PositionInfoView` → `PositionDataView`.
- **BCS exports** (re-exported from `src/index.ts` under both names): `AccountInfoBcs` / `DelegateDetailBcs` / `MarketSummaryBcs` / `PoolSummaryBcs` / `TokenPoolSummaryBcs` / `PositionInfoBcs` resolve to the v2 BCS structs.
- **`WaterXConfig` USDC aliases**: `usdcAggregator` / `usdcPriceInfoId` / `usdcType` are kept and populated from `collaterals.USDC.*` by `createTestnetConfig` / `createMainnetConfig`.
- **`receiveCoin` v1 single-coin shape** (`coinObjectId` / `coinVersion` / `coinDigest`): normalized into the v2 `coins: [{…}]` array internally.

Things that **cannot** be aliased and still require code changes: Move-side function/struct renames (`view::market_summary` → `view::market_data`, BCS struct names), removed module-level `PERP_PACKAGE_ID` / `SUPRA_*`, Supra config fields, `getAccountObjectId(client, owner, accountId)` 3-arg signature, `getMarketOrders` return shape (`{ orders, nextCursor? }`), `await` on the now-async WLP builders, and event field renames (`size_amount` → `size`).

### Multi-Collateral Support

`CollateralAsset = "USDC" | "USDSUI"`. All tx-builders accept optional `collateral?: CollateralAsset` (defaults to `"USDC"`). Config in `TESTNET_COLLATERALS` / `MAINNET_COLLATERALS` maps each collateral to `{ type, aggregatorId, priceInfoId, feedKey }`. Mainnet USDSUI uses a dedicated `USDSUI/USD` Pyth feed; testnet falls back to the USDC feed (~$1 peg).

Client helpers: `client.getBaseAssets()` and `client.getCollateralAssets()` return `{ asset, coinType }[]`.

All trading functions accept a **separate `collateral_price_result: &PriceResult<C_TOKEN>`**. Collateral pricing is distinct from the base token.

### TTO (Transfer-to-Object) Pattern

User accounts own coins via Sui's Transfer-to-Object. The SDK never uses raw `tx.transferObjects` for account-owned coins — all coin flows go through on-chain validated functions:

- **`transfer_coin<T>(registry, account_id, coin)`** — validates account exists; destroys zero coins. Used by `transferToAccount()` and after `execute()` for change coins.
- **`receive_coin_with_amount<T>(registry, sender_request, account_id, to_receives, amount_opt)`** — merges multiple TTO coins, splits amount (or all if `none`), returns remainder to account. Requires `PERM_WITHDRAW`.
- **`receive_coin_with_amount_to<T>(..., recipient)`** — same but transfers output to `recipient`. Used by `buildReceiveCoinTx`.
- **`receive_and_merge_internal<T>`** — package-internal, used by trading request creators to pull collateral coins from TTO.
- **`mint_wlp_to<LP, T>(..., recipient)`** — mints WLP and transfers to `recipient` in one Move call.
- **`buildReceivingVector()`** in `utils/receiving.ts` — shared helper to build `vector<Receiving<Coin<T>>>` from coin metadata.

### Oracle System (Pyth only in v2)

Single-source oracle via `bucket_v2_oracle::PriceAggregator` with `pyth_rule` as the only feeder.

- **Pyth** (`pyth_rule`): Pull oracle. SDK calls `pyth_rule::feed<T>()` to feed the on-chain `PriceInfoObject`. Hermes REST update is opt-in via `updatePythPrice` in tx-builders (off by default). The contract's per-type tolerance check in `pyth_rule::feed` filters stale prices on a per-rule basis; `lp_pool::assert_prices_fresh` additionally enforces `GlobalConfig.price_refresh_threshold_ms` on every pool token's `last_price_refresh_timestamp`. Testnet uses Hermes Beta with **different feed IDs** than mainnet. **xStock feeds**: mainnet uses `Crypto.*X/USD` Pyth feeds (24/7 synthetic), NOT `Equity.US.*/USD` (market-hours only). The Pyth package ID is resolved dynamically from `PythState`; mainnet stable-channel state is `0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8` (package `0x8d97f1...`).
- **pyth_sponsor_rule**: a `PythSponsor` can pay the PTB's Pyth update fee for users and contributes a `PythSponsorRule` witness on the `TradingRequest`. Mainnet `PYTH_SPONSOR_RULE` package and `PYTH_SPONSOR` shared object are configured in `MAINNET_PACKAGE_IDS` / `MAINNET_OBJECTS`.

Each `PriceAggregator<T>` has `PythRule` set via `set_rule_weight<T, PythRule>` with weight ≥ threshold. Aggregation: `aggregator::aggregate(collector)` produces `PriceResult<T>` weighted by rule.

SDK flow in `tx-builders.ts`: `buildOracleFeed(client, tx, tokenType, aggregatorId, priceInfoObjectId)` creates a collector, feeds Pyth (optionally preceded by Hermes update), then aggregates.

> **Legacy Supra**: dropped in v2. The SDK has no `utils/supra.ts` and no `supraRule*` / `supraOracleHolder` config fields. `scripts/clear-supra-weights.sh` removes the stale `SupraRule` weight from any v1-era collateral aggregators.

## Contract Packages

| Package              | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| `waterx_perp`        | Core protocol (trading, positions, markets, pool, accounts, view)                |
| `market_symbol`      | Base-token witness structs: `BTC_USD`, `ETH_USD`, …, `TSLAX_USD` (one per pair)  |
| `reward_distributor` | Reward vault using `AccountRequest` + `Double` precision (staking rewards)       |
| `bucket_framework`   | v2 framework primitives (`Float`, `Double`, `Account`, `AccountRequest`, `Sheet`) |
| `bucket_oracle`      | v2 oracle (`PriceAggregator`, `PriceResult`, `PriceCollector`)                    |
| `pyth_rule`          | Pyth oracle rule (pull oracle, Hermes REST)                                      |
| `pyth_sponsor_rule`  | (optional) Sponsor Pyth update fees; adds `PythSponsorRule` witness to requests  |
| `wlp`                | WLP LP token (OTW + pool creation via `lp_pool::create_pool`)                    |
| `mock_usdc`          | Mock USDC for testnet                                                            |
| `mock_usdsui`        | Mock USDSUI stablecoin for testnet                                               |

## Supported Markets

28 mainnet markets in five groups (testnet has only the 13 legacy markets). Base-token witness is `market_symbol::<SYM>_USD` under `MAINNET_PACKAGE_IDS.MARKET_SYMBOL` (legacy 13) or `MAINNET_PACKAGE_IDS.MARKET_SYMBOL_V2` (200K-tier 15). FX pairs use the split form (`EUR_USD`, `USD_JPY`). Size precision is uniform (`Float`, 1e9-scaled `u128` internally).

**Legacy 13** (`LegacyBaseAsset` — both networks; base fee 0.03%, default funding/cooldown):

| Group | Asset | Max Leverage |
| ----- | ----- | ------------ |
| Crypto | BTC, ETH, SOL, SUI, DEEP, WAL | 50x |
| xStock | AAPLX, GOOGLX, METAX, NVDAX, QQQX, SPYX, TSLAX | 10x |

**200K-tier 15** (`ExtendedBaseAsset` — mainnet only, created in tx [9wFypA7…rDooa](https://suiscan.xyz/mainnet/tx/9wFypA7ujpm4z8mDKxsWEz5FAU34z8gVVYasWqzrDooa); base fee 0.10%, `min_coll_value` $3, `cooldown_ms` 5000, `basic_funding_rate_bps` 7):

| Group | Asset | Max Leverage |
| ----- | ----- | ------------ |
| Crypto | HYPE | 25x |
| Crypto | XRP, ZEC | 20x |
| Crypto | BNB | 25x |
| xStock | MSTRX, COINX, HOODX, CRCLX, NFLXX | 10x |
| Commodity | XAUT | 30x |
| Commodity | XAG | 20x |
| Commodity | WTI, BRENT | 15x |
| FX | EURUSD, USDJPY | 50x |

Market creation parameters: legacy 13 in `MARKET_DEFINITIONS` (keyed by `LegacyBaseAsset`), 200K-tier 15 in `MARKETS_200K_DEFINITIONS` (sourced from `scripts/markets-200k-0.csv`) — both in `scripts/market-params.ts`. Per-market object IDs, base types, aggregator IDs, and `priceInfoId`s are in `MAINNET_MARKETS` / `TESTNET_MARKETS` (`src/constants.ts`).

### Trading Fee Structure

Total trading fee = **base fee + impact fee**.

- **Base fee**: `trading_fee_bps` from `MarketConfig` (per-market, admin-configurable).
- **Impact fee**: Dynamic fee based on how much the trade increases net LP exposure. Computed by `calculate_impact_fee_bps()` in `trading.move`. Capped at `max_impact_fee_bps`, quadratic-ish curve based on LP exposure change. Four **struct fields** on `MarketConfig` (v2 change — were module constants in v1): `max_impact_fee_bps`, `allocated_lp_exposure_bps`, `impact_fee_curvature`, `impact_fee_scale`.
- **Liquidation fees**: Insurance fee = bps of position notional (not remaining collateral). Keeper fee defaults to 0. Liquidation routes remaining collateral to WLP pool (no protocol fee split on liquidation).

### Upgrade Compatibility

When adding new per-market / per-pool configuration, use **module constants with accessor functions** rather than adding fields to published structs (`MarketConfig`, `WlpPool`, `GlobalConfig`). Sui Move does not allow adding fields to existing structs during package upgrades. Pattern:

```move
const MY_NEW_PARAM: u64 = 100;
public use fun market_config_my_new_param as MarketConfig.my_new_param;
public fun market_config_my_new_param<T>(_m: &MarketConfig<T>): u64 { MY_NEW_PARAM }
```

Do not change public function signatures in upgrades.

## Key Constants

### Permission Bitmasks (`u16`, matches Move values)

| Constant                   | Value | Description                        |
| -------------------------- | ----- | ---------------------------------- |
| `PERM_OPEN_POSITION`       | 1     | Open new position                  |
| `PERM_CLOSE_POSITION`      | 2     | Close position                     |
| `PERM_PLACE_ORDER`         | 4     | Place limit/stop orders            |
| `PERM_CANCEL_ORDER`        | 8     | Cancel orders                      |
| `PERM_INCREASE_COLLATERAL` | 16    | Deposit collateral                 |
| `PERM_RELEASE_COLLATERAL`  | 32    | Withdraw collateral                |
| `PERM_DEPOSIT`             | 64    | Deposit tokens into account        |
| `PERM_WITHDRAW`            | 128   | Withdraw tokens from account       |
| `PERM_TRANSFER`            | 256   | Transfer between own accounts      |
| `PERM_MINT_WLP`            | 512   | Mint WLP (LP deposit)              |
| `PERM_REDEEM_WLP`          | 1024  | Redeem WLP (LP withdraw)           |
| `PERM_MANAGE_DELEGATES`    | 2048  | Add/remove delegates               |
| `PERM_ALL_TRADING`         | 63    | All trading permissions (bits 0-5) |
| `PERM_ALL`                 | 4095  | All permissions                    |

### Order Types

- `ORDER_LIMIT_BUY (0)`, `ORDER_LIMIT_SELL (1)`, `ORDER_STOP_BUY (2)`, `ORDER_STOP_SELL (3)`

Order storage keys are normalized `u128` scaled values derived from `MarketConfig.order_price_tick` via `normalize_trigger_price()`; `cancel_order_request` accepts `order_type_tag == 255` as a wildcard (scans all 4 books).

### UserAccount object address

Account IDs are Sui object IDs (`ID` type / 32-byte address), not `u64`.

## Admin Scripts (scripts/)

All setup scripts are admin-gated and assume `sui client active-address` owns the `AdminCap` and/or `ListingCap`.

| Script | Purpose |
| ------ | ------- |
| `setup-markets.sh` | One PTB per market_symbol: `aggregator::new` + `set_rule_weight<T, PythRule>` + share + `pyth_rule::set_identifier` + `trading::create_market` + share. Re-runnable per row. |
| `setup-collateral-aggregators.sh` | Creates `PriceAggregator` + `set_rule_weight` + share + `set_identifier` for collateral tokens (USDC, USDSUI). Pipe-delimited entries to avoid `::` conflicts. |
| `setup-pyth-identifier.sh` | Updates `pyth_rule::set_identifier` only (no aggregator creation). Used when switching Pyth feed IDs (e.g. Equity→Crypto xStock feeds). |
| `setup-wlp-tokens.sh` | Registers USDC + USDSUI as WLP deposit tokens via `lp_pool::add_token` (stablecoin defaults). |
| `clear-supra-weights.sh` | Drops the legacy `SupraRule` weight from the USDC + USDSUI `PriceAggregator`s (Pyth-only in v2). |
| `create-markets.ts` | One PTB that bundles aggregator setup + Pyth identifier + `trading::create_market` for all 15 200K-tier markets. Defaults to mainnet, uses `SuiGrpcClient`. Does **not** sign — outputs unsigned tx bytes (base64) on stdout for CLI signing (`sui keytool sign` + `sui client execute-signed-tx`). Sender comes from `SUI_SENDER` env or `sui client active-address`. |
| `merge-coins.ts` | Builds a PTB that merges every coin of a given `COIN_TYPE` owned by the sender into one. Pages `client.core.listCoins` (50/page, capped at `MAX` env, default 1000). For SUI, pins `coins[0]` as `setGasPayment` and merges the rest into `tx.gas` to avoid gas-vs-merge collision; for other types, merges `coins[1..]` into `coins[0]`. Outputs unsigned base64 like `create-markets.ts`. |
| `test-new-markets-open.ts` | Mainnet simulate-only smoke test: builds `buildOpenPositionTx` for each `ExtendedBaseAsset`, runs `client.simulate(tx)`, and classifies failures as `OK-AT-ORACLE` (account-side abort, oracle wiring fine) vs `ORACLE-FAIL` (Pyth/aggregator/market_symbol problem). Useful regression check after touching `MAINNET_MARKETS` or oracle config. |
| `market-params.ts` | v2 schema: `minCollValue`, `u128` OI, no `lot_size` / `size_decimal`. Exports `MARKET_DEFINITIONS` (legacy 13) and `MARKETS_200K_DEFINITIONS` (200K-tier 15, sourced from `scripts/markets-200k-0.csv`). |
| `setup-pyth-tolerance.sh` | Sets `pyth_rule::set_tolerance_sec<T>` per token type (crypto=310s, xStock=310s, stables=large). |
| `set-min-coll-value.sh` | Sets `min_coll_value` on every market via `trading::update_market_config<B, WLP>`. |
| `setup-keepers.ts` | Adds keeper addresses to `GlobalConfig`. |
| `update-pyth-prices.ts` | Refreshes on-chain Pyth prices via Hermes for all configured feeds before running e2e / integration tests. |
| `print-oracle-aggregates.ts` | Dry-runs oracle feed + aggregate for all markets/collaterals. Supports `--mainnet` flag (default testnet). |
| `e2e-preflight.ts` / `e2e-prepare.ts` / `bootstrap-e2e-lifecycle-positions.ts` | E2E bring-up and fixture management. |

## Naming Conventions

- **Move**: snake_case modules/functions, PascalCase structs, SCREAMING_SNAKE_CASE constants, type params like `C_TOKEN`, `BASE_TOKEN`, `LP_TOKEN`.
- **SDK**: camelCase functions, PascalCase interfaces/types.
- **Base-token types**: `market_symbol::<SYM>_USD` witness structs (e.g. `BTC_USD`, `AAPLX_USD`). Never `waterx_coins::WATERX_*` — those are legacy.
- **Naming in BCS**: snake_case on the Move / wire side (`account_object_address`, `size`, `linked_order_ids`); SDK types convert to camelCase (`accountObjectAddress`, `size`, `linkedOrderIds`).
