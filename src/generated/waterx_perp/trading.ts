/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Core trading engine for WaterX Perp DEX.
 * 
 * User-side path uses a hot-potato `TradingRequest<C_TOKEN>` (no abilities),
 * consumed in the same PTB by `trading::execute`. `execute` does the work inline
 * and returns `()` — user payouts route through `wxa_account::put`, not back out
 * as a `Coin<C_TOKEN>`.
 * 
 * PTB flow:
 * 
 * 1.  let request = trading::place_order_request(...);
 * 2.  // External rules add witnesses: my_rule::check(&mut request, ...);
 * 3.  trading::execute(global_config, wxa_registry, market_registry, ticker, pool,
 *     request, oracle, clock, ctx);
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as market_config from './market_config.ts';
import * as keyed_big_vector from './keyed_big_vector.ts';
import * as order_book from './order_book.ts';
import * as order_book_1 from './order_book.ts';
import * as order_book_2 from './order_book.ts';
import * as order_book_3 from './order_book.ts';
import * as keyed_big_vector_1 from './keyed_big_vector.ts';
import * as keyed_big_vector_2 from './keyed_big_vector.ts';
import * as vec_set from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/perp::trading';
export const Market = new MoveStruct({ name: `${$moduleName}::Market<phantom LP_TOKEN>`, fields: {
        id: bcs.Address,
        /** Per-market configuration and state. */
        config: market_config.MarketConfig,
        /** Positions indexed by position_id. */
        positions: keyed_big_vector.KeyedBigVector,
        /** Limit buy orders: price_key → vector<Order> */
        limit_buys: order_book.OrderBook,
        /** Limit sell orders: price_key → vector<Order> */
        limit_sells: order_book_1.OrderBook,
        /** Stop buy orders: price_key → vector<Order> */
        stop_buys: order_book_2.OrderBook,
        /** Stop sell orders: price_key → vector<Order> */
        stop_sells: order_book_3.OrderBook,
        /**
         * Reserved TP / SL pre-orders, keyed by the **pre-order's own `order_id`** (not
         * the main order's id). Each entry is a single fully-formed reduce-only `Order`
         * with `linked_position_id =  None`; on main fill `activate_pending_pre_orders`
         * stamps in the new position id and moves the order onto the live book.
         */
        pending_pre_orders: keyed_big_vector_1.KeyedBigVector,
        /**
         * Secondary index: `main_order_id → vector<pre_order_id>` listing the pre-orders
         * reserved against each unfilled main. Used by activation / cancellation to
         * enumerate the pre-orders that belong to a given main.
         */
        pending_pre_order_index: keyed_big_vector_2.KeyedBigVector
    } });
export const MarketRegistry = new MoveStruct({ name: `${$moduleName}::MarketRegistry<phantom LP_TOKEN>`, fields: {
        id: bcs.Address,
        /** Allowed protocol versions (admin-managed). */
        allowed_versions: vec_set.VecSet(bcs.u16()),
        /** Tickers of registered markets, mirrored from the DOF for cheap iteration. */
        listed_tickers: bcs.vector(bcs.string())
    } });
