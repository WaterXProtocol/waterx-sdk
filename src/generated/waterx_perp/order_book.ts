/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as linked_table from './deps/bucket_v2_framework/linked_table.ts';
import * as keyed_big_vector from './keyed_big_vector.ts';
const $moduleName = '@waterx/perp::order_book';
export const PriceLevel = new MoveStruct({ name: `${$moduleName}::PriceLevel`, fields: {
        orders: linked_table.LinkedTable(bcs.u64())
    } });
export const OrderBook = new MoveStruct({ name: `${$moduleName}::OrderBook`, fields: {
        levels: keyed_big_vector.KeyedBigVector
    } });
export interface NewOptions {
    package?: string;
    arguments?: [
    ];
}
export function _new(options: NewOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'new',
    });
}
export interface ContainsLevelArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
}
export interface ContainsLevelOptions {
    package?: string;
    arguments: ContainsLevelArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>
    ];
}
export function containsLevel(options: ContainsLevelOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'contains_level',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddOrderArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    order: RawTransactionArgument<string>;
}
export interface AddOrderOptions {
    package?: string;
    arguments: AddOrderArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        order: RawTransactionArgument<string>
    ];
}
export function addOrder(options: AddOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'add_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveOrderArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface RemoveOrderOptions {
    package?: string;
    arguments: RemoveOrderArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function removeOrder(options: RemoveOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'remove_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PopOrderForMatchArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
}
export interface PopOrderForMatchOptions {
    package?: string;
    arguments: PopOrderForMatchArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>
    ];
}
export function popOrderForMatch(options: PopOrderForMatchOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'pop_order_for_match',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowOrderArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface BorrowOrderOptions {
    package?: string;
    arguments: BorrowOrderArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function borrowOrder(options: BorrowOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'borrow_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowOrderMutArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface BorrowOrderMutOptions {
    package?: string;
    arguments: BorrowOrderMutArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function borrowOrderMut(options: BorrowOrderMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'borrow_order_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowLevelByIndexArguments {
    book: RawTransactionArgument<string>;
    levelIndex: RawTransactionArgument<number | bigint>;
}
export interface BorrowLevelByIndexOptions {
    package?: string;
    arguments: BorrowLevelByIndexArguments | [
        book: RawTransactionArgument<string>,
        levelIndex: RawTransactionArgument<number | bigint>
    ];
}
export function borrowLevelByIndex(options: BorrowLevelByIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "levelIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'borrow_level_by_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DestroyEmptyArguments {
    book: RawTransactionArgument<string>;
}
export interface DestroyEmptyOptions {
    package?: string;
    arguments: DestroyEmptyArguments | [
        book: RawTransactionArgument<string>
    ];
}
export function destroyEmpty(options: DestroyEmptyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["book"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'destroy_empty',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ContainsOrderArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface ContainsOrderOptions {
    package?: string;
    arguments: ContainsOrderArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function containsOrder(options: ContainsOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'contains_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCountAtArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
}
export interface OrderCountAtOptions {
    package?: string;
    arguments: OrderCountAtArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>
    ];
}
export function orderCountAt(options: OrderCountAtOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'order_count_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelCountArguments {
    book: RawTransactionArgument<string>;
}
export interface LevelCountOptions {
    package?: string;
    arguments: LevelCountArguments | [
        book: RawTransactionArgument<string>
    ];
}
export function levelCount(options: LevelCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["book"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'level_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TakeLevelArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
}
export interface TakeLevelOptions {
    package?: string;
    arguments: TakeLevelArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>
    ];
}
export function takeLevel(options: TakeLevelOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'take_level',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RestoreLevelArguments {
    book: RawTransactionArgument<string>;
    priceKey: RawTransactionArgument<number | bigint>;
    level: RawTransactionArgument<string>;
}
export interface RestoreLevelOptions {
    package?: string;
    arguments: RestoreLevelArguments | [
        book: RawTransactionArgument<string>,
        priceKey: RawTransactionArgument<number | bigint>,
        level: RawTransactionArgument<string>
    ];
}
export function restoreLevel(options: RestoreLevelOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u128',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["book", "priceKey", "level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'restore_level',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PopFrontArguments {
    level: RawTransactionArgument<string>;
}
export interface PopFrontOptions {
    package?: string;
    arguments: PopFrontArguments | [
        level: RawTransactionArgument<string>
    ];
}
export function popFront(options: PopFrontOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'pop_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PushFrontArguments {
    level: RawTransactionArgument<string>;
    order: RawTransactionArgument<string>;
}
export interface PushFrontOptions {
    package?: string;
    arguments: PushFrontArguments | [
        level: RawTransactionArgument<string>,
        order: RawTransactionArgument<string>
    ];
}
export function pushFront(options: PushFrontOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level", "order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'push_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PushBackArguments {
    level: RawTransactionArgument<string>;
    order: RawTransactionArgument<string>;
}
export interface PushBackOptions {
    package?: string;
    arguments: PushBackArguments | [
        level: RawTransactionArgument<string>,
        order: RawTransactionArgument<string>
    ];
}
export function pushBack(options: PushBackOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level", "order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'push_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelIsEmptyArguments {
    level: RawTransactionArgument<string>;
}
export interface LevelIsEmptyOptions {
    package?: string;
    arguments: LevelIsEmptyArguments | [
        level: RawTransactionArgument<string>
    ];
}
export function levelIsEmpty(options: LevelIsEmptyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'level_is_empty',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelOrderCountArguments {
    level: RawTransactionArgument<string>;
}
export interface LevelOrderCountOptions {
    package?: string;
    arguments: LevelOrderCountArguments | [
        level: RawTransactionArgument<string>
    ];
}
export function levelOrderCount(options: LevelOrderCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'level_order_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelFrontOrderIdArguments {
    level: RawTransactionArgument<string>;
}
export interface LevelFrontOrderIdOptions {
    package?: string;
    arguments: LevelFrontOrderIdArguments | [
        level: RawTransactionArgument<string>
    ];
}
export function levelFrontOrderId(options: LevelFrontOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'level_front_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LevelNextOrderIdArguments {
    level: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface LevelNextOrderIdOptions {
    package?: string;
    arguments: LevelNextOrderIdArguments | [
        level: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function levelNextOrderId(options: LevelNextOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["level", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'level_next_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowLevelOrderArguments {
    level: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface BorrowLevelOrderOptions {
    package?: string;
    arguments: BorrowLevelOrderArguments | [
        level: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function borrowLevelOrder(options: BorrowLevelOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["level", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'borrow_level_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DestroyEmptyLevelArguments {
    level: RawTransactionArgument<string>;
}
export interface DestroyEmptyLevelOptions {
    package?: string;
    arguments: DestroyEmptyLevelArguments | [
        level: RawTransactionArgument<string>
    ];
}
export function destroyEmptyLevel(options: DestroyEmptyLevelOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["level"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order_book',
        function: 'destroy_empty_level',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}