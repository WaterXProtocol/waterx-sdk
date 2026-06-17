/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/constant-rule::constant_rule';
export const ConstantRule = new MoveStruct({ name: `${$moduleName}::ConstantRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const Config = new MoveStruct({ name: `${$moduleName}::Config`, fields: {
        id: bcs.Address,
        /** Ticker (e.g. `b"USD".to_string()`) → constant `Float` price returned by `feed`. */
        prices: vec_map.VecMap(bcs.string(), float.Float)
    } });
export const ConstantPriceSet = new MoveStruct({ name: `${$moduleName}::ConstantPriceSet`, fields: {
        symbol: bcs.string(),
        scaled_price: bcs.option(bcs.u128())
    } });
export interface FeedArguments {
    collector: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
}
export interface FeedOptions {
    package?: string;
    arguments: FeedArguments | [
        collector: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>
    ];
}
/**
 * Contributes the configured constant for `collector.symbol()` to the
 * `PriceCollector`. Abstains (records `none`) when no constant is configured so
 * other rules in the same collector can still satisfy `weight_threshold`.
 */
export function feed(options: FeedOptions) {
    const packageAddress = options.package ?? '@waterx/constant-rule';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'constant_rule',
        function: 'feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetConstantPriceArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    scaledPrice: RawTransactionArgument<number | bigint | null>;
}
export interface SetConstantPriceOptions {
    package?: string;
    arguments: SetConstantPriceArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        scaledPrice: RawTransactionArgument<number | bigint | null>
    ];
}
/**
 * Sets the constant `Float` price for `symbol` (passed as the raw 1e9-scaled
 * `u128`). Passing `none` removes the entry. Emits `ConstantPriceSet`.
 */
export function setConstantPrice(options: SetConstantPriceOptions) {
    const packageAddress = options.package ?? '@waterx/constant-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x1::option::Option<u128>'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "scaledPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'constant_rule',
        function: 'set_constant_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}