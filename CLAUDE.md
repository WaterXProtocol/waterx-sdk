# CLAUDE.md

Guidance for Claude Code when working in `waterx-sdk` (v3).

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
`src/config.ts` mirror that schema 1:1, snake_case included.

External chain infra (Pyth state, Wormhole state, Hermes endpoint) is
**not** in the JSON — it lives in `PYTH_DEFAULTS[network]` (`src/config.ts`)
and is exposed on `client.pyth`. Override per-deployment by setting
`pyth` on the JSON if you ever need to.

The client is **async**:

```ts
import { WaterXClient } from "@waterx/perp-sdk";

const client = await WaterXClient.create("TESTNET");
// override URL / gRPC:
const c2 = await WaterXClient.create("MAINNET", {
  configUrl: "https://my.cdn/main/mainnet.json",
  grpcUrl: "https://my-fullnode/",
  cache: true, // optional in-process cache, default off
});

// Canonical-schema lookups:
client.config.packages.waterx_perp.global_config;       // shared GlobalConfig
client.config.packages.waterx_perp.markets["BTCUSD"];   // { market, config }
client.config.packages.wlp.pool_tokens["USDCUSD"];      // pool token Move type
client.getMarket("BTCUSD");                              // throwing helper
client.getPythFeed("BTCUSD");                            // { feed_id, price_info_object }
client.wlpType();                                        // `${wlp.original_id}::wlp::WLP`
client.pyth.state_id;                                    // network default
```

`src/constants.ts` only holds enums (`Network`, `PERM_*`, `ORDER_*`,
`ACTION_*`, `FLOAT_SCALE`, `rawPrice(usd)`, `SENDER`, `CLOCK`).

## Development Commands

```bash
pnpm install
pnpm build           # rm dist, tsc -p tsconfig.build.json, tsc-alias
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint + prettier --check
pnpm lint:fix        # eslint --fix
pnpm format          # prettier --write
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

`utils/pyth.ts::refreshOraclePrices(tx, client, tickers, opts?)` does
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

- **`config.ts`** — `WaterXConfig` schema, `loadConfig()`, `defaultConfigUrl()`, `clearConfigCache()`.
- **`client.ts`** — `WaterXClient` with async `static create(network, opts)`. Holds the resolved config + `SuiGrpcClient`. Exposes `getMarket(symbol)`, `getCollateral(symbol)`, `getPythFeedId(feedKey)`.
- **`constants.ts`** — enums / permission bitmasks / order tags / action codes / `FLOAT_SCALE` / `rawPrice(usd)`. **Nothing chain-specific.**
- **`user/`** — low-level builders (one moveCall per file):
  - `account.ts` — wxa account: `createAccount`, `setAlias`, delegate management, `requestDeposit`, `requestWithdraw`, `transferToAccount`.
  - `trading.ts` — `closePositionRequest`, `increasePositionRequest`, `decreasePositionRequest`, `depositCollateralRequest`, `withdrawCollateralRequest`, `executeTrading`, keepers (`liquidate`, `batchLiquidate`, `matchOrders`, `updateFundingRate`, `openPositionByKeeper`, `closePositionByKeeper`).
  - `order.ts` — `buildPlaceOrderArgument`, `placeOrderRequest`, `cancelOrderRequest`, `updateOrderRequest`, `cancelPreOrderRequest`, `addPreOrderRequest`.
  - `wlp.ts` — `mintWlp`, `requestRedeemWlp`, `cancelRedeemWlp`, `settleRedeemWlp`, `updateTokenValue`.
  - `staking.ts` — `stake`, `unstake`, `claimReward` (with rewarder settle/destroy checker plumbing).
  - `referral.ts` — **stub**: contract has no `referral_table` module anymore; functions throw `removed in v3`.
- **`fetch.ts`** — read-only `simulate`-based queries via `waterx_perp_view`. Returns parsed BCS structs (`PositionDataView`, `MarketDataView`, etc.).
- **`tx-builders.ts`** — high-level `build*Tx` wrappers that compose oracle refresh + `*Request` + `executeTrading`. Each accepts `tx?`, `updatePythPrice`, `pythCache`, `sponsorFund`.
- **`utils/pyth.ts`** — Hermes REST, on-chain Pyth update PTB, `aggregateTickerWithPyth`, `refreshOraclePrices`. The single source of truth for oracle freshness.
- **`generated/`** — `sui-ts-codegen` output for the 9 packages in `sui-codegen.config.mjs`. Never hand-edit; rerun `pnpm codegen` after Move ABI changes. `scripts/fix-generated-imports.ts` normalizes paths post-codegen.

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
