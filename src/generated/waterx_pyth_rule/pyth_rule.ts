/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as vec_map_1 from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/pyth-rule::pyth_rule';
export const PythRule = new MoveStruct({ name: `${$moduleName}::PythRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const Config = new MoveStruct({ name: `${$moduleName}::Config`, fields: {
        id: bcs.Address,
        /** Ticker (e.g. `b"BTC_USD".to_string()`) → Pyth feed identifier bytes. */
        identifier_map: vec_map.VecMap(bcs.string(), bcs.vector(bcs.u8())),
        /** Per-ticker timestamp tolerance in seconds. Falls back to DEFAULT_TOLERANCE_SEC. */
        tolerance_sec_map: vec_map_1.VecMap(bcs.string(), bcs.u64())
    } });
export interface FeedArguments {
    collector: RawTransactionArgument<string>;
    config: RawTransactionArgument<string>;
    pythState: RawTransactionArgument<string>;
    pythPriceInfo: RawTransactionArgument<string>;
}
export interface FeedOptions {
    package?: string;
    arguments: FeedArguments | [
        collector: RawTransactionArgument<string>,
        config: RawTransactionArgument<string>,
        pythState: RawTransactionArgument<string>,
        pythPriceInfo: RawTransactionArgument<string>
    ];
}
/**
 * Reads a Pyth price for `collector.symbol()` and feeds it. Drops the value
 * (records `none`) if the on-chain timestamp diverges from the Pyth feed timestamp
 * by more than the configured tolerance.
 */
export function feed(options: FeedOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "config", "pythState", "pythPriceInfo"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetIdentifierArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    identifier: RawTransactionArgument<number[]>;
}
export interface SetIdentifierOptions {
    package?: string;
    arguments: SetIdentifierArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        identifier: RawTransactionArgument<number[]>
    ];
}
export function setIdentifier(options: SetIdentifierOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "identifier"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'set_identifier',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetToleranceSecArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    toleranceSec: RawTransactionArgument<number | bigint>;
}
export interface SetToleranceSecOptions {
    package?: string;
    arguments: SetToleranceSecArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        toleranceSec: RawTransactionArgument<number | bigint>
    ];
}
export function setToleranceSec(options: SetToleranceSecOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "toleranceSec"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'set_tolerance_sec',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}