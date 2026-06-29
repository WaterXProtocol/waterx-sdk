/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Shared `Oracle` registry. Holds one `PriceAggregator` per ticker as a DOF child.
 *
 * PTB flow:
 *
 * ```text
 * let collector = oracle::new_collector(b"BTC_USD".to_string());
 * waterx_rule::feed(&mut collector, &mut waterx_config, &clock, ...);
 * oracle::aggregate(&mut oracle, collector, &clock);
 * // ... later in the same tx:
 * let price = oracle::get_price(&oracle, b"BTC_USD".to_string(), &clock);
 * let historical = oracle::get_price_at_timestamp(&oracle, b"BTC_USD".to_string(), option::some(ts));
 * ```
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/oracle::oracle';
export const VersionAllowed = new MoveStruct({ name: `${$moduleName}::VersionAllowed`, fields: {
        version: bcs.u16()
    } });
export const VersionDisallowed = new MoveStruct({ name: `${$moduleName}::VersionDisallowed`, fields: {
        version: bcs.u16()
    } });
export const Oracle = new MoveStruct({ name: `${$moduleName}::Oracle`, fields: {
        id: bcs.Address,
        /**
         * Allowed package versions. `assert_version` aborts unless the current
         * `version::package_version()` is in this set.
         */
        allowed_versions: vec_set.VecSet(bcs.u16())
    } });
export const ListingCap = new MoveStruct({ name: `${$moduleName}::ListingCap`, fields: {
        id: bcs.Address
    } });