export interface CreateMarketArguments {
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint>;
    minCollValue: RawTransactionArgument<number | bigint>;
    tradingFee: RawTransactionArgument<number | bigint>;
    maintenanceMargin: RawTransactionArgument<number | bigint>;
    maxLongOi: RawTransactionArgument<number | bigint>;
    maxShortOi: RawTransactionArgument<number | bigint>;
    cooldownMs: RawTransactionArgument<number | bigint>;
    basicFundingRate: RawTransactionArgument<number | bigint>;
    fundingIntervalMs: RawTransactionArgument<number | bigint>;
}
export interface CreateMarketOptions {
    package?: string;
    arguments: CreateMarketArguments | [
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint>,
        minCollValue: RawTransactionArgument<number | bigint>,
        tradingFee: RawTransactionArgument<number | bigint>,
        maintenanceMargin: RawTransactionArgument<number | bigint>,
        maxLongOi: RawTransactionArgument<number | bigint>,
        maxShortOi: RawTransactionArgument<number | bigint>,
        cooldownMs: RawTransactionArgument<number | bigint>,
        basicFundingRate: RawTransactionArgument<number | bigint>,
        fundingIntervalMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Creates a trading market with full configuration. `trading_fee`,
 * `maintenance_margin`, and `basic_funding_rate` are scaled Float values (1e9
 * scale). For example, a 5 bps fee = `500_000`.
 */
export function createMarket(options: CreateMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        'u64',
        'u64',
        'u128',
        'u128',
        'u128',
        'u128',
        'u64',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "symbol", "maxLeverageBps", "minCollValue", "tradingFee", "maintenanceMargin", "maxLongOi", "maxShortOi", "cooldownMs", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'create_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateMarketConfigArguments {
    marketRegistry: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint | null>;
    minCollValue: RawTransactionArgument<number | bigint | null>;
    tradingFee: RawTransactionArgument<number | bigint | null>;
    maxImpactFee: RawTransactionArgument<number | bigint | null>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>;
    impactFeeCurvature: RawTransactionArgument<number | bigint | null>;
    impactFeeScale: RawTransactionArgument<number | bigint | null>;
    maintenanceMargin: RawTransactionArgument<number | bigint | null>;
    maxLongOi: RawTransactionArgument<number | bigint | null>;
    maxShortOi: RawTransactionArgument<number | bigint | null>;
    cooldownMs: RawTransactionArgument<number | bigint | null>;
    orderPriceTick: RawTransactionArgument<number | bigint | null>;
    maxPreOrders: RawTransactionArgument<number | bigint | null>;
    basicFundingRate: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateMarketConfigOptions {
    package?: string;
    arguments: UpdateMarketConfigArguments | [
        marketRegistry: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint | null>,
        minCollValue: RawTransactionArgument<number | bigint | null>,
        tradingFee: RawTransactionArgument<number | bigint | null>,
        maxImpactFee: RawTransactionArgument<number | bigint | null>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>,
        impactFeeCurvature: RawTransactionArgument<number | bigint | null>,
        impactFeeScale: RawTransactionArgument<number | bigint | null>,
        maintenanceMargin: RawTransactionArgument<number | bigint | null>,
        maxLongOi: RawTransactionArgument<number | bigint | null>,
        maxShortOi: RawTransactionArgument<number | bigint | null>,
        cooldownMs: RawTransactionArgument<number | bigint | null>,
        orderPriceTick: RawTransactionArgument<number | bigint | null>,
        maxPreOrders: RawTransactionArgument<number | bigint | null>,
        basicFundingRate: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: forwards to `market_config::update_market_config` through the shared
 * `Market`. Needed because `MarketConfig` is embedded inside `Market` and can't be
 * borrowed mutably from a PTB directly. Funding parameters must be updated with
 * `update_market_funding_config` so accrued funding is settled under the old
 * parameters before the new parameters take effect.
 */
export function updateMarketConfig(options: UpdateMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "cap", "ticker", "maxLeverageBps", "minCollValue", "tradingFee", "maxImpactFee", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale", "maintenanceMargin", "maxLongOi", "maxShortOi", "cooldownMs", "orderPriceTick", "maxPreOrders", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateMarketFundingConfigArguments {
    globalConfig: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    basicFundingRate: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateMarketFundingConfigOptions {
    package?: string;
    arguments: UpdateMarketFundingConfigArguments | [
        globalConfig: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        basicFundingRate: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: settles accrued funding under the old funding parameters, then updates
 * funding parameters for future intervals.
 */
export function updateMarketFundingConfig(options: UpdateMarketFundingConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "cap", "marketRegistry", "ticker", "pool", "oracle", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_market_funding_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseMarketArguments {
    marketRegistry: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface PauseMarketOptions {
    package?: string;
    arguments: PauseMarketArguments | [
        marketRegistry: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Admin: suspend the market (halts trading). */
export function pauseMarket(options: PauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "cap", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'pause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnpauseMarketArguments {
    marketRegistry: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface UnpauseMarketOptions {
    package?: string;
    arguments: UnpauseMarketArguments | [
        marketRegistry: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Admin: resume the market. */
export function unpauseMarket(options: UnpauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "cap", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'unpause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddRequestRuleArguments {
    marketRegistry: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface AddRequestRuleOptions {
    package?: string;
    arguments: AddRequestRuleArguments | [
        marketRegistry: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Admin: add witness type `W` to the request checklist. */
export function addRequestRule(options: AddRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "cap", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'add_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveRequestRuleArguments {
    marketRegistry: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface RemoveRequestRuleOptions {
    package?: string;
    arguments: RemoveRequestRuleArguments | [
        marketRegistry: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Admin: remove witness type `W` from the request checklist. */
export function removeRequestRule(options: RemoveRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "cap", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'remove_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RegisterMarketAumArguments {
    marketRegistry: RawTransactionArgument<string>;
    aum: RawTransactionArgument<string>;
    cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
}
export interface RegisterMarketAumOptions {
    package?: string;
    arguments: RegisterMarketAumArguments | [
        marketRegistry: RawTransactionArgument<string>,
        aum: RawTransactionArgument<string>,
        cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Registers a market in the pool-level WLP AUM object. */
export function registerMarketAum(options: RegisterMarketAumOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "aum", "cap", "ticker", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'register_market_aum',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RefreshMarketAumArguments {
    marketRegistry: RawTransactionArgument<string>;
    aum: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
}
export interface RefreshMarketAumOptions {
    package?: string;
    arguments: RefreshMarketAumArguments | [
        marketRegistry: RawTransactionArgument<string>,
        aum: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Refreshes one registered market's contribution to pool-level WLP AUM. */
export function refreshMarketAum(options: RefreshMarketAumOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "aum", "ticker", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'refresh_market_aum',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertProtocolPermArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    permission: RawTransactionArgument<number>;
}
export interface AssertProtocolPermOptions {
    package?: string;
    arguments: AssertProtocolPermArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        permission: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Permission check on the wxa account for the trading entrypoints. Reads
 * `effective_protocol_permissions<TradingRequest<C_TOKEN>>` so per-collateral
 * granularity is preserved (`PERM_OPEN_POSITION` etc. are bits on that bitmap).
 * Must be called _before_ any `wxa_account::take` so a failed auth doesn't leave
 * the user drained.
 */
export function assertProtocolPerm(options: AssertProtocolPermOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u32',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "sender", "permission"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_protocol_perm',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClosePositionRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ClosePositionRequestOptions {
    package?: string;
    arguments: ClosePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a request to close a position. */
export function closePositionRequest(options: ClosePositionRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "positionId", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'close_position_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IncreasePositionRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint | null>;
    positionId: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface IncreasePositionRequestOptions {
    package?: string;
    arguments: IncreasePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint | null>,
        positionId: RawTransactionArgument<number | bigint>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a request to increase an existing position at market. */
export function increasePositionRequest(options: IncreasePositionRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        '0x1::option::Option<u64>',
        'u64',
        'u64',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "orderId", "positionId", "collateralAmount", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'increase_position_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DecreasePositionRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface DecreasePositionRequestOptions {
    package?: string;
    arguments: DecreasePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a request to partially reduce an existing position at market. */
export function decreasePositionRequest(options: DecreasePositionRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "positionId", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'decrease_position_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PlaceOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    main: RawTransactionArgument<string>;
    preOrder: RawTransactionArgument<string[]>;
}
export interface PlaceOrderRequestOptions {
    package?: string;
    arguments: PlaceOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        main: RawTransactionArgument<string>,
        preOrder: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a request to place a limit, stop, or market order, optionally with TP/SL
 * pre-orders reserved against the freshly opened position.
 *
 * `main: PlaceOrderArgument` describes the order that hits the book immediately.
 * `pre_order: vector<PlaceOrderArgument>` (length 0..=2) describes reduce-only
 * orders that will be promoted to real linked orders on the new position when the
 * main fills via `match_orders`.
 *
 * `main.trigger_price = None` is the market form: the order is parked at tick 0 in
 * the limit book and a keeper fills it via `match_orders` at the live oracle.
 * `acceptable_price` is carried on the order and consulted at match time — if the
 * oracle moves past it the order is cancelled and collateral refunded. Limit/stop
 * orders ignore `acceptable_price`.
 *
 * Validation runs _before_ the wxa take so a malformed request never drains the
 * user's balance.
 */
export function placeOrderRequest(options: PlaceOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        null,
        'vector<null>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "main", "preOrder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'place_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ValidatePreOrdersArguments {
    main: RawTransactionArgument<string>;
    preOrder: RawTransactionArgument<string[]>;
    maxPreOrders: RawTransactionArgument<number | bigint>;
}
export interface ValidatePreOrdersOptions {
    package?: string;
    arguments: ValidatePreOrdersArguments | [
        main: RawTransactionArgument<string>,
        preOrder: RawTransactionArgument<string[]>,
        maxPreOrders: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Validates `(main, pre_order)` at place-order request creation. Combines the
 * main-eligibility check (must be a fresh opening order), the count check against
 * the market-level cap, and per-entry structural rules.
 */
export function validatePreOrders(options: ValidatePreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'vector<null>',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["main", "preOrder", "maxPreOrders"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'validate_pre_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ValidatePreOrderEntriesArguments {
    mainIsLong: RawTransactionArgument<boolean>;
    preOrder: RawTransactionArgument<string[]>;
}
export interface ValidatePreOrderEntriesOptions {
    package?: string;
    arguments: ValidatePreOrderEntriesArguments | [
        mainIsLong: RawTransactionArgument<boolean>,
        preOrder: RawTransactionArgument<string[]>
    ];
}
/**
 * Per-entry structural validation only: reduce-only, real trigger, no collateral,
 * no pre-picked link target, opposite side of main, non-zero size. The total-count
 * check is the caller's responsibility (`assert_pre_order_count`) so this can be
 * reused from per-leg add / cancel paths.
 */
export function validatePreOrderEntries(options: ValidatePreOrderEntriesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool',
        'vector<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["mainIsLong", "preOrder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'validate_pre_order_entries',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertPreOrderCountArguments {
    newTotal: RawTransactionArgument<number | bigint>;
    maxPreOrders: RawTransactionArgument<number | bigint>;
}
export interface AssertPreOrderCountOptions {
    package?: string;
    arguments: AssertPreOrderCountArguments | [
        newTotal: RawTransactionArgument<number | bigint>,
        maxPreOrders: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Caps the **total** pre-orders reserved against a single main at the
 * market-config `max_pre_orders`. Aborts with `ETooManyPreOrders`.
 */
export function assertPreOrderCount(options: AssertPreOrderCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["newTotal", "maxPreOrders"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_pre_order_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CancelOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface CancelOrderRequestOptions {
    package?: string;
    arguments: CancelOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a request to cancel an order. `order_type_tag = 255` scans all 4 books
 * for the matching `order_id`. `trigger_price` is the scaled `Float` value; `0`
 * scans all trigger price buckets in the selected book(s).
 */
export function cancelOrderRequest(options: CancelOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u128',
        'u8',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "orderId", "triggerPrice", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'cancel_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    currentTriggerPrice: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
    newSize: RawTransactionArgument<number | bigint>;
    newTriggerPrice: RawTransactionArgument<number | bigint>;
}
export interface UpdateOrderRequestOptions {
    package?: string;
    arguments: UpdateOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        currentTriggerPrice: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>,
        newSize: RawTransactionArgument<number | bigint>,
        newTriggerPrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a request to update a live order's size and trigger price. The order
 * keeps its direction, reduce-only flag, linked position, collateral, and
 * limit/stop book. `order_type_tag = 255` and `current_trigger_price = 0` scan for
 * the current order location.
 */
export function updateOrderRequest(options: UpdateOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u128',
        'u8',
        'u128',
        'u128',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "orderId", "currentTriggerPrice", "orderTypeTag", "newSize", "newTriggerPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelPreOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    preOrderId: RawTransactionArgument<number | bigint>;
}
export interface CancelPreOrderRequestOptions {
    package?: string;
    arguments: CancelPreOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        preOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Cancels a single TP / SL pre-order reserved against an unfilled main.
 * `pre_order_id` is the pre-order's own `order_id`, returned in the `OrderCreated`
 * event when it activates (also enumerable from `pending_pre_order_index` keyed by
 * `main_order_id`). The pair must be consistent — i.e. `pre_order_id` must appear
 * in the index entry for `main_order_id`, otherwise the call aborts with
 * `EOrderNotFound`. Pre-orders never hold collateral, so this only adjusts
 * bookkeeping; no payout. Emits `PreOrderCancelled` with `pre_order_count = 1`.
 */
export function cancelPreOrderRequest(options: CancelPreOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "mainOrderId", "preOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'cancel_pre_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddPreOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    preOrder: RawTransactionArgument<string>;
}
export interface AddPreOrderRequestOptions {
    package?: string;
    arguments: AddPreOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        preOrder: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Adds one TP / SL pre-order to an unfilled main. The main must still be on the
 * book, owned by `account_id`, of collateral type `C_TOKEN`, and a fresh opening
 * order. The per-entry rules (`validate_pre_order_entries`) and the market-level
 * total cap (`market.config.max_pre_orders()`) are enforced — existing reserved
 *
 * - 1 must stay within cap.
 */
export function addPreOrderRequest(options: AddPreOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "mainOrderId", "preOrder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'add_pre_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositCollateralRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
}
export interface DepositCollateralRequestOptions {
    package?: string;
    arguments: DepositCollateralRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        collateralAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a request to deposit collateral on a position. */
export function depositCollateralRequest(options: DepositCollateralRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "positionId", "collateralAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'deposit_collateral_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawCollateralRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawCollateralRequestOptions {
    package?: string;
    arguments: WithdrawCollateralRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a request to withdraw collateral from a position. */
export function withdrawCollateralRequest(options: WithdrawCollateralRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        '0x2::object::ID',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "senderRequest", "accountId", "positionId", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'withdraw_collateral_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LiquidateArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    oracle: RawTransactionArgument<string>;
}
export interface LiquidateOptions {
    package?: string;
    arguments: LiquidateArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a request to liquidate a position (keeper only). Reads
 * account_object_address from the position directly. Keeper-only: liquidate an
 * undercollateralized position. Single-call — no `TradingRequest` hot potato to
 * manage.
 */
export function liquidate(options: LiquidateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "senderRequest", "positionId", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'liquidate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchLiquidateArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    pageSize: RawTransactionArgument<number | bigint>;
    pageIndex: RawTransactionArgument<number | bigint>;
}
export interface BatchLiquidateOptions {
    package?: string;
    arguments: BatchLiquidateArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        pageSize: RawTransactionArgument<number | bigint>,
        pageIndex: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Keeper-only: scans a page of positions and liquidates every liquidatable one.
 * Iterates positions by internal index `[page_index * page_size, ...)`. No-op if
 * the page is out of range or no positions qualify.
 */
export function batchLiquidate(options: BatchLiquidateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        null,
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "senderRequest", "oracle", "pageSize", "pageIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'batch_liquidate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
}
export interface ExecuteOptions {
    package?: string;
    arguments: ExecuteArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Executes a trading request. All `*_request` creators return raw
 * `TradingRequest<C>`; pass it straight to `execute` after attaching any witness
 * rules (e.g. `pyth_rule::feed(&mut req, ...)`). Used by both user happy paths and
 * keeper paths.
 */
export function execute(options: ExecuteOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "req", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteOpenPositionArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ExecuteOpenPositionOptions {
    package?: string;
    arguments: ExecuteOpenPositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeOpenPosition(options: ExecuteOpenPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64',
        'address',
        'address',
        null,
        'bool',
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountId", "orderId", "accountObjectAddress", "sender", "collateral", "isLong", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_open_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteIncreasePositionArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    collateral: RawTransactionArgument<string>;
    size: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ExecuteIncreasePositionOptions {
    package?: string;
    arguments: ExecuteIncreasePositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        collateral: RawTransactionArgument<string>,
        size: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeIncreasePosition(options: ExecuteIncreasePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        'u64',
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "oracle", "marketId", "accountObjectAddress", "orderId", "positionId", "collateral", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_increase_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteClosePositionArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ExecuteClosePositionOptions {
    package?: string;
    arguments: ExecuteClosePositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeClosePosition(options: ExecuteClosePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountId", "accountObjId", "orderId", "positionId", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_close_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteDecreasePositionArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    requestedSize: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ExecuteDecreasePositionOptions {
    package?: string;
    arguments: ExecuteDecreasePositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        requestedSize: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeDecreasePosition(options: ExecuteDecreasePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'u64',
        'u64',
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountId", "accountObjId", "orderId", "positionId", "requestedSize", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_decrease_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecutePlaceOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    preOrders: RawTransactionArgument<string[]>;
}
export interface ExecutePlaceOrderOptions {
    package?: string;
    arguments: ExecutePlaceOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        preOrders: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executePlaceOrder(options: ExecutePlaceOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        null,
        'bool',
        'bool',
        'bool',
        null,
        null,
        'u64',
        '0x1::option::Option<u64>',
        'vector<null>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountId", "accountObjectAddress", "collateral", "isLong", "isStopOrder", "reduceOnly", "size", "triggerPrice", "acceptablePrice", "linkedPositionId", "preOrders"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_place_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteCancelOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface ExecuteCancelOrderOptions {
    package?: string;
    arguments: ExecuteCancelOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeCancelOrder(options: ExecuteCancelOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'u64',
        'u128',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "marketId", "accountId", "accountObjId", "orderId", "triggerPriceKey", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_cancel_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteUpdateOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
    newSize: RawTransactionArgument<string>;
    newTriggerPrice: RawTransactionArgument<string>;
}
export interface ExecuteUpdateOrderOptions {
    package?: string;
    arguments: ExecuteUpdateOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>,
        newSize: RawTransactionArgument<string>,
        newTriggerPrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeUpdateOrder(options: ExecuteUpdateOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        'u128',
        'u8',
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "oracle", "marketId", "accountObjectAddress", "orderId", "triggerPriceKey", "orderTypeTag", "newSize", "newTriggerPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_update_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteCancelPreOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    preOrderId: RawTransactionArgument<number | bigint>;
}
export interface ExecuteCancelPreOrderOptions {
    package?: string;
    arguments: ExecuteCancelPreOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        preOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Cancels a single pre-order by id. Validates ownership / collateral type on the
 * reserved `Order`, then verifies `pre_order_id` actually belongs to
 * `main_order_id` via the index. Destroys the `Order` through
 * `position::remove_order<C_TOKEN>` and emits
 * `PreOrderCancelled { main_order_id, pre_order_count: 1 }`.
 */
export function executeCancelPreOrder(options: ExecuteCancelPreOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "marketId", "accountObjectAddress", "mainOrderId", "preOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_cancel_pre_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteAddPreOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    newPreOrder: RawTransactionArgument<string[]>;
}
export interface ExecuteAddPreOrderOptions {
    package?: string;
    arguments: ExecuteAddPreOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        newPreOrder: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Appends a single pre-order to an existing or empty reservation for
 * `main_order_id`. Locates the main on a book, verifies eligibility, then
 * `assert_pre_order_count(existing + 1, cap)` and per-entry validation before
 * delegating to `reserve_pre_orders`.
 */
export function executeAddPreOrder(options: ExecuteAddPreOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        'vector<null>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "marketId", "accountObjectAddress", "mainOrderId", "newPreOrder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_add_pre_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteDepositCollateralArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    collateral: RawTransactionArgument<string>;
}
export interface ExecuteDepositCollateralOptions {
    package?: string;
    arguments: ExecuteDepositCollateralArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        collateral: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeDepositCollateral(options: ExecuteDepositCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "oracle", "marketId", "accountObjectAddress", "positionId", "collateral"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_deposit_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteWithdrawCollateralArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface ExecuteWithdrawCollateralOptions {
    package?: string;
    arguments: ExecuteWithdrawCollateralArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeWithdrawCollateral(options: ExecuteWithdrawCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountObjId", "positionId", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_withdraw_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindBestTriggerableSlArguments {
    market: RawTransactionArgument<string>;
    position: RawTransactionArgument<string>;
    oraclePrice: RawTransactionArgument<string>;
}
export interface FindBestTriggerableSlOptions {
    package?: string;
    arguments: FindBestTriggerableSlArguments | [
        market: RawTransactionArgument<string>,
        position: RawTransactionArgument<string>,
        oraclePrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Scans the position's linked orders for opposite-side reduce-only stop orders
 * (stop-loss legs) that would have triggered at the current oracle price, and
 * returns the order id and trigger price of the one most favourable to the user
 * (highest trigger for a long position, lowest trigger for a short position).
 */
export function findBestTriggerableSl(options: FindBestTriggerableSlOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market", "position", "oraclePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'find_best_triggerable_sl',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteLiquidateArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface ExecuteLiquidateOptions {
    package?: string;
    arguments: ExecuteLiquidateArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function executeLiquidate(options: ExecuteLiquidateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "oracle", "marketId", "accountId", "accountObjectAddress", "sender", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_liquidate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteLiquidateCloseAtSlArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    cumulativeBorrow: RawTransactionArgument<string>;
    fundingSign: RawTransactionArgument<boolean>;
    fundingIdx: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    slOrderId: RawTransactionArgument<number | bigint>;
    slPrice: RawTransactionArgument<string>;
    now: RawTransactionArgument<number | bigint>;
}
export interface ExecuteLiquidateCloseAtSlOptions {
    package?: string;
    arguments: ExecuteLiquidateCloseAtSlArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        cumulativeBorrow: RawTransactionArgument<string>,
        fundingSign: RawTransactionArgument<boolean>,
        fundingIdx: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        slOrderId: RawTransactionArgument<number | bigint>,
        slPrice: RawTransactionArgument<string>,
        now: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Close the position at the stop-loss trigger price instead of liquidating.
 * Invoked from `execute_liquidate` when a triggerable SL exists among the
 * position's linked orders. No liquidator/insurance fee is collected; only the
 * standard trading fee (incl. impact fee) plus the accumulated borrow, funding and
 * open fees are settled. Remaining collateral returns to the user; a
 * `PositionClosed` event is emitted at `sl_price`.
 */
export function executeLiquidateCloseAtSl(options: ExecuteLiquidateCloseAtSlOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        'bool',
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'u64',
        'u64',
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "pool", "collateralPrice", "cumulativeBorrow", "fundingSign", "fundingIdx", "marketId", "accountId", "accountObjectAddress", "positionId", "slOrderId", "slPrice", "now"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_liquidate_close_at_sl',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MatchOrdersArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    maxFills: RawTransactionArgument<number | bigint>;
}
export interface MatchOrdersOptions {
    package?: string;
    arguments: MatchOrdersArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        maxFills: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function matchOrders(options: MatchOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        null,
        'u8',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "senderRequest", "oracle", "orderTypeTag", "triggerPrice", "maxFills"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'match_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateFundingRateArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
}
export interface UpdateFundingRateOptions {
    package?: string;
    arguments: UpdateFundingRateArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Keeper: updates funding rate for a market. */
export function updateFundingRate(options: UpdateFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "ticker", "pool", "oracle", "senderRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SettleFundingRateArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
}
export interface SettleFundingRateOptions {
    package?: string;
    arguments: SettleFundingRateArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function settleFundingRate(options: SettleFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'settle_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OpenPositionByKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    keeperRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    collateralCoin: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    oracle: RawTransactionArgument<string>;
}
export interface OpenPositionByKeeperOptions {
    package?: string;
    arguments: OpenPositionByKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        keeperRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        collateralCoin: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Keeper-only: open a new position for an account, funded by the keeper's own
 * `Coin<C_TOKEN>` (campaign / airdrop use case). The keeper bypasses
 * `min_coll_value` on this path — `increase_position` and `place_order` still
 * enforce it for all callers including keepers.
 */
export function openPositionByKeeper(options: OpenPositionByKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        'address',
        null,
        'bool',
        'u128',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "keeperRequest", "accountObjectAddress", "collateralCoin", "isLong", "size", "acceptablePrice", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'open_position_by_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClosePositionByKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    keeperRequest: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    oracle: RawTransactionArgument<string>;
}
export interface ClosePositionByKeeperOptions {
    package?: string;
    arguments: ClosePositionByKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        keeperRequest: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        oracle: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Risk-manager-only: force-close a position (emergency use). Reads
 * `account_object_address` from the position directly, like `liquidate`.
 */
export function closePositionByKeeper(options: ClosePositionByKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x1::string::String',
        null,
        null,
        'u64',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "marketRegistry", "ticker", "pool", "keeperRequest", "positionId", "acceptablePrice", "oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'close_position_by_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolveSizeArguments {
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface ResolveSizeOptions {
    package?: string;
    arguments: ResolveSizeArguments | [
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        leverageBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Computes the scaled size (u128, 9 decimals) for a given collateral amount,
 * leverage, and actual collateral price. Compatible with non-dollar-pegged
 * collateral. Base ticker comes from `market.symbol()`, collateral ticker from
 * `pool.token_ticker<LP, C>()` — callers cannot mis-price by lying about either.
 */
export function resolveSize(options: ResolveSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "pool", "oracle", "collateralAmount", "leverageBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'resolve_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolveOrderSizeArguments {
    pool: RawTransactionArgument<string>;
    oracle: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface ResolveOrderSizeOptions {
    package?: string;
    arguments: ResolveOrderSizeArguments | [
        pool: RawTransactionArgument<string>,
        oracle: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        leverageBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Like `resolve_size` but uses a trigger price instead of the base oracle price.
 * Use this to compute the `size` parameter for `place_order_request`.
 * `trigger_price` is a scaled Float value (the same u128 you pass to
 * `place_order_request`).
 */
export function resolveOrderSize(options: ResolveOrderSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u128',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "oracle", "triggerPrice", "collateralAmount", "leverageBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'resolve_order_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CheckOpenSlippageArguments {
    isLong: RawTransactionArgument<boolean>;
    price: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface CheckOpenSlippageOptions {
    package?: string;
    arguments: CheckOpenSlippageArguments | [
        isLong: RawTransactionArgument<boolean>,
        price: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
}
export function checkOpenSlippage(options: CheckOpenSlippageOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool',
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["isLong", "price", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'check_open_slippage',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertOpenSlippageArguments {
    isLong: RawTransactionArgument<boolean>;
    price: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface AssertOpenSlippageOptions {
    package?: string;
    arguments: AssertOpenSlippageArguments | [
        isLong: RawTransactionArgument<boolean>,
        price: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
}
export function assertOpenSlippage(options: AssertOpenSlippageOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool',
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["isLong", "price", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_open_slippage',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertCloseSlippageArguments {
    isLong: RawTransactionArgument<boolean>;
    price: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface AssertCloseSlippageOptions {
    package?: string;
    arguments: AssertCloseSlippageArguments | [
        isLong: RawTransactionArgument<boolean>,
        price: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
}
export function assertCloseSlippage(options: AssertCloseSlippageOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool',
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["isLong", "price", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_close_slippage',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateTotalTradingFeeArguments {
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    orderIsLong: RawTransactionArgument<boolean>;
    orderSize: RawTransactionArgument<string>;
}
export interface CalculateTotalTradingFeeOptions {
    package?: string;
    arguments: CalculateTotalTradingFeeArguments | [
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        orderIsLong: RawTransactionArgument<boolean>,
        orderSize: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function calculateTotalTradingFee(options: CalculateTotalTradingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "pool", "executionPrice", "orderIsLong", "orderSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_total_trading_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EmitLpEquityArguments {
    market: RawTransactionArgument<string>;
    collateralToken: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    isProfit: RawTransactionArgument<boolean>;
    memo: RawTransactionArgument<string>;
}
export interface EmitLpEquityOptions {
    package?: string;
    arguments: EmitLpEquityArguments | [
        market: RawTransactionArgument<string>,
        collateralToken: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        isProfit: RawTransactionArgument<boolean>,
        memo: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Emits a `WlpEquityChanged` event for a settlement that moves `amount` of
 * `collateral_token` to/from the LP pool. No-op when `amount == 0`. Centralizes
 * the `market.symbol()` / `with_defining_ids<LP_TOKEN>()` lookups so call sites
 * stay short.
 */
export function emitLpEquity(options: EmitLpEquityOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'bool',
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "collateralToken", "amount", "isProfit", "memo"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'emit_lp_equity',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DistributeTradingFeeArguments {
    globalConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    feeBalance: RawTransactionArgument<string>;
    protocolShareBps: RawTransactionArgument<number | bigint>;
    marketId: RawTransactionArgument<string>;
    collateralToken: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface DistributeTradingFeeOptions {
    package?: string;
    arguments: DistributeTradingFeeArguments | [
        globalConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        feeBalance: RawTransactionArgument<string>,
        protocolShareBps: RawTransactionArgument<number | bigint>,
        marketId: RawTransactionArgument<string>,
        collateralToken: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Splits an already-collected trading-fee balance into the protocol's cut (sent to
 * `GlobalVault.protocol_fee_balance`) and the LP pool's cut (joined into the pool,
 * emitted as a `WlpEquityChanged` "fee" event). Used by every closing/liquidation
 * path that realizes a fee.
 */
export function distributeTradingFee(options: DistributeTradingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::object::ID',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "pool", "market", "feeBalance", "protocolShareBps", "marketId", "collateralToken", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'distribute_trading_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateEffectiveCollateralAmountArguments {
    grossCollateralAmount: RawTransactionArgument<number | bigint>;
    borrowFee: RawTransactionArgument<number | bigint>;
    fundingSign: RawTransactionArgument<boolean>;
    fundingFee: RawTransactionArgument<number | bigint>;
    tradingFee: RawTransactionArgument<number | bigint>;
    projectedTradingFee: RawTransactionArgument<number | bigint>;
}
export interface CalculateEffectiveCollateralAmountOptions {
    package?: string;
    arguments: CalculateEffectiveCollateralAmountArguments | [
        grossCollateralAmount: RawTransactionArgument<number | bigint>,
        borrowFee: RawTransactionArgument<number | bigint>,
        fundingSign: RawTransactionArgument<boolean>,
        fundingFee: RawTransactionArgument<number | bigint>,
        tradingFee: RawTransactionArgument<number | bigint>,
        projectedTradingFee: RawTransactionArgument<number | bigint>
    ];
}
export function calculateEffectiveCollateralAmount(options: CalculateEffectiveCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'bool',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["grossCollateralAmount", "borrowFee", "fundingSign", "fundingFee", "tradingFee", "projectedTradingFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_effective_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateLossAdjustedEffectiveCollateralAmountArguments {
    position: RawTransactionArgument<string>;
    currentPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    grossCollateralAmount: RawTransactionArgument<number | bigint>;
    borrowFee: RawTransactionArgument<number | bigint>;
    fundingSign: RawTransactionArgument<boolean>;
    fundingFee: RawTransactionArgument<number | bigint>;
    tradingFee: RawTransactionArgument<number | bigint>;
    projectedTradingFee: RawTransactionArgument<number | bigint>;
}
export interface CalculateLossAdjustedEffectiveCollateralAmountOptions {
    package?: string;
    arguments: CalculateLossAdjustedEffectiveCollateralAmountArguments | [
        position: RawTransactionArgument<string>,
        currentPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        grossCollateralAmount: RawTransactionArgument<number | bigint>,
        borrowFee: RawTransactionArgument<number | bigint>,
        fundingSign: RawTransactionArgument<boolean>,
        fundingFee: RawTransactionArgument<number | bigint>,
        tradingFee: RawTransactionArgument<number | bigint>,
        projectedTradingFee: RawTransactionArgument<number | bigint>
    ];
}
export function calculateLossAdjustedEffectiveCollateralAmount(options: CalculateLossAdjustedEffectiveCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64',
        'bool',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "currentPrice", "collateralPrice", "grossCollateralAmount", "borrowFee", "fundingSign", "fundingFee", "tradingFee", "projectedTradingFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_loss_adjusted_effective_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SettleFundingToBalanceArguments {
    globalConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    fundingSign: RawTransactionArgument<boolean>;
    fundingFee: RawTransactionArgument<number | bigint>;
    collateralPrice: RawTransactionArgument<string>;
    marketTicker: RawTransactionArgument<string>;
}
export interface SettleFundingToBalanceOptions {
    package?: string;
    arguments: SettleFundingToBalanceArguments | [
        globalConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        fundingSign: RawTransactionArgument<boolean>,
        fundingFee: RawTransactionArgument<number | bigint>,
        collateralPrice: RawTransactionArgument<string>,
        marketTicker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function settleFundingToBalance(options: SettleFundingToBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        'u64',
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "pool", "collateral", "fundingSign", "fundingFee", "collateralPrice", "marketTicker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'settle_funding_to_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SettleFundingToPositionArguments {
    globalConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    position: RawTransactionArgument<string>;
    fundingSign: RawTransactionArgument<boolean>;
    fundingFee: RawTransactionArgument<number | bigint>;
    collateralPrice: RawTransactionArgument<string>;
    marketTicker: RawTransactionArgument<string>;
}
export interface SettleFundingToPositionOptions {
    package?: string;
    arguments: SettleFundingToPositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        position: RawTransactionArgument<string>,
        fundingSign: RawTransactionArgument<boolean>,
        fundingFee: RawTransactionArgument<number | bigint>,
        collateralPrice: RawTransactionArgument<string>,
        marketTicker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function settleFundingToPosition(options: SettleFundingToPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        'u64',
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "pool", "position", "fundingSign", "fundingFee", "collateralPrice", "marketTicker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'settle_funding_to_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateImpactFeeArguments {
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    orderIsLong: RawTransactionArgument<boolean>;
    orderSize: RawTransactionArgument<string>;
}
export interface CalculateImpactFeeOptions {
    package?: string;
    arguments: CalculateImpactFeeArguments | [
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        orderIsLong: RawTransactionArgument<boolean>,
        orderSize: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function calculateImpactFee(options: CalculateImpactFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "pool", "executionPrice", "orderIsLong", "orderSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_impact_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ImpactFeeCostUsdArguments {
    maxImpactFee: RawTransactionArgument<string>;
    allocatedExposureUsd: RawTransactionArgument<string>;
    exposureUsd: RawTransactionArgument<string>;
    impactFeeCurvature: RawTransactionArgument<number | bigint>;
    impactFeeScale: RawTransactionArgument<number | bigint>;
}
export interface ImpactFeeCostUsdOptions {
    package?: string;
    arguments: ImpactFeeCostUsdArguments | [
        maxImpactFee: RawTransactionArgument<string>,
        allocatedExposureUsd: RawTransactionArgument<string>,
        exposureUsd: RawTransactionArgument<string>,
        impactFeeCurvature: RawTransactionArgument<number | bigint>,
        impactFeeScale: RawTransactionArgument<number | bigint>
    ];
}
export function impactFeeCostUsd(options: ImpactFeeCostUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["maxImpactFee", "allocatedExposureUsd", "exposureUsd", "impactFeeCurvature", "impactFeeScale"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'impact_fee_cost_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculatePositionLeverageBpsArguments {
    totalSize: RawTransactionArgument<string>;
    totalCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    executionPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface CalculatePositionLeverageBpsOptions {
    package?: string;
    arguments: CalculatePositionLeverageBpsArguments | [
        totalSize: RawTransactionArgument<string>,
        totalCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        executionPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function calculatePositionLeverageBps(options: CalculatePositionLeverageBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'u8',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["totalSize", "totalCollateralAmount", "collateralDecimal", "executionPrice", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_position_leverage_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasMinPositionCollateralValueArguments {
    minCollateralValue: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface HasMinPositionCollateralValueOptions {
    package?: string;
    arguments: HasMinPositionCollateralValueArguments | [
        minCollateralValue: RawTransactionArgument<number | bigint>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function hasMinPositionCollateralValue(options: HasMinPositionCollateralValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["minCollateralValue", "collateralAmount", "collateralDecimal", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'has_min_position_collateral_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertMinPositionCollateralValueArguments {
    minCollateralValue: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface AssertMinPositionCollateralValueOptions {
    package?: string;
    arguments: AssertMinPositionCollateralValueArguments | [
        minCollateralValue: RawTransactionArgument<number | bigint>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function assertMinPositionCollateralValue(options: AssertMinPositionCollateralValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["minCollateralValue", "collateralAmount", "collateralDecimal", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_min_position_collateral_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProportionalAmountArguments {
    total: RawTransactionArgument<number | bigint>;
    partial: RawTransactionArgument<string>;
    base: RawTransactionArgument<string>;
}
export interface ProportionalAmountOptions {
    package?: string;
    arguments: ProportionalAmountArguments | [
        total: RawTransactionArgument<number | bigint>,
        partial: RawTransactionArgument<string>,
        base: RawTransactionArgument<string>
    ];
}
export function proportionalAmount(options: ProportionalAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["total", "partial", "base"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'proportional_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DebitCollateralAmountArguments {
    remaining: RawTransactionArgument<number | bigint>;
    deficit: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface DebitCollateralAmountOptions {
    package?: string;
    arguments: DebitCollateralAmountArguments | [
        remaining: RawTransactionArgument<number | bigint>,
        deficit: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function debitCollateralAmount(options: DebitCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["remaining", "deficit", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'debit_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreditCollateralAmountArguments {
    remaining: RawTransactionArgument<number | bigint>;
    deficit: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface CreditCollateralAmountOptions {
    package?: string;
    arguments: CreditCollateralAmountArguments | [
        remaining: RawTransactionArgument<number | bigint>,
        deficit: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function creditCollateralAmount(options: CreditCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["remaining", "deficit", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'credit_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateRemainingCollateralAfterPartialReduceArguments {
    position: RawTransactionArgument<string>;
    reduceSize: RawTransactionArgument<string>;
    closeFee: RawTransactionArgument<number | bigint>;
    currentPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    addedCollateralAmount: RawTransactionArgument<number | bigint>;
}
export interface CalculateRemainingCollateralAfterPartialReduceOptions {
    package?: string;
    arguments: CalculateRemainingCollateralAfterPartialReduceArguments | [
        position: RawTransactionArgument<string>,
        reduceSize: RawTransactionArgument<string>,
        closeFee: RawTransactionArgument<number | bigint>,
        currentPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        addedCollateralAmount: RawTransactionArgument<number | bigint>
    ];
}
export function calculateRemainingCollateralAfterPartialReduce(options: CalculateRemainingCollateralAfterPartialReduceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "reduceSize", "closeFee", "currentPrice", "collateralPrice", "addedCollateralAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'calculate_remaining_collateral_after_partial_reduce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CanPositionGrowArguments {
    globalConfig: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    currentSize: RawTransactionArgument<string>;
    addedSize: RawTransactionArgument<string>;
    effectiveCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralToken: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface CanPositionGrowOptions {
    package?: string;
    arguments: CanPositionGrowArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        currentSize: RawTransactionArgument<string>,
        addedSize: RawTransactionArgument<string>,
        effectiveCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralToken: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Non-aborting growth check used by keeper order matching. Invalid standalone
 * orders are rotated behind valid orders at the same trigger price.
 */
export function canPositionGrow(options: CanPositionGrowOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        null,
        null,
        'u64',
        'u8',
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketConfig", "pool", "isLong", "currentSize", "addedSize", "effectiveCollateralAmount", "collateralDecimal", "collateralToken", "executionPrice", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'can_position_grow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ValidatePositionGrowthArguments {
    globalConfig: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    currentSize: RawTransactionArgument<string>;
    addedSize: RawTransactionArgument<string>;
    effectiveCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralToken: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface ValidatePositionGrowthOptions {
    package?: string;
    arguments: ValidatePositionGrowthArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        currentSize: RawTransactionArgument<string>,
        addedSize: RawTransactionArgument<string>,
        effectiveCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralToken: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function validatePositionGrowth(options: ValidatePositionGrowthOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        null,
        null,
        'u64',
        'u8',
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketConfig", "pool", "isLong", "currentSize", "addedSize", "effectiveCollateralAmount", "collateralDecimal", "collateralToken", "executionPrice", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'validate_position_growth',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WeightedAveragePriceArguments {
    currentSize: RawTransactionArgument<string>;
    currentAveragePrice: RawTransactionArgument<string>;
    addSize: RawTransactionArgument<string>;
    fillPrice: RawTransactionArgument<string>;
}
export interface WeightedAveragePriceOptions {
    package?: string;
    arguments: WeightedAveragePriceArguments | [
        currentSize: RawTransactionArgument<string>,
        currentAveragePrice: RawTransactionArgument<string>,
        addSize: RawTransactionArgument<string>,
        fillPrice: RawTransactionArgument<string>
    ];
}
export function weightedAveragePrice(options: WeightedAveragePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["currentSize", "currentAveragePrice", "addSize", "fillPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'weighted_average_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NormalizeTriggerPriceArguments {
    triggerPrice: RawTransactionArgument<string>;
    orderPriceTick: RawTransactionArgument<string>;
}
export interface NormalizeTriggerPriceOptions {
    package?: string;
    arguments: NormalizeTriggerPriceArguments | [
        triggerPrice: RawTransactionArgument<string>,
        orderPriceTick: RawTransactionArgument<string>
    ];
}
export function normalizeTriggerPrice(options: NormalizeTriggerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["triggerPrice", "orderPriceTick"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'normalize_trigger_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasPendingPreOrdersArguments {
    market: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
}
export interface HasPendingPreOrdersOptions {
    package?: string;
    arguments: HasPendingPreOrdersArguments | [
        market: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** View: whether `main_order_id` has reserved pre-orders pending in `market`. */
export function hasPendingPreOrders(options: HasPendingPreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "mainOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'has_pending_pre_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PendingPreOrdersCountArguments {
    market: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
}
export interface PendingPreOrdersCountOptions {
    package?: string;
    arguments: PendingPreOrdersCountArguments | [
        market: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * View: how many pre-orders are reserved against `main_order_id`. `0` if no entry
 * exists.
 */
export function pendingPreOrdersCount(options: PendingPreOrdersCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "mainOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'pending_pre_orders_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReservePreOrdersArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    collateralDecimal: RawTransactionArgument<number>;
    preOrders: RawTransactionArgument<string[]>;
}
export interface ReservePreOrdersOptions {
    package?: string;
    arguments: ReservePreOrdersArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        collateralDecimal: RawTransactionArgument<number>,
        preOrders: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Mints fresh order ids for every `PlaceOrderArgument` in `pre_orders`, builds a
 * real `Order` per entry (reduce-only, zero-collateral,
 * `linked_position_id = None`), stashes each one in `pending_pre_orders` under its
 * own id, and records the id list in `pending_pre_order_index` under
 * `main_order_id` — appending to any existing entry so this helper also works for
 * the per-leg `add_pre_order` path. Emits one `PreOrderCreated` per reserved
 * pre-order. No-op when `pre_orders` is empty.
 */
export function reservePreOrders(options: ReservePreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'address',
        '0x2::object::ID',
        'u8',
        'vector<null>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "mainOrderId", "accountObjectAddress", "marketId", "collateralDecimal", "preOrders"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'reserve_pre_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DropPendingPreOrdersIfExistsArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
}
export interface DropPendingPreOrdersIfExistsOptions {
    package?: string;
    arguments: DropPendingPreOrdersIfExistsArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Drops every pre-order reserved against `main_order_id` (if any), destroying each
 * via `position::remove_order` (which splits the zero collateral back into the
 * vault and deletes the order UID) and emitting one `PreOrderCancelled` per
 * dropped pre-order.
 */
export function dropPendingPreOrdersIfExists(options: DropPendingPreOrdersIfExistsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "marketId", "accountObjectAddress", "mainOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'drop_pending_pre_orders_if_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ActivatePendingPreOrdersArguments {
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pos: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
}
export interface ActivatePendingPreOrdersOptions {
    package?: string;
    arguments: ActivatePendingPreOrdersArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pos: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Promotes reserved pre-orders to real reduce-only linked orders on the freshly
 * opened position. Called from the standalone-fill branch of `match_orders` right
 * before the new position is pushed to the market. Each reserved `Order` was
 * created at place time with `linked_position_id = None`; here we stamp in the new
 * `position_id` and move the order onto the live book.
 */
export function activatePendingPreOrders(options: ActivatePendingPreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64',
        'address',
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "market", "pos", "positionId", "mainOrderId", "accountObjectAddress", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'activate_pending_pre_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertPositionOwnerArguments {
    position: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
}
export interface AssertPositionOwnerOptions {
    package?: string;
    arguments: AssertPositionOwnerArguments | [
        position: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>
    ];
}
export function assertPositionOwner(options: AssertPositionOwnerOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "accountObjectAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_position_owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertPositionCollateralTypeArguments {
    position: RawTransactionArgument<string>;
}
export interface AssertPositionCollateralTypeOptions {
    package?: string;
    arguments: AssertPositionCollateralTypeArguments | [
        position: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertPositionCollateralType(options: AssertPositionCollateralTypeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'assert_position_collateral_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowOwnedPositionArguments {
    market: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
}
export interface BorrowOwnedPositionOptions {
    package?: string;
    arguments: BorrowOwnedPositionArguments | [
        market: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowOwnedPosition(options: BorrowOwnedPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "positionId", "accountObjectAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_owned_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowOwnedPositionMutArguments {
    market: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
}
export interface BorrowOwnedPositionMutOptions {
    package?: string;
    arguments: BorrowOwnedPositionMutArguments | [
        market: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowOwnedPositionMut(options: BorrowOwnedPositionMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "positionId", "accountObjectAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_owned_position_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TakeOwnedPositionArguments {
    market: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    now: RawTransactionArgument<number | bigint>;
    requireCooldown: RawTransactionArgument<boolean>;
}
export interface TakeOwnedPositionOptions {
    package?: string;
    arguments: TakeOwnedPositionArguments | [
        market: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        now: RawTransactionArgument<number | bigint>,
        requireCooldown: RawTransactionArgument<boolean>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function takeOwnedPosition(options: TakeOwnedPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'address',
        'u64',
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "positionId", "accountObjectAddress", "now", "requireCooldown"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'take_owned_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindOrderTypeTagArguments {
    market: RawTransactionArgument<string>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface FindOrderTypeTagOptions {
    package?: string;
    arguments: FindOrderTypeTagArguments | [
        market: RawTransactionArgument<string>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function findOrderTypeTag(options: FindOrderTypeTagOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "triggerPriceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'find_order_type_tag',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindCancelOrderLocationArguments {
    market: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface FindCancelOrderLocationOptions {
    package?: string;
    arguments: FindCancelOrderLocationArguments | [
        market: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function findCancelOrderLocation(options: FindCancelOrderLocationOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "orderTypeTag", "triggerPrice", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'find_cancel_order_location',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindOrderLocationByIdArguments {
    market: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface FindOrderLocationByIdOptions {
    package?: string;
    arguments: FindOrderLocationByIdArguments | [
        market: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function findOrderLocationById(options: FindOrderLocationByIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "orderTypeTag", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'find_order_location_by_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindOrderPriceKeyInBookArguments {
    book: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface FindOrderPriceKeyInBookOptions {
    package?: string;
    arguments: FindOrderPriceKeyInBookArguments | [
        book: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function findOrderPriceKeyInBook(options: FindOrderPriceKeyInBookOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'find_order_price_key_in_book',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelContainsOrderArguments {
    level: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface LevelContainsOrderOptions {
    package?: string;
    arguments: LevelContainsOrderArguments | [
        level: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function levelContainsOrder(options: LevelContainsOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["level", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'level_contains_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasOrderInBookArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface HasOrderInBookOptions {
    package?: string;
    arguments: HasOrderInBookArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function hasOrderInBook(options: HasOrderInBookOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'has_order_in_book',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TakeLinkedOrderAtKeyArguments {
    market: RawTransactionArgument<string>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface TakeLinkedOrderAtKeyOptions {
    package?: string;
    arguments: TakeLinkedOrderAtKeyArguments | [
        market: RawTransactionArgument<string>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function takeLinkedOrderAtKey(options: TakeLinkedOrderAtKeyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "triggerPriceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'take_linked_order_at_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelLinkedOrdersToBalanceArguments {
    globalConfig: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    linkedOrderIds: RawTransactionArgument<number | bigint[]>;
    linkedOrderPriceKeys: RawTransactionArgument<number | bigint[]>;
    memoCode: RawTransactionArgument<number>;
}
export interface CancelLinkedOrdersToBalanceOptions {
    package?: string;
    arguments: CancelLinkedOrdersToBalanceArguments | [
        globalConfig: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        linkedOrderIds: RawTransactionArgument<number | bigint[]>,
        linkedOrderPriceKeys: RawTransactionArgument<number | bigint[]>,
        memoCode: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function cancelLinkedOrdersToBalance(options: CancelLinkedOrdersToBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::object::ID',
        'vector<u64>',
        'vector<u128>',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "wxaRegistry", "market", "accountId", "linkedOrderIds", "linkedOrderPriceKeys", "memoCode"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'cancel_linked_orders_to_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMutOrderBookArguments {
    market: RawTransactionArgument<string>;
    tag: RawTransactionArgument<number>;
}
export interface BorrowMutOrderBookOptions {
    package?: string;
    arguments: BorrowMutOrderBookArguments | [
        market: RawTransactionArgument<string>,
        tag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function borrowMutOrderBook(options: BorrowMutOrderBookOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "tag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_mut_order_book',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TakeOrderDirectArguments {
    market: RawTransactionArgument<string>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
    user: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface TakeOrderDirectOptions {
    package?: string;
    arguments: TakeOrderDirectArguments | [
        market: RawTransactionArgument<string>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>,
        user: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function takeOrderDirect(options: TakeOrderDirectOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64',
        'address',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "triggerPriceKey", "orderId", "user", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'take_order_direct',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReturnToUserArguments {
    wxaRegistry: RawTransactionArgument<string>;
    balance: RawTransactionArgument<string>;
    accountObjAddr: RawTransactionArgument<string>;
}
export interface ReturnToUserOptions {
    package?: string;
    arguments: ReturnToUserArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        balance: RawTransactionArgument<string>,
        accountObjAddr: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Returns `balance` to the user's wxa stored balance under the `WaterXPerp`
 * witness. `account_obj_addr` is the wxa account's UID address (i.e.
 * `account_id.to_address()`), so `.to_id()` recovers the account_id. Zero balances
 * are silently destroyed (no event).
 */
export function returnToUser(options: ReturnToUserOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "balance", "accountObjAddr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'return_to_user',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketIdArguments {
    market: RawTransactionArgument<string>;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Returns the object ID of this Market (trading vault). */
export function marketId(options: MarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowPositionArguments {
    market: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface BorrowPositionOptions {
    package?: string;
    arguments: BorrowPositionArguments | [
        market: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows a position by ID. */
export function borrowPosition(options: BorrowPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasPositionArguments {
    market: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface HasPositionOptions {
    package?: string;
    arguments: HasPositionArguments | [
        market: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Checks if a position exists. */
export function hasPosition(options: HasPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'has_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowOrderArguments {
    market: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface BorrowOrderOptions {
    package?: string;
    arguments: BorrowOrderArguments | [
        market: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows a single order by type, price key, and order id. */
export function borrowOrder(options: BorrowOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "orderTypeTag", "triggerPriceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowPositionsArguments {
    market: RawTransactionArgument<string>;
}
export interface BorrowPositionsOptions {
    package?: string;
    arguments: BorrowPositionsArguments | [
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows the positions KeyedBigVector (for paginated iteration). */
export function borrowPositions(options: BorrowPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowOrderBookArguments {
    market: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface BorrowOrderBookOptions {
    package?: string;
    arguments: BorrowOrderBookArguments | [
        market: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows an order book by type tag (0-3), read-only. */
export function borrowOrderBook(options: BorrowOrderBookOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["market", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_order_book',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowConfigArguments {
    market: RawTransactionArgument<string>;
}
export interface BorrowConfigOptions {
    package?: string;
    arguments: BorrowConfigArguments | [
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows the market config (for view.move). */
export function borrowConfig(options: BorrowConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketSymbolArguments {
    market: RawTransactionArgument<string>;
}
export interface MarketSymbolOptions {
    package?: string;
    arguments: MarketSymbolArguments | [
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketSymbol(options: MarketSymbolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'market_symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreateMarketRegistryArguments {
    Cap: RawTransactionArgument<string>;
}
export interface CreateMarketRegistryOptions {
    package?: string;
    arguments: CreateMarketRegistryArguments | [
        Cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Creates and shares a new `MarketRegistry`. Admin-gated. */
export function createMarketRegistry(options: CreateMarketRegistryOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'create_market_registry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RegistryAssertVersionArguments {
    registry: RawTransactionArgument<string>;
}
export interface RegistryAssertVersionOptions {
    package?: string;
    arguments: RegistryAssertVersionArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function registryAssertVersion(options: RegistryAssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'registry_assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RegistryAllowVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface RegistryAllowVersionOptions {
    package?: string;
    arguments: RegistryAllowVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function registryAllowVersion(options: RegistryAllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'registry_allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RegistryDisallowVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface RegistryDisallowVersionOptions {
    package?: string;
    arguments: RegistryDisallowVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function registryDisallowVersion(options: RegistryDisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'registry_disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddMarketArguments {
    registry: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface AddMarketOptions {
    package?: string;
    arguments: AddMarketArguments | [
        registry: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Stores `market` in the registry under `ticker`. Aborts if already taken. */
export function addMarket(options: AddMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Cap", "ticker", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'add_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveMarketArguments {
    registry: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface RemoveMarketOptions {
    package?: string;
    arguments: RemoveMarketArguments | [
        registry: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Removes a market from the registry and returns it. */
export function removeMarket(options: RemoveMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Cap", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'remove_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasMarketArguments {
    registry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface HasMarketOptions {
    package?: string;
    arguments: HasMarketArguments | [
        registry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function hasMarket(options: HasMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'has_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ListedTickersArguments {
    registry: RawTransactionArgument<string>;
}
export interface ListedTickersOptions {
    package?: string;
    arguments: ListedTickersArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function listedTickers(options: ListedTickersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'listed_tickers',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMarketArguments {
    registry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface BorrowMarketOptions {
    package?: string;
    arguments: BorrowMarketArguments | [
        registry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function borrowMarket(options: BorrowMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMarketMutArguments {
    registry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface BorrowMarketMutOptions {
    package?: string;
    arguments: BorrowMarketMutArguments | [
        registry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function borrowMarketMut(options: BorrowMarketMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'borrow_market_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}