/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
import * as keyed_big_vector from './keyed_big_vector.ts';
import * as keyed_big_vector_1 from './keyed_big_vector.ts';
const $moduleName = '@waterx/perp::referral_table';
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
        code_to_refer: keyed_big_vector.KeyedBigVector,
        referee_to_code: keyed_big_vector_1.KeyedBigVector
    } });
export interface InitOptions {
    package?: string;
    arguments?: [
    ];
}
/** Init */
export function init(options: InitOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'init',
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
    const packageAddress = options.package ?? '@waterx/perp';
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
    const packageAddress = options.package ?? '@waterx/perp';
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
export interface AllowVersionArguments {
    Cap: RawTransactionArgument<string>;
    referralRegistry: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        Cap: RawTransactionArgument<string>,
        referralRegistry: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "referralRegistry", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    Cap: RawTransactionArgument<string>;
    referralRegistry: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        Cap: RawTransactionArgument<string>,
        referralRegistry: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "referralRegistry", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertVersionArguments {
    referralRegistry: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        referralRegistry: RawTransactionArgument<string>
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["referralRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetReferralCodeArguments {
    table: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    code: RawTransactionArgument<string>;
}
export interface SetReferralCodeOptions {
    package?: string;
    arguments: SetReferralCodeArguments | [
        table: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        code: RawTransactionArgument<string>
    ];
}
/** Public Funs */
export function setReferralCode(options: SetReferralCodeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "senderRequest", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'set_referral_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UseReferralCodeArguments {
    table: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    code: RawTransactionArgument<string>;
}
export interface UseReferralCodeOptions {
    package?: string;
    arguments: UseReferralCodeArguments | [
        table: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        code: RawTransactionArgument<string>
    ];
}
export function useReferralCode(options: UseReferralCodeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["table", "senderRequest", "code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'use_referral_code',
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
    const packageAddress = options.package ?? '@waterx/perp';
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
    const packageAddress = options.package ?? '@waterx/perp';
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
    const packageAddress = options.package ?? '@waterx/perp';
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
    const packageAddress = options.package ?? '@waterx/perp';
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
    const packageAddress = options.package ?? '@waterx/perp';
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
export interface AssertValidPackageVersionArguments {
    table: RawTransactionArgument<string>;
}
export interface AssertValidPackageVersionOptions {
    package?: string;
    arguments: AssertValidPackageVersionArguments | [
        table: RawTransactionArgument<string>
    ];
}
/** Internal Funs */
export function assertValidPackageVersion(options: AssertValidPackageVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["table"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'referral_table',
        function: 'assert_valid_package_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}