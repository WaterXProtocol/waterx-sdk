/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Core trading engine for WaterX Perp DEX. Uses hot-potato Request/Response
 * pattern (following Bucket CDP).
 * 
 * PTB flow:
 * 
 * 1.  let request = trading::open_position_request(...);
 * 2.  // External rules add witnesses: my_rule::check(&mut request, ...);
 * 3.  let (coin_out, response) = trading::execute(global_config, account_registry,
 *     market, pool, request, ...);
 * 4.  trading::destroy_response(global_config, market, response);
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
const $moduleName = '@waterx/perp::trading';
export const Market = new MoveStruct({ name: `${$moduleName}::Market<phantom BASE_TOKEN, phantom LP_TOKEN>`, fields: {
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
        stop_sells: order_book_3.OrderBook
    } });
export interface CreateMarketArguments {
    Cap: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint>;
    minCollValue: RawTransactionArgument<number | bigint>;
    tradingFeeBps: RawTransactionArgument<number | bigint>;
    maintenanceMarginBps: RawTransactionArgument<number | bigint>;
    maxLongOi: RawTransactionArgument<number | bigint>;
    maxShortOi: RawTransactionArgument<number | bigint>;
    cooldownMs: RawTransactionArgument<number | bigint>;
    basicFundingRateBps: RawTransactionArgument<number | bigint>;
    fundingIntervalMs: RawTransactionArgument<number | bigint>;
}
export interface CreateMarketOptions {
    package?: string;
    arguments: CreateMarketArguments | [
        Cap: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint>,
        minCollValue: RawTransactionArgument<number | bigint>,
        tradingFeeBps: RawTransactionArgument<number | bigint>,
        maintenanceMarginBps: RawTransactionArgument<number | bigint>,
        maxLongOi: RawTransactionArgument<number | bigint>,
        maxShortOi: RawTransactionArgument<number | bigint>,
        cooldownMs: RawTransactionArgument<number | bigint>,
        basicFundingRateBps: RawTransactionArgument<number | bigint>,
        fundingIntervalMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Creates a trading market with full configuration. */
export function createMarket(options: CreateMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'u64',
        'u64',
        'u64',
        'u128',
        'u128',
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "maxLeverageBps", "minCollValue", "tradingFeeBps", "maintenanceMarginBps", "maxLongOi", "maxShortOi", "cooldownMs", "basicFundingRateBps", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'create_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateMarketConfigArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint | null>;
    minCollValue: RawTransactionArgument<number | bigint | null>;
    tradingFeeBps: RawTransactionArgument<number | bigint | null>;
    maxImpactFeeBps: RawTransactionArgument<number | bigint | null>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>;
    impactFeeCurvature: RawTransactionArgument<number | bigint | null>;
    impactFeeScale: RawTransactionArgument<number | bigint | null>;
    maintenanceMarginBps: RawTransactionArgument<number | bigint | null>;
    maxLongOi: RawTransactionArgument<number | bigint | null>;
    maxShortOi: RawTransactionArgument<number | bigint | null>;
    cooldownMs: RawTransactionArgument<number | bigint | null>;
    orderPriceTick: RawTransactionArgument<string | null>;
    basicFundingRateBps: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateMarketConfigOptions {
    package?: string;
    arguments: UpdateMarketConfigArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint | null>,
        minCollValue: RawTransactionArgument<number | bigint | null>,
        tradingFeeBps: RawTransactionArgument<number | bigint | null>,
        maxImpactFeeBps: RawTransactionArgument<number | bigint | null>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>,
        impactFeeCurvature: RawTransactionArgument<number | bigint | null>,
        impactFeeScale: RawTransactionArgument<number | bigint | null>,
        maintenanceMarginBps: RawTransactionArgument<number | bigint | null>,
        maxLongOi: RawTransactionArgument<number | bigint | null>,
        maxShortOi: RawTransactionArgument<number | bigint | null>,
        cooldownMs: RawTransactionArgument<number | bigint | null>,
        orderPriceTick: RawTransactionArgument<string | null>,
        basicFundingRateBps: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Admin: forwards to `market_config::update_market_config` through the shared
 * `Market`. Needed because `MarketConfig` is embedded inside `Market` and can't be
 * borrowed mutably from a PTB directly.
 */
export function updateMarketConfig(options: UpdateMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<null>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market", "maxLeverageBps", "minCollValue", "tradingFeeBps", "maxImpactFeeBps", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale", "maintenanceMarginBps", "maxLongOi", "maxShortOi", "cooldownMs", "orderPriceTick", "basicFundingRateBps", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SuspendMarketArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface SuspendMarketOptions {
    package?: string;
    arguments: SuspendMarketArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Admin: suspend the market (halts trading). */
export function suspendMarket(options: SuspendMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'suspend_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumeMarketArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface ResumeMarketOptions {
    package?: string;
    arguments: ResumeMarketArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Admin: resume the market. */
export function resumeMarket(options: ResumeMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'resume_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddRequestRuleArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface AddRequestRuleOptions {
    package?: string;
    arguments: AddRequestRuleArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Admin: add witness type `W` to the request checklist. */
export function addRequestRule(options: AddRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'add_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveRequestRuleArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface RemoveRequestRuleOptions {
    package?: string;
    arguments: RemoveRequestRuleArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Admin: remove witness type `W` from the request checklist. */
export function removeRequestRule(options: RemoveRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'remove_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddResponseRuleArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface AddResponseRuleOptions {
    package?: string;
    arguments: AddResponseRuleArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Admin: add witness type `W` to the response checklist. */
export function addResponseRule(options: AddResponseRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'add_response_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveResponseRuleArguments {
    cap: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
}
export interface RemoveResponseRuleOptions {
    package?: string;
    arguments: RemoveResponseRuleArguments | [
        cap: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Admin: remove witness type `W` from the response checklist. */
export function removeResponseRule(options: RemoveResponseRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "market"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'remove_response_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OpenPositionRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    receivings: RawTransactionArgument<string[]>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface OpenPositionRequestOptions {
    package?: string;
    arguments: OpenPositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        receivings: RawTransactionArgument<string[]>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Creates a request to open a new position. */
export function openPositionRequest(options: OpenPositionRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'address',
        'vector<null>',
        'u64',
        'bool',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "receivings", "collateralAmount", "isLong", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'open_position_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClosePositionRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ClosePositionRequestOptions {
    package?: string;
    arguments: ClosePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "positionId", "acceptablePrice"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    receivings: RawTransactionArgument<string[]>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface IncreasePositionRequestOptions {
    package?: string;
    arguments: IncreasePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        receivings: RawTransactionArgument<string[]>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'vector<null>',
        'u64',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "positionId", "receivings", "collateralAmount", "size", "acceptablePrice"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface DecreasePositionRequestOptions {
    package?: string;
    arguments: DecreasePositionRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "positionId", "size", "acceptablePrice"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    receivings: RawTransactionArgument<string[]>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    isLong: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<number | bigint>;
    triggerPrice: RawTransactionArgument<string>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
}
export interface PlaceOrderRequestOptions {
    package?: string;
    arguments: PlaceOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        receivings: RawTransactionArgument<string[]>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        isLong: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<number | bigint>,
        triggerPrice: RawTransactionArgument<string>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Creates a request to place a limit or stop order. */
export function placeOrderRequest(options: PlaceOrderRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'address',
        'vector<null>',
        'u64',
        'bool',
        'bool',
        'bool',
        'u128',
        null,
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "receivings", "collateralAmount", "isLong", "isStopOrder", "reduceOnly", "size", "triggerPrice", "linkedPositionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'place_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelOrderRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface CancelOrderRequestOptions {
    package?: string;
    arguments: CancelOrderRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'u128',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "orderId", "triggerPrice", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'cancel_order_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositCollateralRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    receivings: RawTransactionArgument<string[]>;
    collateralAmount: RawTransactionArgument<number | bigint>;
}
export interface DepositCollateralRequestOptions {
    package?: string;
    arguments: DepositCollateralRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        receivings: RawTransactionArgument<string[]>,
        collateralAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'vector<null>',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "positionId", "receivings", "collateralAmount"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawCollateralRequestOptions {
    package?: string;
    arguments: WithdrawCollateralRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        'address',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "senderRequest", "accountObjectAddress", "positionId", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'withdraw_collateral_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LiquidateRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface LiquidateRequestOptions {
    package?: string;
    arguments: LiquidateRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Creates a request to liquidate a position (keeper only). Reads
 * account_object_address from the position directly.
 */
export function liquidateRequest(options: LiquidateRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "senderRequest", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'liquidate_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchLiquidateRequestArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    pageSize: RawTransactionArgument<number | bigint>;
    pageIndex: RawTransactionArgument<number | bigint>;
}
export interface BatchLiquidateRequestOptions {
    package?: string;
    arguments: BatchLiquidateRequestArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        pageSize: RawTransactionArgument<number | bigint>,
        pageIndex: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Scans a page of positions and creates liquidation requests for those that are
 * liquidatable. Skips non-liquidatable positions. Iterates positions by internal
 * index: [page_index \* page_size, ...). Returns empty vector if page is out of
 * range or no positions qualify. Keeper only.
 */
export function batchLiquidateRequest(options: BatchLiquidateRequestOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "senderRequest", "priceResult", "collateralPriceResult", "pageSize", "pageIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'batch_liquidate_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
}
export interface ExecuteOptions {
    package?: string;
    arguments: ExecuteArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Executes a trading request. */
export function execute(options: ExecuteOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "req", "priceResult", "collateralPriceResult"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DestroyResponseArguments {
    GlobalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    response: RawTransactionArgument<string>;
}
export interface DestroyResponseOptions {
    package?: string;
    arguments: DestroyResponseArguments | [
        GlobalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        response: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Destroys a TradingResponse. */
export function destroyResponse(options: DestroyResponseOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["GlobalConfig", "market", "response"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'destroy_response',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchExecuteArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    requests: RawTransactionArgument<string[]>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
}
export interface BatchExecuteOptions {
    package?: string;
    arguments: BatchExecuteArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        requests: RawTransactionArgument<string[]>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Executes a batch of trading requests. Returns all change coins (merged) and all
 * responses.
 */
export function batchExecute(options: BatchExecuteOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'vector<null>',
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "requests", "priceResult", "collateralPriceResult"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'batch_execute',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BatchDestroyResponseArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    responses: RawTransactionArgument<string[]>;
}
export interface BatchDestroyResponseOptions {
    package?: string;
    arguments: BatchDestroyResponseArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        responses: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Destroys a batch of TradingResponses. */
export function batchDestroyResponse(options: BatchDestroyResponseOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'vector<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "responses"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'batch_destroy_response',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteOpenPositionArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
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
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        null,
        'bool',
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjectAddress", "sender", "collateral", "isLong", "size", "acceptablePrice"];
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
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
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
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        collateral: RawTransactionArgument<string>,
        size: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjectAddress", "sender", "positionId", "collateral", "size", "acceptablePrice"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ExecuteClosePositionOptions {
    package?: string;
    arguments: ExecuteClosePositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjId", "sender", "positionId", "acceptablePrice"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    requestedSize: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    responseAction: RawTransactionArgument<number>;
}
export interface ExecuteDecreasePositionOptions {
    package?: string;
    arguments: ExecuteDecreasePositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        requestedSize: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        responseAction: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        null,
        'u64',
        'u8',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjId", "sender", "positionId", "requestedSize", "acceptablePrice", "responseAction"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
}
export interface ExecutePlaceOrderOptions {
    package?: string;
    arguments: ExecutePlaceOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        null,
        'bool',
        'bool',
        'bool',
        null,
        null,
        '0x1::option::Option<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjectAddress", "sender", "collateral", "isLong", "isStopOrder", "reduceOnly", "size", "triggerPrice", "linkedPositionId"];
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    triggerPriceKey: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
}
export interface ExecuteCancelOrderOptions {
    package?: string;
    arguments: ExecuteCancelOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        triggerPriceKey: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
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
        'address',
        'u64',
        'u128',
        'u8',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "marketId", "accountId", "accountObjId", "sender", "orderId", "triggerPriceKey", "orderTypeTag"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_cancel_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteDepositCollateralArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    collateral: RawTransactionArgument<string>;
}
export interface ExecuteDepositCollateralOptions {
    package?: string;
    arguments: ExecuteDepositCollateralArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        collateral: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjectAddress", "sender", "positionId", "collateral"];
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
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accountObjId: RawTransactionArgument<string>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface ExecuteWithdrawCollateralOptions {
    package?: string;
    arguments: ExecuteWithdrawCollateralArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjId: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjId", "sender", "positionId", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_withdraw_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteLiquidateArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
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
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'address',
        'address',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "priceResult", "collateralPriceResult", "marketId", "accountId", "accountObjectAddress", "sender", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'execute_liquidate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MatchOrdersArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    orderTypeTag: RawTransactionArgument<number>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    maxFills: RawTransactionArgument<number | bigint>;
}
export interface MatchOrdersOptions {
    package?: string;
    arguments: MatchOrdersArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        orderTypeTag: RawTransactionArgument<number>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        maxFills: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
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
        null,
        null,
        null,
        null,
        'u8',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "pool", "senderRequest", "priceResult", "collateralPriceResult", "orderTypeTag", "triggerPrice", "maxFills"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'match_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateFundingRateArguments {
    GlobalConfig: RawTransactionArgument<string>;
    Market: RawTransactionArgument<string>;
    SenderRequest: RawTransactionArgument<string>;
}
export interface UpdateFundingRateOptions {
    package?: string;
    arguments: UpdateFundingRateArguments | [
        GlobalConfig: RawTransactionArgument<string>,
        Market: RawTransactionArgument<string>,
        SenderRequest: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Keeper: updates funding rate for a market. @deprecated Use
 * `update_funding_rate_v2` instead. This is a no-op.
 */
export function updateFundingRate(options: UpdateFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["GlobalConfig", "Market", "SenderRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateFundingRateV2Arguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
}
export interface UpdateFundingRateV2Options {
    package?: string;
    arguments: UpdateFundingRateV2Arguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function updateFundingRateV2(options: UpdateFundingRateV2Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "pool", "priceResult", "senderRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'update_funding_rate_v2',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OpenPositionRequestByKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    keeperRequest: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    collateralCoin: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface OpenPositionRequestByKeeperOptions {
    package?: string;
    arguments: OpenPositionRequestByKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        keeperRequest: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        collateralCoin: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** Keeper: Creates a request to open a new position for an account by keeper */
export function openPositionRequestByKeeper(options: OpenPositionRequestByKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'address',
        null,
        'bool',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "keeperRequest", "accountObjectAddress", "collateralCoin", "isLong", "size", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'open_position_request_by_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClosePositionRequestByKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    keeperRequest: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface ClosePositionRequestByKeeperOptions {
    package?: string;
    arguments: ClosePositionRequestByKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        keeperRequest: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Creates a request to force-close a position (risk manager only, emergency use).
 * Reads account_object_address from the position directly, like liquidate_request.
 */
export function closePositionRequestByKeeper(options: ClosePositionRequestByKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "market", "keeperRequest", "positionId", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'close_position_request_by_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResizeArguments {
    Market: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface ResizeOptions {
    package?: string;
    arguments: ResizeArguments | [
        Market: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        leverageBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Computes the scaled size (u128, 9 decimals) for a given collateral amount and
 * leverage. Deprecated: use `resolve_size` which accounts for actual collateral
 * price.
 */
export function resize(options: ResizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Market", "pool", "priceResult", "collateralAmount", "leverageBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'resize',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolveSizeArguments {
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    collateralPriceResult: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface ResolveSizeOptions {
    package?: string;
    arguments: ResolveSizeArguments | [
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        leverageBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Computes the scaled size (u128, 9 decimals) for a given collateral amount,
 * leverage, and actual collateral price. Compatible with non-dollar-pegged
 * collateral.
 */
export function resolveSize(options: ResolveSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "priceResult", "collateralPriceResult", "collateralAmount", "leverageBps"];
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
    collateralPriceResult: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface ResolveOrderSizeOptions {
    package?: string;
    arguments: ResolveOrderSizeArguments | [
        pool: RawTransactionArgument<string>,
        collateralPriceResult: RawTransactionArgument<string>,
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
 * `trigger_price` is a scaled Float value (same u128 you pass to
 * `place_order_request` via `float::from_scaled_val`).
 */
export function resolveOrderSize(options: ResolveOrderSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u128',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "collateralPriceResult", "triggerPrice", "collateralAmount", "leverageBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'trading',
        function: 'resolve_order_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
export interface CalculateTotalTradingFeeBpsArguments {
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    orderIsLong: RawTransactionArgument<boolean>;
    orderSize: RawTransactionArgument<string>;
}
export interface CalculateTotalTradingFeeBpsOptions {
    package?: string;
    arguments: CalculateTotalTradingFeeBpsArguments | [
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        orderIsLong: RawTransactionArgument<boolean>,
        orderSize: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function calculateTotalTradingFeeBps(options: CalculateTotalTradingFeeBpsOptions) {
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
        function: 'calculate_total_trading_fee_bps',
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
export interface CalculateImpactFeeBpsArguments {
    marketConfig: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    orderIsLong: RawTransactionArgument<boolean>;
    orderSize: RawTransactionArgument<string>;
}
export interface CalculateImpactFeeBpsOptions {
    package?: string;
    arguments: CalculateImpactFeeBpsArguments | [
        marketConfig: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        orderIsLong: RawTransactionArgument<boolean>,
        orderSize: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function calculateImpactFeeBps(options: CalculateImpactFeeBpsOptions) {
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
        function: 'calculate_impact_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
        string,
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
        string,
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
        string,
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
        string,
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
        string,
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
    accountRegistry: RawTransactionArgument<string>;
    market: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    linkedOrderIds: RawTransactionArgument<number | bigint[]>;
    linkedOrderPriceKeys: RawTransactionArgument<number | bigint[]>;
}
export interface CancelLinkedOrdersToBalanceOptions {
    package?: string;
    arguments: CancelLinkedOrdersToBalanceArguments | [
        globalConfig: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        market: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        linkedOrderIds: RawTransactionArgument<number | bigint[]>,
        linkedOrderPriceKeys: RawTransactionArgument<number | bigint[]>
    ];
    typeArguments: [
        string,
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
        'vector<u128>'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "accountRegistry", "market", "accountId", "linkedOrderIds", "linkedOrderPriceKeys"];
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
        string,
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
        string,
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
    balance: RawTransactionArgument<string>;
    user: RawTransactionArgument<string>;
}
export interface ReturnToUserOptions {
    package?: string;
    arguments: ReturnToUserArguments | [
        balance: RawTransactionArgument<string>,
        user: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function returnToUser(options: ReturnToUserOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["balance", "user"];
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
        string,
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
        string,
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
        string,
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
        string,
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
        string,
        string
    ];
}
/** Borrows the positions KeyedBigVector (for paginated iteration in view.move). */
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
        string,
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
        string,
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