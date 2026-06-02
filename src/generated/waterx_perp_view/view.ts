/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Read-only view functions for efficient off-chain data aggregation via
 * devInspect. All functions are pure reads — no state mutation.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as type_name_2 from './deps/std/type_name.ts';
import * as type_name_3 from './deps/std/type_name.ts';
import * as type_name_4 from './deps/std/type_name.ts';
import * as type_name_5 from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp-view::view';
export const AccountData = new MoveStruct({ name: `${$moduleName}::AccountData`, fields: {
        account_id: bcs.Address,
        account_object_address: bcs.Address
    } });
export const MarketData = new MoveStruct({ name: `${$moduleName}::MarketData`, fields: {
        market_id: bcs.Address,
        symbol: bcs.string(),
        lp_token: type_name.TypeName,
        is_paused: bcs.bool(),
        long_oi: bcs.u128(),
        short_oi: bcs.u128(),
        long_avg_entry_price: bcs.u128(),
        short_avg_entry_price: bcs.u128(),
        max_long_oi: bcs.u128(),
        max_short_oi: bcs.u128(),
        max_leverage_bps: bcs.u64(),
        trading_fee: bcs.u128(),
        max_impact_fee: bcs.u128(),
        allocated_lp_exposure_bps: bcs.u64(),
        impact_fee_curvature: bcs.u64(),
        impact_fee_scale: bcs.u64(),
        maintenance_margin: bcs.u128(),
        min_coll_value: bcs.u64(),
        cooldown_ms: bcs.u64(),
        basic_funding_rate: bcs.u128(),
        funding_interval_ms: bcs.u64(),
        order_price_tick: bcs.u128(),
        cumulative_funding_sign: bcs.bool(),
        cumulative_funding_index: bcs.u256(),
        last_funding_timestamp: bcs.u64(),
        next_position_id: bcs.u64(),
        next_order_id: bcs.u64()
    } });
export const PoolData = new MoveStruct({ name: `${$moduleName}::PoolData`, fields: {
        lp_token: type_name_1.TypeName,
        is_active: bcs.bool(),
        lp_decimal: bcs.u8(),
        total_lp_supply: bcs.u64(),
        tvl_usd: bcs.u128(),
        token_count: bcs.u64()
    } });
export const TokenPoolData = new MoveStruct({ name: `${$moduleName}::TokenPoolData`, fields: {
        token_type: type_name_2.TypeName,
        token_decimal: bcs.u8(),
        liquidity_amount: bcs.u64(),
        reserved_amount: bcs.u64(),
        value_usd: bcs.u128(),
        target_weight_bps: bcs.u64(),
        mint_fee_bps: bcs.u64(),
        burn_fee_bps: bcs.u64(),
        cumulative_borrow_rate: bcs.u128(),
        last_price_refresh_timestamp: bcs.u64()
    } });
export const RedeemRequestData = new MoveStruct({ name: `${$moduleName}::RedeemRequestData`, fields: {
        request_id: bcs.u64(),
        recipient_account_id: bcs.Address,
        lp_amount: bcs.u64(),
        token_type: type_name_3.TypeName,
        request_timestamp: bcs.u64()
    } });
export const GlobalConfigData = new MoveStruct({ name: `${$moduleName}::GlobalConfigData`, fields: {
        allowed_versions: bcs.vector(bcs.u16()),
        keeper_addresses: bcs.vector(bcs.Address),
        redeem_operator_addresses: bcs.vector(bcs.Address),
        protocol_fee_share_bps: bcs.u64(),
        liquidator_fee_bps: bcs.u64(),
        insurance_fee_bps: bcs.u64(),
        max_skipped_orders_per_match: bcs.u64(),
        oi_cap_bps: bcs.u64(),
        price_refresh_threshold_ms: bcs.u64()
    } });
