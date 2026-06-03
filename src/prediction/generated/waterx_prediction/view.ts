/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as order_1 from './order.ts';
import * as position_1 from './position.ts';
import * as outcome from './outcome.ts';
const $moduleName = '@waterx/prediction::view';
export const RegistryView: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::RegistryView`, fields: {
        balance: bcs.u64(),
        min_reserve: bcs.u64(),
        order_cancel_cooldown_ms: bcs.u64(),
        next_order_id: bcs.u64(),
        next_position_id: bcs.u64(),
        order_count: bcs.u64(),
        position_count: bcs.u64(),
        unresolved_market_count: bcs.u64(),
        resolved_market_count: bcs.u64()
    } });
export const OrderView: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::OrderView`, fields: {
        order_id: bcs.u64(),
        kind: order_1.OrderKind,
        account_id: bcs.Address,
        receiver_account_id: bcs.Address,
        market_id: bcs.vector(bcs.u8()),
        selection: position_1.Selection,
        position_id: bcs.option(bcs.u64()),
        max_spend: bcs.u64(),
        min_shares: bcs.u64(),
        price_cap: bcs.u64(),
        min_proceeds: bcs.u64(),
        expiry_ts: bcs.u64(),
        self_cancel_after_ts: bcs.u64(),
        created_ts: bcs.u64(),
        by_admin: bcs.bool()
    } });
export const PositionView: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::PositionView`, fields: {
        position_id: bcs.u64(),
        account_id: bcs.Address,
        market_id: bcs.vector(bcs.u8()),
        selection: position_1.Selection,
        status: position_1.Status,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        opened_ts: bcs.u64(),
        payout: bcs.u64(),
        close_order_id: bcs.option(bcs.u64()),
        close_min_proceeds: bcs.u64(),
        close_expiry_ts: bcs.u64(),
        close_self_cancel_after_ts: bcs.u64()
    } });
export const MarketView: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketView`, fields: {
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        resolved: bcs.bool(),
        paused: bcs.bool(),
        outcome: bcs.option(outcome.Outcome),
        unclaimed_count: bcs.u64(),
        yes_shares: bcs.u64(),
        yes_cost: bcs.u64(),
        no_shares: bcs.u64(),
        no_cost: bcs.u64()
    } });
export const AccountDataView: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::AccountDataView`, fields: {
        account_id: bcs.Address,
        has_data: bcs.bool(),
        order_count: bcs.u64(),
        position_count: bcs.u64(),
        order_front: bcs.option(bcs.u64()),
        order_back: bcs.option(bcs.u64()),
        position_front: bcs.option(bcs.u64()),
        position_back: bcs.option(bcs.u64())
    } });
export interface RegistryArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface RegistryOptions {
    package?: string;
    arguments: RegistryArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function registry(options: RegistryOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'registry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderOptions {
    package?: string;
    arguments: OrderArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function order(options: OrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionOptions {
    package?: string;
    arguments: PositionArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function position(options: PositionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketByIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketByIdOptions {
    package?: string;
    arguments: MarketByIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function marketById(options: MarketByIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'market_by_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketByKeyOptions {
    package?: string;
    arguments: MarketByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketByKey(options: MarketByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'market_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderCursorArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface OrderCursorOptions {
    package?: string;
    arguments: OrderCursorArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orderCursor(options: OrderCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'order_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCursorArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface PositionCursorOptions {
    package?: string;
    arguments: PositionCursorArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function positionCursor(options: PositionCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'position_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketCursorArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface UnresolvedMarketCursorOptions {
    package?: string;
    arguments: UnresolvedMarketCursorArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketCursor(options: UnresolvedMarketCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'unresolved_market_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketCursorArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface ResolvedMarketCursorOptions {
    package?: string;
    arguments: ResolvedMarketCursorArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketCursor(options: ResolvedMarketCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'resolved_market_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountOptions {
    package?: string;
    arguments: AccountArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
export function account(options: AccountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrderCursorArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountOrderCursorOptions {
    package?: string;
    arguments: AccountOrderCursorArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
export function accountOrderCursor(options: AccountOrderCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_order_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionCursorArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountPositionCursorOptions {
    package?: string;
    arguments: AccountPositionCursorArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
export function accountPositionCursor(options: AccountPositionCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_position_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrderIdsArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface AccountOrderIdsOptions {
    package?: string;
    arguments: AccountOrderIdsArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function accountOrderIds(options: AccountOrderIdsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_order_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionIdsArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface AccountPositionIdsOptions {
    package?: string;
    arguments: AccountPositionIdsArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function accountPositionIds(options: AccountPositionIdsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_position_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrderIdsByMarketIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface AccountOrderIdsByMarketIdOptions {
    package?: string;
    arguments: AccountOrderIdsByMarketIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function accountOrderIdsByMarketId(options: AccountOrderIdsByMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "wxaRegistry", "accountId", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_order_ids_by_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountPositionIdsByMarketIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface AccountPositionIdsByMarketIdOptions {
    package?: string;
    arguments: AccountPositionIdsByMarketIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function accountPositionIdsByMarketId(options: AccountPositionIdsByMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "wxaRegistry", "accountId", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_position_ids_by_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountMarketOrderCursorArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface AccountMarketOrderCursorOptions {
    package?: string;
    arguments: AccountMarketOrderCursorArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function accountMarketOrderCursor(options: AccountMarketOrderCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_market_order_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountMarketPositionCursorArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface AccountMarketPositionCursorOptions {
    package?: string;
    arguments: AccountMarketPositionCursorArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
}
export function accountMarketPositionCursor(options: AccountMarketPositionCursorOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_market_position_cursor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrderNextArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface AccountOrderNextOptions {
    package?: string;
    arguments: AccountOrderNextArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function accountOrderNext(options: AccountOrderNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_order_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionNextArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface AccountPositionNextOptions {
    package?: string;
    arguments: AccountPositionNextArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function accountPositionNext(options: AccountPositionNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_position_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountMarketOrderNextArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface AccountMarketOrderNextOptions {
    package?: string;
    arguments: AccountMarketOrderNextArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function accountMarketOrderNext(options: AccountMarketOrderNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_market_order_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountMarketPositionNextArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface AccountMarketPositionNextOptions {
    package?: string;
    arguments: AccountMarketPositionNextArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function accountMarketPositionNext(options: AccountMarketPositionNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketKey", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_market_position_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrderMarketKeyArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface AccountOrderMarketKeyOptions {
    package?: string;
    arguments: AccountOrderMarketKeyArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function accountOrderMarketKey(options: AccountOrderMarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_order_market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionMarketKeyArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface AccountPositionMarketKeyOptions {
    package?: string;
    arguments: AccountPositionMarketKeyArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function accountPositionMarketKey(options: AccountPositionMarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'view',
        function: 'account_position_market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}