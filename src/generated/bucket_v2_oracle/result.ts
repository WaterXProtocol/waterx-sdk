/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@bucket/oracle::result';
export const PriceResult = new MoveStruct({ name: `${$moduleName}::PriceResult<phantom T>`, fields: {
        /** The aggregated price value as a Float */
        aggregated_price: float.Float
    } });
export interface AggregatedPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface AggregatedPriceOptions {
    package?: string;
    arguments: AggregatedPriceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Getter Funs Returns the aggregated price from the PriceResult for the given
 * asset type T.
 */
export function aggregatedPrice(options: AggregatedPriceOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'result',
        function: 'aggregated_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}