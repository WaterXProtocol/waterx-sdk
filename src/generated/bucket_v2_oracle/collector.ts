/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@bucket/oracle::collector';
export const PriceCollector = new MoveStruct({ name: `${$moduleName}::PriceCollector<phantom T>`, fields: {
        contents: vec_map.VecMap(type_name.TypeName, bcs.option(float.Float))
    } });
export interface NewOptions {
    package?: string;
    arguments?: [
    ];
    typeArguments: [
        string
    ];
}
/** Creates a new, empty PriceCollector for a given context T. */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'new',
        typeArguments: options.typeArguments
    });
}
export interface CollectArguments<R extends BcsType<any>> {
    collector: RawTransactionArgument<string>;
    Witenss: RawTransactionArgument<R>;
    price: RawTransactionArgument<string | null>;
}
export interface CollectOptions<R extends BcsType<any>> {
    package?: string;
    arguments: CollectArguments<R> | [
        collector: RawTransactionArgument<string>,
        Witenss: RawTransactionArgument<R>,
        price: RawTransactionArgument<string | null>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function collect<R extends BcsType<any>>(options: CollectOptions<R>) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        `${options.typeArguments[1]}`,
        '0x1::option::Option<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "Witenss", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'collect',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ContentsArguments {
    collector: RawTransactionArgument<string>;
}
export interface ContentsOptions {
    package?: string;
    arguments: ContentsArguments | [
        collector: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Returns an immutable reference to the contents VecMap of the collector. This
 * allows inspection of all collected prices by rule type.
 */
export function contents(options: ContentsOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["collector"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'collector',
        function: 'contents',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}