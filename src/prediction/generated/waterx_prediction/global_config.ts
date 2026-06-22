/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/prediction::global_config';
export const GlobalConfig: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::GlobalConfig`, fields: {
        id: bcs.Address,
        /** Allowed package versions for keeper-gated operations. */
        allowed_versions: vec_set.VecSet(bcs.u16()),
        keepers: vec_set.VecSet(bcs.Address)
    } });
export interface AssertVersionArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowVersionArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowedVersionsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AllowedVersionsOptions {
    package?: string;
    arguments: AllowedVersionsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function allowedVersions(options: AllowedVersionsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'allowed_versions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface AddKeeperOptions {
    package?: string;
    arguments: AddKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
/** Admin configures which backend addresses may settle external order work. */
export function addKeeper(options: AddKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "_", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface RemoveKeeperOptions {
    package?: string;
    arguments: RemoveKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
/** Admin removes a backend keeper. */
export function removeKeeper(options: RemoveKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "_", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface IsKeeperOptions {
    package?: string;
    arguments: IsKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
export function isKeeper(options: IsKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'is_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KeeperCountArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface KeeperCountOptions {
    package?: string;
    arguments: KeeperCountArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function keeperCount(options: KeeperCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'keeper_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KeeperAddressesArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface KeeperAddressesOptions {
    package?: string;
    arguments: KeeperAddressesArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function keeperAddresses(options: KeeperAddressesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'keeper_addresses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}