export const PositionData = new MoveStruct({ name: `${$moduleName}::PositionData`, fields: {
        position_id: bcs.u64(),
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        is_long: bcs.bool(),
        size: bcs.u128(),
        collateral_type: type_name_4.TypeName,
        collateral_amount: bcs.u64(),
        collateral_decimal: bcs.u8(),
        average_price: bcs.u128(),
        oracle_price: bcs.u128(),
        collateral_price: bcs.u128(),
        est_liq_price: bcs.u128(),
        leverage_bps: bcs.u64(),
        entry_borrow_index: bcs.u128(),
        entry_funding_sign: bcs.bool(),
        entry_funding_index: bcs.u256(),
        unrealized_trading_fee: bcs.u64(),
        unrealized_borrow_fee: bcs.u64(),
        unrealized_funding_fee: bcs.u64(),
        unrealized_funding_sign: bcs.bool(),
        pnl_positive: bcs.bool(),
        pnl: bcs.u64(),
        funding_fee_positive: bcs.bool(),
        funding_fee: bcs.u64(),
        borrow_fee: bcs.u64(),
        close_fee: bcs.u64(),
        linked_order_ids: bcs.vector(bcs.u64()),
        linked_order_price_keys: bcs.vector(bcs.u128()),
        create_timestamp: bcs.u64(),
        update_timestamp: bcs.u64()
    } });
export const OrderData = new MoveStruct({ name: `${$moduleName}::OrderData`, fields: {
        order_id: bcs.u64(),
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        is_long: bcs.bool(),
        reduce_only: bcs.bool(),
        is_stop_order: bcs.bool(),
        size: bcs.u128(),
        collateral_type: type_name_5.TypeName,
        collateral_amount: bcs.u64(),
        collateral_decimal: bcs.u8(),
        trigger_price: bcs.u128(),
        oracle_price: bcs.u128(),
        order_type_tag: bcs.u8(),
        has_linked_position: bcs.bool(),
        linked_position_id: bcs.u64(),
        leverage_bps: bcs.u64(),
        create_timestamp: bcs.u64()
    } });
