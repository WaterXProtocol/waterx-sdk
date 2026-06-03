/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
import * as table from './deps/sui/table.ts';
const $moduleName = '@waterx/referral::referral_table';
export const SetReferralCode = new MoveStruct({ name: `${$moduleName}::SetReferralCode`, fields: {
        refer: bcs.Address,
        code: bcs.string()
    } });
export const UseReferralCode = new MoveStruct({ name: `${$moduleName}::UseReferralCode`, fields: {
        referee: bcs.Address,
        code: bcs.string()
    } });
export const ReferralTable = new MoveStruct({ name: `${$moduleName}::ReferralTable`, fields: {
        id: bcs.Address,
        versions: vec_set.VecSet(bcs.u16()),
        code_to_refer: table.Table,
        referee_to_code: table.Table
    } });
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/referral';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'package_version',
    });
}
export interface AddVersionArguments {
    Cap: RawTransactionArgument<string>;
    table: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddVersionOptions {
    package?: string;
    arguments: AddVersionArguments | [
        Cap: RawTransactionArgument<string>,
        table: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
}
/** Admin Funs */
export function addVersion(options: AddVersionOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "table", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'add_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveVersionArguments {
    Cap: RawTransactionArgument<string>;
    table: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemoveVersionOptions {
    package?: string;
    arguments: RemoveVersionArguments | [
        Cap: RawTransactionArgument<string>,
        table: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
}
export function removeVersion(options: RemoveVersionOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "table", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'remove_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetReferralCodeArguments {
    table: RawTransactionArgument<string>;
    req: TransactionArgument;
    code: RawTransactionArgument<string>;
}
export interface SetReferralCodeOptions {
    package?: string;
    arguments: SetReferralCodeArguments | [
        table: RawTransactionArgument<string>,
        req: TransactionArgument,
        code: RawTransactionArgument<string>
    ];
}
/** Public Funs */
export function setReferralCode(options: SetReferralCodeOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "req", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'set_referral_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UseReferralCodeArguments {
    table: RawTransactionArgument<string>;
    req: TransactionArgument;
    code: RawTransactionArgument<string>;
}
export interface UseReferralCodeOptions {
    package?: string;
    arguments: UseReferralCodeArguments | [
        table: RawTransactionArgument<string>,
        req: TransactionArgument,
        code: RawTransactionArgument<string>
    ];
}
export function useReferralCode(options: UseReferralCodeOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "req", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'use_referral_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetReferralCode_Arguments {
    table: RawTransactionArgument<string>;
    code: RawTransactionArgument<string>;
}
export interface SetReferralCode_Options {
    package?: string;
    arguments: SetReferralCode_Arguments | [
        table: RawTransactionArgument<string>,
        code: RawTransactionArgument<string>
    ];
}
export function setReferralCode_(options: SetReferralCode_Options) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'set_referral_code_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UseReferralCode_Arguments {
    table: RawTransactionArgument<string>;
    code: RawTransactionArgument<string>;
}
export interface UseReferralCode_Options {
    package?: string;
    arguments: UseReferralCode_Arguments | [
        table: RawTransactionArgument<string>,
        code: RawTransactionArgument<string>
    ];
}
export function useReferralCode_(options: UseReferralCode_Options) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'use_referral_code_',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CodeToReferArguments {
    table: RawTransactionArgument<string>;
}
export interface CodeToReferOptions {
    package?: string;
    arguments: CodeToReferArguments | [
        table: RawTransactionArgument<string>
    ];
}
/** Getter Funs */
export function codeToRefer(options: CodeToReferOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["table"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'code_to_refer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RefereeToCodeArguments {
    table: RawTransactionArgument<string>;
}
export interface RefereeToCodeOptions {
    package?: string;
    arguments: RefereeToCodeArguments | [
        table: RawTransactionArgument<string>
    ];
}
export function refereeToCode(options: RefereeToCodeOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["table"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'referee_to_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TryGetReferArguments {
    table: RawTransactionArgument<string>;
    referee: RawTransactionArgument<string>;
}
export interface TryGetReferOptions {
    package?: string;
    arguments: TryGetReferArguments | [
        table: RawTransactionArgument<string>,
        referee: RawTransactionArgument<string>
    ];
}
export function tryGetRefer(options: TryGetReferOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "referee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'try_get_refer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsValidReferralCodeArguments {
    code: RawTransactionArgument<string>;
}
export interface IsValidReferralCodeOptions {
    package?: string;
    arguments: IsValidReferralCodeArguments | [
        code: RawTransactionArgument<string>
    ];
}
export function isValidReferralCode(options: IsValidReferralCodeOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'is_valid_referral_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReferralCodeExistsArguments {
    table: RawTransactionArgument<string>;
    code: RawTransactionArgument<string>;
}
export interface ReferralCodeExistsOptions {
    package?: string;
    arguments: ReferralCodeExistsArguments | [
        table: RawTransactionArgument<string>,
        code: RawTransactionArgument<string>
    ];
}
export function referralCodeExists(options: ReferralCodeExistsOptions) {
    const packageAddress = options.package ?? '@waterx/referral';
    const argumentsTypes = [
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'referral_code_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}