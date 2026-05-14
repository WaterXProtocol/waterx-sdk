/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Hot-potato collector for oracle rules feeding prices for a single ticker. */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
const $moduleName = '@waterx/oracle::collector';
export const PriceObservation = new MoveStruct({ name: `${$moduleName}::PriceObservation`, fields: {
        price: float.Float,
        timestamp_ms: bcs.option(bcs.u64())
    } });
export const PriceCollector = new MoveStruct({ name: `${$moduleName}::PriceCollector`, fields: {
        symbol: bcs.string(),
        contents: vec_map.VecMap(type_name.TypeName, bcs.option(PriceObservation))
    } });
export interface SymbolArguments {
    c: RawTransactionArgument<string>;
}
export interface SymbolOptions {
    package?: string;
    arguments: SymbolArguments | [
        c: RawTransactionArgument<string>
    ];
}
export function symbol(options: SymbolOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["c"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ContentsArguments {
    c: RawTransactionArgument<string>;
}
export interface ContentsOptions {
    package?: string;
    arguments: ContentsArguments | [
        c: RawTransactionArgument<string>
    ];
}
export function contents(options: ContentsOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["c"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'contents',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CollectArguments<R extends BcsType<any>> {
    c: RawTransactionArgument<string>;
    W: RawTransactionArgument<R>;
    price: RawTransactionArgument<string | null>;
}
export interface CollectOptions<R extends BcsType<any>> {
    package?: string;
    arguments: CollectArguments<R> | [
        c: RawTransactionArgument<string>,
        W: RawTransactionArgument<R>,
        price: RawTransactionArgument<string | null>
    ];
    typeArguments: [
        string
    ];
}
/** A rule reports its observed price (or `none` if stale / unavailable). */
export function collect<R extends BcsType<any>>(options: CollectOptions<R>) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`,
        '0x1::option::Option<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["c", "W", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'collect',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CollectAtArguments<R extends BcsType<any>> {
    c: RawTransactionArgument<string>;
    W: RawTransactionArgument<R>;
    price: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
}
export interface CollectAtOptions<R extends BcsType<any>> {
    package?: string;
    arguments: CollectAtArguments<R> | [
        c: RawTransactionArgument<string>,
        W: RawTransactionArgument<R>,
        price: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** A rule reports a price that is bound to an exact source timestamp. */
export function collectAt<R extends BcsType<any>>(options: CollectAtOptions<R>) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["c", "W", "price", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'collect_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ObservationPriceArguments {
    o: RawTransactionArgument<string>;
}
export interface ObservationPriceOptions {
    package?: string;
    arguments: ObservationPriceArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function observationPrice(options: ObservationPriceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'observation_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ObservationTimestampMsArguments {
    o: RawTransactionArgument<string>;
}
export interface ObservationTimestampMsOptions {
    package?: string;
    arguments: ObservationTimestampMsArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function observationTimestampMs(options: ObservationTimestampMsOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'observation_timestamp_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}