export interface AssertVersionArguments {
    oracle: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        oracle: RawTransactionArgument<string>
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["oracle"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsVersionAllowedArguments {
    oracle: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface IsVersionAllowedOptions {
    package?: string;
    arguments: IsVersionAllowedArguments | [
        oracle: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function isVersionAllowed(options: IsVersionAllowedOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'is_version_allowed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowVersionArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddAggregatorArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    weightThreshold: RawTransactionArgument<number | bigint>;
    outlierToleranceBps: RawTransactionArgument<number | bigint>;
}
export interface AddAggregatorOptions {
    package?: string;
    arguments: AddAggregatorArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        weightThreshold: RawTransactionArgument<number | bigint>,
        outlierToleranceBps: RawTransactionArgument<number | bigint>
    ];
}
export function addAggregator(options: AddAggregatorOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "symbol", "weightThreshold", "outlierToleranceBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'add_aggregator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetRuleWeightArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    weight: RawTransactionArgument<number>;
}
export interface SetRuleWeightOptions {
    package?: string;
    arguments: SetRuleWeightArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        weight: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function setRuleWeight(options: SetRuleWeightOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "symbol", "weight"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'set_rule_weight',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetWeightThresholdArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    weightThreshold: RawTransactionArgument<number | bigint>;
}
export interface SetWeightThresholdOptions {
    package?: string;
    arguments: SetWeightThresholdArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        weightThreshold: RawTransactionArgument<number | bigint>
    ];
}
export function setWeightThreshold(options: SetWeightThresholdOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "symbol", "weightThreshold"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'set_weight_threshold',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetOutlierToleranceArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    symbol: RawTransactionArgument<string>;
    outlierToleranceBps: RawTransactionArgument<number | bigint>;
}
export interface SetOutlierToleranceOptions {
    package?: string;
    arguments: SetOutlierToleranceArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        symbol: RawTransactionArgument<string>,
        outlierToleranceBps: RawTransactionArgument<number | bigint>
    ];
}
export function setOutlierTolerance(options: SetOutlierToleranceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "symbol", "outlierToleranceBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'set_outlier_tolerance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewCollectorArguments {
    symbol: RawTransactionArgument<string>;
}
export interface NewCollectorOptions {
    package?: string;
    arguments: NewCollectorArguments | [
        symbol: RawTransactionArgument<string>
    ];
}
/**
 * Creates a hot-potato collector for a given ticker. The ticker must already be
 * listed (or `aggregate` will abort), but the membership check happens at
 * `aggregate` time so no mutable borrow on the oracle is taken here.
 */
export function newCollector(options: NewCollectorOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["symbol"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'new_collector',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AggregateArguments {
    oracle: RawTransactionArgument<string>;
    collector: TransactionArgument;
}
export interface AggregateOptions {
    package?: string;
    arguments: AggregateArguments | [
        oracle: RawTransactionArgument<string>,
        collector: TransactionArgument
    ];
}
/**
 * Consumes the collector and writes the aggregated price into the matching
 * aggregator with `last_update_ms = clock.timestamp_ms()`.
 */
export function aggregate(options: AggregateOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "collector"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'aggregate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RegisterPriceAtTimestampArguments {
    oracle: RawTransactionArgument<string>;
    collector: TransactionArgument;
}
export interface RegisterPriceAtTimestampOptions {
    package?: string;
    arguments: RegisterPriceAtTimestampArguments | [
        oracle: RawTransactionArgument<string>,
        collector: TransactionArgument
    ];
}
/**
 * Consumes a verified historical collector and stores an exact historical snapshot
 * at the collector's verified timestamp without touching the latest price.
 */
export function registerPriceAtTimestamp(options: RegisterPriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "collector"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'register_price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetPriceArguments {
    oracle: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface GetPriceOptions {
    package?: string;
    arguments: GetPriceArguments | [
        oracle: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
}
/**
 * Reads the latest aggregated price for `ticker`.
 *
 * This is intentionally strict: the latest price must have been written in the
 * same PTB, using this same `Clock` timestamp.
 */
export function getPrice(options: GetPriceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'get_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetPriceAtTimestampArguments {
    oracle: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint | null>;
}
export interface GetPriceAtTimestampOptions {
    package?: string;
    arguments: GetPriceAtTimestampArguments | [
        oracle: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint | null>
    ];
}
/**
 * Reads the exact historical price written at `timestamp_ms`.
 *
 * Passing `none` returns the raw latest value without a freshness check. Use
 * `get_price` for current-price consumer paths that require same-PTB freshness.
 */
export function getPriceAtTimestamp(options: GetPriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::string::String',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "ticker", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'get_price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePriceAtTimestampArguments {
    oracle: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
    timestampMs: RawTransactionArgument<number | bigint>;
}
export interface RemovePriceAtTimestampOptions {
    package?: string;
    arguments: RemovePriceAtTimestampArguments | [
        oracle: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>,
        timestampMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Removes the exact historical price snapshot at `timestamp_ms` so the caller can
 * reclaim the dynamic-field storage rebate. Latest price is unchanged.
 *
 * `ListingCap`-gated (F-012): without it any address could delete any listed
 * ticker's history snapshots, griefing off-chain reconciliation. The live price
 * path (`latest_price` / `last_update_ms`) is never touched here.
 */
export function removePriceAtTimestamp(options: RemovePriceAtTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "Cap", "ticker", "timestampMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'remove_price_at_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnsafeGetLatestPriceArguments {
    oracle: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface UnsafeGetLatestPriceOptions {
    package?: string;
    arguments: UnsafeGetLatestPriceArguments | [
        oracle: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
}
/**
 * Reads the latest aggregated price without the freshness check. For
 * view/off-chain pricing - never call from a path that updates state.
 */
export function unsafeGetLatestPrice(options: UnsafeGetLatestPriceOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'unsafe_get_latest_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsListedArguments {
    oracle: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface IsListedOptions {
    package?: string;
    arguments: IsListedArguments | [
        oracle: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
}
export function isListed(options: IsListedOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'is_listed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AggregatorArguments {
    oracle: RawTransactionArgument<string>;
    ticker: RawTransactionArgument<string>;
}
export interface AggregatorOptions {
    package?: string;
    arguments: AggregatorArguments | [
        oracle: RawTransactionArgument<string>,
        ticker: RawTransactionArgument<string>
    ];
}
export function aggregator(options: AggregatorOptions) {
    const packageAddress = options.package ?? '@waterx/oracle';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["oracle", "ticker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'oracle',
        function: 'aggregator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}