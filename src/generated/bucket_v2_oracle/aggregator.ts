/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Module for aggregating prices from multiple sources with weighted rules and
 * threshold logic.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@bucket/oracle::aggregator';
export const NewPriceAggregator = new MoveStruct({ name: `${$moduleName}::NewPriceAggregator`, fields: {
        aggregator_id: bcs.Address,
        coin_type: bcs.string(),
        weight_threshold: bcs.u64(),
        outlier_tolerance_bps: bcs.u64()
    } });
export const WeightUpdated = new MoveStruct({ name: `${$moduleName}::WeightUpdated<phantom T>`, fields: {
        aggregator_id: bcs.Address,
        rule_type: bcs.string(),
        weight: bcs.u8()
    } });
export const ThresholdUpdated = new MoveStruct({ name: `${$moduleName}::ThresholdUpdated<phantom T>`, fields: {
        aggregator_id: bcs.Address,
        weight_threshold: bcs.u64()
    } });
export const OutlierToleranceUpdated = new MoveStruct({ name: `${$moduleName}::OutlierToleranceUpdated<phantom T>`, fields: {
        aggregator_id: bcs.Address,
        outlier_tolerance_bps: bcs.u64()
    } });
export const PriceAggregated = new MoveStruct({ name: `${$moduleName}::PriceAggregated<phantom T>`, fields: {
        aggregator_id: bcs.Address,
        sources: bcs.vector(bcs.string()),
        prices: bcs.vector(bcs.u128()),
        weights: bcs.vector(bcs.u8()),
        current_threshold: bcs.u64(),
        result: bcs.u128()
    } });
export const PriceAggregator = new MoveStruct({ name: `${$moduleName}::PriceAggregator<phantom T>`, fields: {
        id: bcs.Address,
        weights: vec_map.VecMap(type_name.TypeName, bcs.u8()),
        weight_threshold: bcs.u64(),
        outlier_tolerance: float.Float
    } });
export interface NewArguments {
    cap: RawTransactionArgument<string>;
    weightThreshold: RawTransactionArgument<number | bigint>;
    outlierToleranceBps: RawTransactionArgument<number | bigint>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        cap: RawTransactionArgument<string>,
        weightThreshold: RawTransactionArgument<number | bigint>,
        outlierToleranceBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Admin Funs Create a new PriceAggregator object for a given coin type */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "weightThreshold", "outlierToleranceBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreateArguments {
    cap: RawTransactionArgument<string>;
    weightThreshold: RawTransactionArgument<number | bigint>;
    outlierToleranceBps: RawTransactionArgument<number | bigint>;
}
export interface CreateOptions {
    package?: string;
    arguments: CreateArguments | [
        cap: RawTransactionArgument<string>,
        weightThreshold: RawTransactionArgument<number | bigint>,
        outlierToleranceBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Entry function to create and share a new PriceAggregator object */
export function create(options: CreateOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["cap", "weightThreshold", "outlierToleranceBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'create',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetRuleWeightArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    newWeight: RawTransactionArgument<number>;
}
export interface SetRuleWeightOptions {
    package?: string;
    arguments: SetRuleWeightArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        newWeight: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Set or update the weight for a specific rule type */
export function setRuleWeight(options: SetRuleWeightOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        null,
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "newWeight"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'set_rule_weight',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetWeightThresholdArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    weightThreshold: RawTransactionArgument<number | bigint>;
}
export interface SetWeightThresholdOptions {
    package?: string;
    arguments: SetWeightThresholdArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        weightThreshold: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Set the minimum total weight required for aggregation */
export function setWeightThreshold(options: SetWeightThresholdOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "weightThreshold"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'set_weight_threshold',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetOutlierToleranceArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    outlierToleranceBps: RawTransactionArgument<number | bigint>;
}
export interface SetOutlierToleranceOptions {
    package?: string;
    arguments: SetOutlierToleranceArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        outlierToleranceBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function setOutlierTolerance(options: SetOutlierToleranceOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "outlierToleranceBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'set_outlier_tolerance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AggregateArguments {
    self: RawTransactionArgument<string>;
    collector: RawTransactionArgument<string>;
}
export interface AggregateOptions {
    package?: string;
    arguments: AggregateArguments | [
        self: RawTransactionArgument<string>,
        collector: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Public Funs Aggregate prices from the collector using the weights and threshold */
export function aggregate(options: AggregateOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "collector"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'aggregate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
    ];
}
/** Getter Functions Get the weights map */
export function weights(options: WeightsOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'weights',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
    ];
}
/** Get the current weight threshold */
export function weightThreshold(options: WeightThresholdOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'weight_threshold',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
    ];
}
/** Get the current weight threshold */
export function outlierTolerance(options: OutlierToleranceOptions) {
    const packageAddress = options.package ?? '@bucket/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'aggregator',
        function: 'outlier_tolerance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}