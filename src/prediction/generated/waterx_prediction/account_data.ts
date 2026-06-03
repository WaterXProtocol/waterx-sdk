/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Per-account prediction broker index, stored as a `WaterXPredictionData` blob on
 * the shared `waterx_account::Account` object via `wxa::new_data` /
 * `wxa::borrow_data` / `wxa::borrow_data_mut`.
 * 
 * `MarketRegistry` remains the canonical storage for orders and positions. This
 * slot is an account-centric index for wallet UX and indexers: account ->
 * order_ids / position_ids, plus account -> market_key -> ids.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as linked_table from './deps/bucket_v2_framework/linked_table.ts';
import * as table from './deps/sui/table.ts';
const $moduleName = '@waterx/prediction::account_data';
export const WaterXPrediction: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::WaterXPrediction`, fields: {
        dummy_field: bcs.bool()
    } });
export const WaterXPredictionData: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::WaterXPredictionData`, fields: {
        /** Pending open/close order IDs for this account. Value = market key. */
        orders: linked_table.LinkedTable(bcs.u64()),
        /** Active position IDs for this account. Value = market key. */
        positions: linked_table.LinkedTable(bcs.u64()),
        /** Per-market pending order ID sets. Key = market key. */
        orders_by_market: table.Table,
        /** Per-market active position ID sets. Key = market key. */
        positions_by_market: table.Table
    } });
export interface PermPlaceOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function permPlaceOrder(options: PermPlaceOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_place_order',
    });
}
export interface PermCancelOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function permCancelOrder(options: PermCancelOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_cancel_order',
    });
}
export interface PermClaimOptions {
    package?: string;
    arguments?: [
    ];
}
export function permClaim(options: PermClaimOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_claim',
    });
}
export interface PermRequestCloseOptions {
    package?: string;
    arguments?: [
    ];
}
export function permRequestClose(options: PermRequestCloseOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_request_close',
    });
}
export interface PermTransferPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permTransferPosition(options: PermTransferPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_transfer_position',
    });
}
export interface AccountOrdersArguments {
    data: TransactionArgument;
}
export interface AccountOrdersOptions {
    package?: string;
    arguments: AccountOrdersArguments | [
        data: TransactionArgument
    ];
}
export function accountOrders(options: AccountOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'account_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionsArguments {
    data: TransactionArgument;
}
export interface AccountPositionsOptions {
    package?: string;
    arguments: AccountPositionsArguments | [
        data: TransactionArgument
    ];
}
export function accountPositions(options: AccountPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'account_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCountArguments {
    data: TransactionArgument;
}
export interface OrderCountOptions {
    package?: string;
    arguments: OrderCountArguments | [
        data: TransactionArgument
    ];
}
export function orderCount(options: OrderCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCountArguments {
    data: TransactionArgument;
}
export interface PositionCountOptions {
    package?: string;
    arguments: PositionCountArguments | [
        data: TransactionArgument
    ];
}
export function positionCount(options: PositionCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderFrontArguments {
    data: TransactionArgument;
}
export interface OrderFrontOptions {
    package?: string;
    arguments: OrderFrontArguments | [
        data: TransactionArgument
    ];
}
export function orderFront(options: OrderFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderBackArguments {
    data: TransactionArgument;
}
export interface OrderBackOptions {
    package?: string;
    arguments: OrderBackArguments | [
        data: TransactionArgument
    ];
}
export function orderBack(options: OrderBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderNextArguments {
    data: TransactionArgument;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderNextOptions {
    package?: string;
    arguments: OrderNextArguments | [
        data: TransactionArgument,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function orderNext(options: OrderNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionFrontArguments {
    data: TransactionArgument;
}
export interface PositionFrontOptions {
    package?: string;
    arguments: PositionFrontArguments | [
        data: TransactionArgument
    ];
}
export function positionFront(options: PositionFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionBackArguments {
    data: TransactionArgument;
}
export interface PositionBackOptions {
    package?: string;
    arguments: PositionBackArguments | [
        data: TransactionArgument
    ];
}
export function positionBack(options: PositionBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionNextArguments {
    data: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionNextOptions {
    package?: string;
    arguments: PositionNextArguments | [
        data: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function positionNext(options: PositionNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderMarketKeyArguments {
    data: TransactionArgument;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderMarketKeyOptions {
    package?: string;
    arguments: OrderMarketKeyArguments | [
        data: TransactionArgument,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function orderMarketKey(options: OrderMarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionMarketKeyArguments {
    data: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionMarketKeyOptions {
    package?: string;
    arguments: PositionMarketKeyArguments | [
        data: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function positionMarketKey(options: PositionMarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketOrderCountArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketOrderCountOptions {
    package?: string;
    arguments: MarketOrderCountArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketOrderCount(options: MarketOrderCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_order_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketPositionCountArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketPositionCountOptions {
    package?: string;
    arguments: MarketPositionCountArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketPositionCount(options: MarketPositionCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_position_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketOrderFrontArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketOrderFrontOptions {
    package?: string;
    arguments: MarketOrderFrontArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketOrderFront(options: MarketOrderFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_order_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketOrderBackArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketOrderBackOptions {
    package?: string;
    arguments: MarketOrderBackArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketOrderBack(options: MarketOrderBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_order_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketOrderNextArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface MarketOrderNextOptions {
    package?: string;
    arguments: MarketOrderNextArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function marketOrderNext(options: MarketOrderNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_order_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketPositionFrontArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketPositionFrontOptions {
    package?: string;
    arguments: MarketPositionFrontArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketPositionFront(options: MarketPositionFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_position_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketPositionBackArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketPositionBackOptions {
    package?: string;
    arguments: MarketPositionBackArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function marketPositionBack(options: MarketPositionBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_position_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketPositionNextArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface MarketPositionNextOptions {
    package?: string;
    arguments: MarketPositionNextArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function marketPositionNext(options: MarketPositionNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'market_position_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderIdsByMarketArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface OrderIdsByMarketOptions {
    package?: string;
    arguments: OrderIdsByMarketArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function orderIdsByMarket(options: OrderIdsByMarketOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'order_ids_by_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionIdsByMarketArguments {
    data: TransactionArgument;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface PositionIdsByMarketOptions {
    package?: string;
    arguments: PositionIdsByMarketArguments | [
        data: TransactionArgument,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function positionIdsByMarket(options: PositionIdsByMarketOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["data", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'position_ids_by_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasAccountArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface HasAccountOptions {
    package?: string;
    arguments: HasAccountArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * True if a `WaterXPredictionData` slot exists on the wxa account. The slot
 * auto-installs on first order/position add.
 */
export function hasAccount(options: HasAccountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'has_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowAccountArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface BorrowAccountOptions {
    package?: string;
    arguments: BorrowAccountArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Borrow the prediction data blob. Aborts if the account has not traded yet. */
export function borrowAccount(options: BorrowAccountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'borrow_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}