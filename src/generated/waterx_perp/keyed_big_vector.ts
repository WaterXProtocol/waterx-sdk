/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * This module implements a `KeyedBigVector`, a data structure that combines the
 * features of a `BigVector` and a `Table`. It allows for both indexed and keyed
 * access to a large number of elements by storing them in slices, while
 * maintaining a mapping from keys to indices in a `Table`.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as type_name_1 from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp::keyed_big_vector';
export const KeyedBigVector = new MoveStruct({ name: `${$moduleName}::KeyedBigVector`, fields: {
        /** The unique identifier of the KeyedBigVector object. */
        id: bcs.Address,
        /** The type name of the keys. */
        key_type: type_name.TypeName,
        /** The type name of the values. */
        value_type: type_name_1.TypeName,
        /** The index of the latest slice. */
        slice_idx: bcs.u16(),
        /** The maximum size of each slice. */
        slice_size: bcs.u32(),
        /** The total number of elements in the KeyedBigVector. */
        length: bcs.u64()
    } });
/** An element in the KeyedBigVector, containing a key-value pair. */
export function Element<K extends BcsType<any>, V extends BcsType<any>>(...typeParameters: [
    K,
    V
]) {
    return new MoveStruct({ name: `${$moduleName}::Element<${typeParameters[0].name as K['name']}, ${typeParameters[1].name as V['name']}>`, fields: {
            /** The key of the element. */
            key: typeParameters[0],
            /** The value of the element. */
            value: typeParameters[1]
        } });
}
/** A slice of the KeyedBigVector, containing a vector of elements. */
export function Slice<K extends BcsType<any>, V extends BcsType<any>>(...typeParameters: [
    K,
    V
]) {
    return new MoveStruct({ name: `${$moduleName}::Slice<${typeParameters[0].name as K['name']}, ${typeParameters[1].name as V['name']}>`, fields: {
            /** The index of the slice. */
            idx: bcs.u16(),
            /** The vector that stores the elements. */
            vector: bcs.vector(Element(typeParameters[0], typeParameters[1]))
        } });
}
export interface DuplicateKeyOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error for a duplicate key. */
export function duplicateKey(options: DuplicateKeyOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'duplicate_key',
    });
}
export interface IndexOutOfBoundsOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error for an out-of-bounds index. */
export function indexOutOfBounds(options: IndexOutOfBoundsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'index_out_of_bounds',
    });
}
export interface InvalidSliceSizeOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error for an invalid slice size. */
export function invalidSliceSize(options: InvalidSliceSizeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'invalid_slice_size',
    });
}
export interface KeyNotFoundOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error when a key is not found. */
export function keyNotFound(options: KeyNotFoundOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'key_not_found',
    });
}
export interface MaxSliceAmountReachedOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error when the maximum number of slices is reached. */
export function maxSliceAmountReached(options: MaxSliceAmountReachedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'max_slice_amount_reached',
    });
}
export interface NotEmptyOptions {
    package?: string;
    arguments?: [
    ];
}
/** Error when trying to destroy a non-empty KeyedBigVector. */
export function notEmpty(options: NotEmptyOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'not_empty',
    });
}
export interface NewArguments {
    sliceSize: RawTransactionArgument<number>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        sliceSize: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Creates a new `KeyedBigVector`. The `slice_size` determines the maximum number
 * of elements in each slice.
 */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u32'
    ] satisfies (string | null)[];
    const parameterNames = ["sliceSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SliceIdxArguments {
    kbv: RawTransactionArgument<string>;
}
export interface SliceIdxOptions {
    package?: string;
    arguments: SliceIdxArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Returns the index of the latest slice in the KeyedBigVector. */
export function sliceIdx(options: SliceIdxOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'slice_idx',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SliceSizeArguments {
    kbv: RawTransactionArgument<string>;
}
export interface SliceSizeOptions {
    package?: string;
    arguments: SliceSizeArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Returns the maximum size of each slice in the KeyedBigVector. */
export function sliceSize(options: SliceSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'slice_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LengthArguments {
    kbv: RawTransactionArgument<string>;
}
export interface LengthOptions {
    package?: string;
    arguments: LengthArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Returns the total number of elements in the KeyedBigVector. */
export function length(options: LengthOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'length',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsEmptyArguments {
    kbv: RawTransactionArgument<string>;
}
export interface IsEmptyOptions {
    package?: string;
    arguments: IsEmptyArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Returns `true` if the KeyedBigVector is empty. */
export function isEmpty(options: IsEmptyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'is_empty',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ContainsArguments<K extends BcsType<any>> {
    kbv: RawTransactionArgument<string>;
    key: RawTransactionArgument<K>;
}
export interface ContainsOptions<K extends BcsType<any>> {
    package?: string;
    arguments: ContainsArguments<K> | [
        kbv: RawTransactionArgument<string>,
        key: RawTransactionArgument<K>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Returns `true` if there is a value associated with the key `key` in the
 * KeyedBigVector.
 */
export function contains<K extends BcsType<any>>(options: ContainsOptions<K>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'contains',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSliceIdxArguments {
    slice: RawTransactionArgument<string>;
}
export interface GetSliceIdxOptions {
    package?: string;
    arguments: GetSliceIdxArguments | [
        slice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Returns the index of the slice. */
export function getSliceIdx(options: GetSliceIdxOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["slice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'get_slice_idx',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetSliceLengthArguments {
    slice: RawTransactionArgument<string>;
}
export interface GetSliceLengthOptions {
    package?: string;
    arguments: GetSliceLengthArguments | [
        slice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Returns the number of elements in the slice. */
export function getSliceLength(options: GetSliceLengthOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["slice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'get_slice_length',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PushBackArguments<K extends BcsType<any>, V extends BcsType<any>> {
    kbv: RawTransactionArgument<string>;
    key: RawTransactionArgument<K>;
    value: RawTransactionArgument<V>;
}
export interface PushBackOptions<K extends BcsType<any>, V extends BcsType<any>> {
    package?: string;
    arguments: PushBackArguments<K, V> | [
        kbv: RawTransactionArgument<string>,
        key: RawTransactionArgument<K>,
        value: RawTransactionArgument<V>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Pushes a new element to the end of the KeyedBigVector. Aborts if the key already
 * exists or if the maximum number of slices is reached.
 */
export function pushBack<K extends BcsType<any>, V extends BcsType<any>>(options: PushBackOptions<K, V>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "key", "value"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'push_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PopBackArguments {
    kbv: RawTransactionArgument<string>;
}
export interface PopBackOptions {
    package?: string;
    arguments: PopBackArguments | [
        kbv: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Pops an element from the end of the KeyedBigVector and returns its key and
 * value. Aborts if the KeyedBigVector is empty.
 */
export function popBack(options: PopBackOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'pop_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowSliceArguments {
    kbv: RawTransactionArgument<string>;
    sliceIdx: RawTransactionArgument<number>;
}
export interface BorrowSliceOptions {
    package?: string;
    arguments: BorrowSliceArguments | [
        kbv: RawTransactionArgument<string>,
        sliceIdx: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows a slice from the KeyedBigVector at `slice_idx`. */
export function borrowSlice(options: BorrowSliceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "sliceIdx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_slice',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowSlice_Arguments {
    id: RawTransactionArgument<string>;
    sliceIdx: RawTransactionArgument<number>;
}
export interface BorrowSlice_Options {
    package?: string;
    arguments: BorrowSlice_Arguments | [
        id: RawTransactionArgument<string>,
        sliceIdx: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowSlice_(options: BorrowSlice_Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["id", "sliceIdx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_slice_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowSliceMutArguments {
    kbv: RawTransactionArgument<string>;
    sliceIdx: RawTransactionArgument<number>;
}
export interface BorrowSliceMutOptions {
    package?: string;
    arguments: BorrowSliceMutArguments | [
        kbv: RawTransactionArgument<string>,
        sliceIdx: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows a mutable slice from the KeyedBigVector at `slice_idx`. */
export function borrowSliceMut(options: BorrowSliceMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "sliceIdx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_slice_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowSliceMut_Arguments {
    id: RawTransactionArgument<string>;
    sliceIdx: RawTransactionArgument<number>;
}
export interface BorrowSliceMut_Options {
    package?: string;
    arguments: BorrowSliceMut_Arguments | [
        id: RawTransactionArgument<string>,
        sliceIdx: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowSliceMut_(options: BorrowSliceMut_Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["id", "sliceIdx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_slice_mut_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowArguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface BorrowOptions {
    package?: string;
    arguments: BorrowArguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows an element at index `i` from the KeyedBigVector. */
export function borrow(options: BorrowOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface Borrow_Arguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface Borrow_Options {
    package?: string;
    arguments: Borrow_Arguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrow_(options: Borrow_Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMutArguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface BorrowMutOptions {
    package?: string;
    arguments: BorrowMutArguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows a mutable element at index `i` from the KeyedBigVector. */
export function borrowMut(options: BorrowMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMut_Arguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface BorrowMut_Options {
    package?: string;
    arguments: BorrowMut_Arguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowMut_(options: BorrowMut_Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_mut_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowByKeyArguments<K extends BcsType<any>> {
    kbv: RawTransactionArgument<string>;
    key: RawTransactionArgument<K>;
}
export interface BorrowByKeyOptions<K extends BcsType<any>> {
    package?: string;
    arguments: BorrowByKeyArguments<K> | [
        kbv: RawTransactionArgument<string>,
        key: RawTransactionArgument<K>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows an element by its key from the KeyedBigVector. */
export function borrowByKey<K extends BcsType<any>>(options: BorrowByKeyOptions<K>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowByKeyMutArguments<K extends BcsType<any>> {
    kbv: RawTransactionArgument<string>;
    key: RawTransactionArgument<K>;
}
export interface BorrowByKeyMutOptions<K extends BcsType<any>> {
    package?: string;
    arguments: BorrowByKeyMutArguments<K> | [
        kbv: RawTransactionArgument<string>,
        key: RawTransactionArgument<K>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows a mutable element by its key from the KeyedBigVector. */
export function borrowByKeyMut<K extends BcsType<any>>(options: BorrowByKeyMutOptions<K>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_by_key_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowFromSliceArguments {
    slice: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface BorrowFromSliceOptions {
    package?: string;
    arguments: BorrowFromSliceArguments | [
        slice: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows an element at index `i` from a slice. */
export function borrowFromSlice(options: BorrowFromSliceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["slice", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_from_slice',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowFromSliceMutArguments {
    slice: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface BorrowFromSliceMutOptions {
    package?: string;
    arguments: BorrowFromSliceMutArguments | [
        slice: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Borrows a mutable element at index `i` from a slice. */
export function borrowFromSliceMut(options: BorrowFromSliceMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["slice", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'borrow_from_slice_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SwapRemoveArguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface SwapRemoveOptions {
    package?: string;
    arguments: SwapRemoveArguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Swaps the element at index `i` with the last element and removes it. */
export function swapRemove(options: SwapRemoveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'swap_remove',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SwapRemove_Arguments {
    kbv: RawTransactionArgument<string>;
    i: RawTransactionArgument<number | bigint>;
}
export interface SwapRemove_Options {
    package?: string;
    arguments: SwapRemove_Arguments | [
        kbv: RawTransactionArgument<string>,
        i: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function swapRemove_(options: SwapRemove_Options) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "i"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'swap_remove_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SwapRemoveByKeyArguments<K extends BcsType<any>> {
    kbv: RawTransactionArgument<string>;
    key: RawTransactionArgument<K>;
}
export interface SwapRemoveByKeyOptions<K extends BcsType<any>> {
    package?: string;
    arguments: SwapRemoveByKeyArguments<K> | [
        kbv: RawTransactionArgument<string>,
        key: RawTransactionArgument<K>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Swaps the element with the given key with the last element and removes it. */
export function swapRemoveByKey<K extends BcsType<any>>(options: SwapRemoveByKeyOptions<K>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["kbv", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'swap_remove_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DestroyEmptyArguments {
    kbv: RawTransactionArgument<string>;
}
export interface DestroyEmptyOptions {
    package?: string;
    arguments: DestroyEmptyArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Destroys an empty KeyedBigVector. Aborts if the KeyedBigVector is not empty. */
export function destroyEmpty(options: DestroyEmptyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'destroy_empty',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DropArguments {
    kbv: RawTransactionArgument<string>;
}
export interface DropOptions {
    package?: string;
    arguments: DropArguments | [
        kbv: RawTransactionArgument<string>
    ];
}
/** Destroys a KeyedBigVector. */
export function drop(options: DropOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'drop',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CompletelyDropArguments {
    kbv: RawTransactionArgument<string>;
}
export interface CompletelyDropOptions {
    package?: string;
    arguments: CompletelyDropArguments | [
        kbv: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Destroys a KeyedBigVector and its elements completely. */
export function completelyDrop(options: CompletelyDropOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'completely_drop',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TrimSliceArguments {
    kbv: RawTransactionArgument<string>;
}
export interface TrimSliceOptions {
    package?: string;
    arguments: TrimSliceArguments | [
        kbv: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Removes an empty slice after an element has been removed from it. */
export function trimSlice(options: TrimSliceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kbv"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'keyed_big_vector',
        function: 'trim_slice',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}