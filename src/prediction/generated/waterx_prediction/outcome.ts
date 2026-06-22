/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveEnum, normalizeMoveArguments } from '../utils/index.ts';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@waterx/prediction::outcome';
export const Outcome = new MoveEnum({ name: `${$moduleName}::Outcome`, fields: {
        No: null,
        Yes: null,
        Invalid: null
    } });
export interface NoOptions {
    package?: string;
    arguments?: [
    ];
}
export function no(options: NoOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'no',
    });
}
export interface YesOptions {
    package?: string;
    arguments?: [
    ];
}
export function yes(options: YesOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'yes',
    });
}
export interface InvalidOptions {
    package?: string;
    arguments?: [
    ];
}
export function invalid(options: InvalidOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'invalid',
    });
}
export interface IsNoArguments {
    outcome: TransactionArgument;
}
export interface IsNoOptions {
    package?: string;
    arguments: IsNoArguments | [
        outcome: TransactionArgument
    ];
}
export function isNo(options: IsNoOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["outcome"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'is_no',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsYesArguments {
    outcome: TransactionArgument;
}
export interface IsYesOptions {
    package?: string;
    arguments: IsYesArguments | [
        outcome: TransactionArgument
    ];
}
export function isYes(options: IsYesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["outcome"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'is_yes',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsInvalidArguments {
    outcome: TransactionArgument;
}
export interface IsInvalidOptions {
    package?: string;
    arguments: IsInvalidArguments | [
        outcome: TransactionArgument
    ];
}
export function isInvalid(options: IsInvalidOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["outcome"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'outcome',
        function: 'is_invalid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}