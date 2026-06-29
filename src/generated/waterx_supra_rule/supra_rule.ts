/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Supra oracle rule for `waterx_oracle`.
 *
 * Reads a price from Supra's push oracle (`OracleHolder`) and contributes it to a
 * `waterx_oracle::collector::PriceCollector` keyed by oracle `symbol`. Mirrors
 * `waterx_pyth_rule::pyth_rule`'s shape: a per-symbol id map (`pair_id`) plus a
 * per-symbol freshness tolerance, falling back to `DEFAULT_TOLERANCE_MS`.
 *
 * Like the other rules in this umbrella, `feed` _abstains_ (records `none`)
 * instead of aborting when the symbol is unconfigured or the Supra timestamp is
 * stale, so the aggregator can still reach `weight_threshold` from other rules.
 * The canonical kill switch is `oracle::set_rule_weight<SupraRule>(.., 0)`.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/supra-rule::supra_rule';
export const SupraRule = new MoveStruct({ name: `${$moduleName}::SupraRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const Config = new MoveStruct({ name: `${$moduleName}::Config`, fields: {
        id: bcs.Address,
        /** Oracle symbol (e.g. `b"BTC_USD".to_string()`) → Supra pair ID (`u32`). */
        pair_id_map: vec_map.VecMap(bcs.string(), bcs.u32()),
        /** Per-symbol freshness tolerance in ms. Falls back to `DEFAULT_TOLERANCE_MS`. */
        tolerance_ms_map: vec_map.VecMap(bcs.string(), bcs.u64())
    } });
export const SupraPairIdSet = new MoveStruct({ name: `${$moduleName}::SupraPairIdSet`, fields: {
        symbol: bcs.string(),
        /** `none` when the entry was removed. */
        pair_id: bcs.option(bcs.u32())
    } });
export const SupraToleranceSet = new MoveStruct({ name: `${$moduleName}::SupraToleranceSet`, fields: {
        symbol: bcs.string(),
        tolerance_ms: bcs.u64()
    } });
export interface FeedArguments {
    collector: TransactionArgument;
    config: RawTransactionArgument<string>;
    oracleHolder: TransactionArgument;
}
export interface FeedOptions {
    package?: string;
    arguments: FeedArguments | [
        collector: TransactionArgument,
        config: RawTransactionArgument<string>,
        oracleHolder: TransactionArgument
    ];
}
/**
 * Reads the Supra push price for `collector.symbol()` and contributes it. Abstains
 * (records `none`) when the symbol is unconfigured or the Supra timestamp diverges
 * from the on-chain clock by more than the configured tolerance, so other rules in
 * the same collector can still satisfy `weight_threshold`.
 */
export function feed(options: FeedOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["collector", "config", "oracleHolder"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'feed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PairIdArguments {
    config: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface PairIdOptions {
    package?: string;
    arguments: PairIdArguments | [
        config: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/** The Supra pair ID configured for `symbol`, or `none`. */
export function pairId(options: PairIdOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'pair_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ToleranceMsArguments {
    config: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface ToleranceMsOptions {
    package?: string;
    arguments: ToleranceMsArguments | [
        config: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * The freshness tolerance (ms) `feed` applies for `symbol`, resolving the
 * `DEFAULT_TOLERANCE_MS` fallback.
 */
export function toleranceMs(options: ToleranceMsOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'tolerance_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPairIdArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    pairId: RawTransactionArgument<number>;
}
export interface SetPairIdOptions {
    package?: string;
    arguments: SetPairIdArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        pairId: RawTransactionArgument<number>
    ];
}
/** Registers / overwrites the Supra pair ID for `symbol`. Emits `SupraPairIdSet`. */
export function setPairId(options: SetPairIdOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u32'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "pairId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'set_pair_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePairIdArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
}
export interface RemovePairIdOptions {
    package?: string;
    arguments: RemovePairIdArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * Removes the Supra pair ID for `symbol` (no-op if absent). After removal `feed`
 * abstains for `symbol`. Emits `SupraPairIdSet { pair_id: none }`.
 */
export function removePairId(options: RemovePairIdOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'remove_pair_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetToleranceMsArguments {
    config: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    toleranceMs: RawTransactionArgument<number | bigint>;
}
export interface SetToleranceMsOptions {
    package?: string;
    arguments: SetToleranceMsArguments | [
        config: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        toleranceMs: RawTransactionArgument<number | bigint>
    ];
}
/** Sets the per-symbol freshness tolerance in ms. Emits `SupraToleranceSet`. */
export function setToleranceMs(options: SetToleranceMsOptions) {
    const packageAddress = options.package ?? '@waterx/supra-rule';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["config", "Cap", "symbol", "toleranceMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'supra_rule',
        function: 'set_tolerance_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}