export interface AccountDataArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountDataOptions {
    package?: string;
    arguments: AccountDataArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * Get the perp-side snapshot for a single account, looked up by its
 * `waterx_account::Account` ID. Returns `none` if no `WaterXPerpData` slot is
 * installed on that account. Owner / delegate metadata is queryable on
 * `waterx_account::AccountRegistry` separately.
 */
export function accountData(options: AccountDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketDataArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface MarketDataOptions {
    package?: string;
    arguments: MarketDataArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Get market config + state from a Market object. */
export function marketData(options: MarketDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'market_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GlobalConfigDataArguments {
    cfg: RawTransactionArgument<string>;
}
export interface GlobalConfigDataOptions {
    package?: string;
    arguments: GlobalConfigDataArguments | [
        cfg: RawTransactionArgument<string>
    ];
}
/** Get protocol-wide config snapshot. */
export function globalConfigData(options: GlobalConfigDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["cfg"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'global_config_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PoolDataArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolDataOptions {
    package?: string;
    arguments: PoolDataArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Get pool data. */
export function poolData(options: PoolDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'pool_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TokenPoolDataArguments {
    pool: RawTransactionArgument<string>;
    tokenIndex: RawTransactionArgument<number | bigint>;
}
export interface TokenPoolDataOptions {
    package?: string;
    arguments: TokenPoolDataArguments | [
        pool: RawTransactionArgument<string>,
        tokenIndex: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Get token pool data by index. */
export function tokenPoolData(options: TokenPoolDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'token_pool_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TokenPoolsDataArguments {
    pool: RawTransactionArgument<string>;
}
export interface TokenPoolsDataOptions {
    package?: string;
    arguments: TokenPoolsDataArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Get all token pools in a WLP pool as a vector. */
export function tokenPoolsData(options: TokenPoolsDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'token_pools_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionExistsArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionExistsOptions {
    package?: string;
    arguments: PositionExistsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Check if a position exists. */
export function positionExists(options: PositionExistsOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'position_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionDataArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    collateralPriceUsd: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionDataOptions {
    package?: string;
    arguments: PositionDataArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        collateralPriceUsd: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Enriched position data with computed PnL, fees, leverage, and estimated liq
 * price. Prices are `u64` USD values (e.g. 50000 for $50k) — converted to Float
 * internally.
 */
export function positionData(options: PositionDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "pool", "basePriceUsd", "collateralPriceUsd", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'position_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderDataArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    orderTypeTag: RawTransactionArgument<number>;
    triggerPrice: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderDataOptions {
    package?: string;
    arguments: OrderDataArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        orderTypeTag: RawTransactionArgument<number>,
        triggerPrice: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Enriched order data with current oracle price. Caller provides order location:
 * `order_type_tag` (0-3), `trigger_price` (raw scaled value), `order_id`.
 */
export function orderData(options: OrderDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        'u64',
        'u8',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "basePriceUsd", "orderTypeTag", "triggerPrice", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'order_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetAccountPositionsArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    collateralPriceUsd: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
}
export interface GetAccountPositionsOptions {
    package?: string;
    arguments: GetAccountPositionsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        collateralPriceUsd: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Get all positions for an account in a specific market, returned as enriched
 * PositionData. Prices are `u64` USD values (e.g. 50000 for $50k).
 */
export function getAccountPositions(options: GetAccountPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        null,
        null,
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "pool", "wxaRegistry", "basePriceUsd", "collateralPriceUsd", "accountObjectAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'get_account_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetAccountOrdersArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
}
export interface GetAccountOrdersOptions {
    package?: string;
    arguments: GetAccountOrdersArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Get all orders for an account in a specific market by scanning all 4 order maps.
 * `base_price_usd` is a `u64` USD value (e.g. 50000 for $50k).
 */
export function getAccountOrders(options: GetAccountOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "basePriceUsd", "accountObjectAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'get_account_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetMarketOrdersArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    cursor: RawTransactionArgument<number | bigint>;
    pageSize: RawTransactionArgument<number | bigint>;
}
export interface GetMarketOrdersOptions {
    package?: string;
    arguments: GetMarketOrdersArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        cursor: RawTransactionArgument<number | bigint>,
        pageSize: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Paginated list of all orders across all 4 order maps in a market. Cursor is an
 * opaque flat index across (tag, price_level, order_index). Returns
 * `(orders, next_cursor)` where `next_cursor` is `some(idx)` if more pages exist.
 */
export function getMarketOrders(options: GetMarketOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "basePriceUsd", "cursor", "pageSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'get_market_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetMarketPositionsArguments {
    marketRegistry: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    basePriceUsd: RawTransactionArgument<number | bigint>;
    collateralPriceUsd: RawTransactionArgument<number | bigint>;
    cursor: RawTransactionArgument<number | bigint>;
    pageSize: RawTransactionArgument<number | bigint>;
}
export interface GetMarketPositionsOptions {
    package?: string;
    arguments: GetMarketPositionsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        basePriceUsd: RawTransactionArgument<number | bigint>,
        collateralPriceUsd: RawTransactionArgument<number | bigint>,
        cursor: RawTransactionArgument<number | bigint>,
        pageSize: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Paginated list of all positions in a market, returned as enriched PositionData.
 * `cursor`: starting index (0-based). `page_size`: max entries to return. Returns
 * `(positions, next_cursor)` where `next_cursor` is `some(idx)` if more pages
 * exist.
 */
export function getMarketPositions(options: GetMarketPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "ticker", "pool", "basePriceUsd", "collateralPriceUsd", "cursor", "pageSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'get_market_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetRedeemRequestsArguments {
    pool: RawTransactionArgument<string>;
    cursor: RawTransactionArgument<number | bigint>;
    pageSize: RawTransactionArgument<number | bigint>;
}
export interface GetRedeemRequestsOptions {
    package?: string;
    arguments: GetRedeemRequestsArguments | [
        pool: RawTransactionArgument<string>,
        cursor: RawTransactionArgument<number | bigint>,
        pageSize: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Paginated list of all pending redeem requests in a WLP pool. `cursor`: starting
 * index (0-based). `page_size`: max entries to return. Returns
 * `(requests, next_cursor)` where `next_cursor` is `some(idx)` if more pages
 * exist.
 */
export function getRedeemRequests(options: GetRedeemRequestsOptions) {
    const packageAddress = options.package ?? '@waterx/perp-view';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "cursor", "pageSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'get_redeem_requests',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}