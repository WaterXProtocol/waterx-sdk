/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Per-ticker price aggregator. Stored as a DOF child on `Oracle`. */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/oracle::aggregator';
export const NewPriceAggregator = new MoveStruct({ name: `${$moduleName}::NewPriceAggregator`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        weight_threshold: bcs.u64(),
        outlier_tolerance_bps: bcs.u64()
    } });
export const WeightUpdated = new MoveStruct({ name: `${$moduleName}::WeightUpdated`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        rule_type: bcs.string(),
        weight: bcs.u8()
    } });
export const ThresholdUpdated = new MoveStruct({ name: `${$moduleName}::ThresholdUpdated`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        weight_threshold: bcs.u64()
    } });
export const OutlierToleranceUpdated = new MoveStruct({ name: `${$moduleName}::OutlierToleranceUpdated`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        outlier_tolerance_bps: bcs.u64()
    } });
export const PriceAggregated = new MoveStruct({ name: `${$moduleName}::PriceAggregated`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        sources: bcs.vector(bcs.string()),
        prices: bcs.vector(bcs.u128()),
        weights: bcs.vector(bcs.u8()),
        current_threshold: bcs.u64(),
        result: bcs.u128(),
        timestamp_ms: bcs.u64()
    } });
export const HistoricalPriceRegistered = new MoveStruct({ name: `${$moduleName}::HistoricalPriceRegistered`, fields: {
        aggregator_id: bcs.Address,
        symbol: bcs.string(),
        sources: bcs.vector(bcs.string()),
        prices: bcs.vector(bcs.u128()),
        weights: bcs.vector(bcs.u8()),
        current_threshold: bcs.u64(),
        result: bcs.u128(),
        timestamp_ms: bcs.u64()
    } });
export const PriceAggregator = new MoveStruct({ name: `${$moduleName}::PriceAggregator`, fields: {
        id: bcs.Address,
        /** Ticker, e.g., `b"BTC_USD".to_string()`. */
        symbol: bcs.string(),
        /** Rule type -> weight. Entries with weight=0 are removed. */
        weights: vec_map.VecMap(type_name.TypeName, bcs.u8()),
        /** Minimum total weight of contributing rules required to aggregate. */
        weight_threshold: bcs.u64(),
        /** Maximum allowed deviation from the weighted-average price. */
        outlier_tolerance: float.Float,
        /** Latest aggregated price. */
        latest_price: float_1.Float,
        /** `clock.timestamp_ms()` at the time `aggregate` ran. */
        last_update_ms: bcs.u64(),
        /** Number of exact timestamp snapshots stored as dynamic fields on this aggregator. */
        history_count: bcs.u64()
    } });
export interface SymbolArguments {
    self: RawTransactionArgument<string>;
}
export interface SymbolOptions {
    package?: string;
    arguments: SymbolArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function symbol(options: SymbolOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WeightsArguments {
    self: RawTransactionArgument<string>;
}
export interface WeightsOptions {
    package?: string;
    arguments: WeightsArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function weights(options: WeightsOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'weights',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WeightThresholdArguments {
    self: RawTransactionArgument<string>;
}
export interface WeightThresholdOptions {
    package?: string;
    arguments: WeightThresholdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function weightThreshold(options: WeightThresholdOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'weight_threshold',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OutlierToleranceArguments {
    self: RawTransactionArgument<string>;
}
export interface OutlierToleranceOptions {
    package?: string;
    arguments: OutlierToleranceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function outlierTolerance(options: OutlierToleranceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'outlier_tolerance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LatestPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface LatestPriceOptions {
    package?: string;
    arguments: LatestPriceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function latestPrice(options: LatestPriceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'latest_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LastUpdateMsArguments {
    self: RawTransactionArgument<string>;
}
export interface LastUpdateMsOptions {
    package?: string;
    arguments: LastUpdateMsArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function lastUpdateMs(options: LastUpdateMsOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'last_update_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HistoryCountArguments {
    self: RawTransactionArgument<string>;
}
export interface HistoryCountOptions {
    package?: string;
    arguments: HistoryCountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function historyCount(options: HistoryCountOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'history_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PriceAtTimestampArguments {
    self: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint | null>;
}
export interface PriceAtTimestampOptions {
    package?: string;
    arguments: PriceAtTimestampArguments | [
        self: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint | null>
    ];
}
/**
 * Returns the latest price when `timestamp_ms` is `none`, otherwise the exact
 * historical price written at `timestamp_ms`.
 */
export function priceAtTimestamp(options: PriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasPriceAtTimestampArguments {
    self: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
}
export interface HasPriceAtTimestampOptions {
    package?: string;
    arguments: HasPriceAtTimestampArguments | [
        self: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>
    ];
}
export function hasPriceAtTimestamp(options: HasPriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'has_price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePriceAtTimestampArguments {
    self: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
}
export interface RemovePriceAtTimestampOptions {
    package?: string;
    arguments: RemovePriceAtTimestampArguments | [
        self: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Removes the exact historical price snapshot at `timestamp_ms`.
 *
 * This only deletes history dynamic fields. It never changes `latest_price` or
 * `last_update_ms`, so consumers can still read the latest oracle value.
 */
export function removePriceAtTimestamp(options: RemovePriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'remove_price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}