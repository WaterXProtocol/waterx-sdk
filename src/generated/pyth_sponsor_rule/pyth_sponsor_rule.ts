/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance.ts';
const $moduleName = '@waterx/pyth-sponsor-rule::pyth_sponsor_rule';
export const PythSponsorRule = new MoveStruct({ name: `${$moduleName}::PythSponsorRule`, fields: {
        dummy_field: bcs.bool()
    } });
export const PythSponsor = new MoveStruct({ name: `${$moduleName}::PythSponsor`, fields: {
        id: bcs.Address,
        balance: balance.Balance
    } });
export const Fund = new MoveStruct({ name: `${$moduleName}::Fund`, fields: {
        balance: balance.Balance
    } });
export interface RequestArguments {
    self: RawTransactionArgument<string>;
}
export interface RequestOptions {
    package?: string;
    arguments: RequestArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function request(options: RequestOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-sponsor-rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_sponsor_rule',
        function: 'request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SplitArguments {
    fund: TransactionArgument;
}
export interface SplitOptions {
    package?: string;
    arguments: SplitArguments | [
        fund: TransactionArgument
    ];
}
export function split(options: SplitOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-sponsor-rule';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["fund"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_sponsor_rule',
        function: 'split',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReimburseArguments {
    self: RawTransactionArgument<string>;
    fund: TransactionArgument;
    tradingReq: TransactionArgument;
}
export interface ReimburseOptions {
    package?: string;
    arguments: ReimburseArguments | [
        self: RawTransactionArgument<string>,
        fund: TransactionArgument,
        tradingReq: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function reimburse(options: ReimburseOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-sponsor-rule';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "fund", "tradingReq"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_sponsor_rule',
        function: 'reimburse',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SupplyArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface SupplyOptions {
    package?: string;
    arguments: SupplyArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
}
export function supply(options: SupplyOptions) {
    const packageAddress = options.package ?? '@waterx/pyth-sponsor-rule';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'pyth_sponsor_rule',
        function: 'supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}