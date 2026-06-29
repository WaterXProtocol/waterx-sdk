/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/pyth-rule::pyth_rule';
export const PythRule = new MoveStruct({ name: `${$moduleName}::PythRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const Config = new MoveStruct({ name: `${$moduleName}::Config`, fields: {
        id: bcs.Address,
        /** Ticker (e.g. `b"BTC_USD".to_string()`) → Pyth feed identifier bytes. */
        identifier_map: vec_map.VecMap(bcs.string(), bcs.vector(bcs.u8())),
        /** Per-ticker timestamp tolerance in seconds. Falls back to DEFAULT_TOLERANCE_SEC. */
        tolerance_sec_map: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export const MaxConfBpsKey = new MoveStruct({ name: `${$moduleName}::MaxConfBpsKey`, fields: {
        dummy_field: bcs.bool()
    } });
export const MaxConfBpsConfig = new MoveStruct({ name: `${$moduleName}::MaxConfBpsConfig`, fields: {
        /** Default max confidence band (bps of price) for symbols without an override. */
        default_bps: bcs.u64(),
        /** Per-symbol overrides. */
        by_symbol: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export interface FeedArguments {
    collector: TransactionArgument;
    config: RawTransactionArgument<string>;
    pythState: RawTransactionArgument<string>;
    pythPriceInfo: RawTransactionArgument<string>;
}
export interface FeedOptions {
    package?: string;
    arguments: FeedArguments | [
        collector: TransactionArgument,
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
    identifier: RawTransactionArgument<Array<number>>;
}
export interface SetIdentifierOptions {
    package?: string;
    arguments: SetIdentifierArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        identifier: RawTransactionArgument<Array<number>>
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
export interface SetDefaultMaxConfidenceBpsArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    defaultBps: RawTransactionArgument<number | bigint>;
}
export interface SetDefaultMaxConfidenceBpsOptions {
    package?: string;
    arguments: SetDefaultMaxConfidenceBpsArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        defaultBps: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Sets the default confidence gate (bps of price) applied to symbols without an
 * explicit override. `10_000` = 100%. Lazily creates the confidence-gate DF.
 */
export function setDefaultMaxConfidenceBps(options: SetDefaultMaxConfidenceBpsOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "defaultBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'set_default_max_confidence_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetSymbolMaxConfidenceBpsArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    bps: RawTransactionArgument<number | bigint>;
}
export interface SetSymbolMaxConfidenceBpsOptions {
    package?: string;
    arguments: SetSymbolMaxConfidenceBpsArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        bps: RawTransactionArgument<number | bigint>
    ];
}
/** Sets a per-symbol confidence gate (bps of price), overriding the default. */
export function setSymbolMaxConfidenceBps(options: SetSymbolMaxConfidenceBpsOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "bps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'set_symbol_max_confidence_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnsetSymbolMaxConfidenceBpsArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface UnsetSymbolMaxConfidenceBpsOptions {
    package?: string;
    arguments: UnsetSymbolMaxConfidenceBpsArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * Removes a per-symbol confidence override (no-op if absent); the symbol then
 * falls back to the default.
 */
export function unsetSymbolMaxConfidenceBps(options: UnsetSymbolMaxConfidenceBpsOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'unset_symbol_max_confidence_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxConfidenceBpsArguments {
    config: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface MaxConfidenceBpsOptions {
    package?: string;
    arguments: MaxConfidenceBpsArguments | [
        config: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * The effective confidence gate (bps of price) `feed` applies for `symbol`:
 * per-symbol override → default → `DEFAULT_MAX_CONFIDENCE_BPS`.
 */
export function maxConfidenceBps(options: MaxConfidenceBpsOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'max_confidence_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DefaultMaxConfidenceBpsArguments {
    config: RawTransactionArgument<string>;
}
export interface DefaultMaxConfidenceBpsOptions {
    package?: string;
    arguments: DefaultMaxConfidenceBpsArguments | [
        config: RawTransactionArgument<string>
    ];
}
/**
 * The configured default confidence gate, or `DEFAULT_MAX_CONFIDENCE_BPS` if
 * unset.
 */
export function defaultMaxConfidenceBps(options: DefaultMaxConfidenceBpsOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_rule',
        function: 'default_max_confidence_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}