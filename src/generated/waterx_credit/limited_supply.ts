/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@waterx/credit::limited_supply';
export const LimitedSupply = new MoveStruct({ name: `${$moduleName}::LimitedSupply`, fields: {
        limit: bcs.u64(),
        supply: bcs.u64()
    } });
export interface NewArguments {
    limit: RawTransactionArgument<number | bigint>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        limit: RawTransactionArgument<number | bigint>
    ];
}
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["limit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DestroyArguments {
    self: TransactionArgument;
}
export interface DestroyOptions {
    package?: string;
    arguments: DestroyArguments | [
        self: TransactionArgument
    ];
}
export function destroy(options: DestroyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'destroy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IncreaseArguments {
    self: TransactionArgument;
    amount: RawTransactionArgument<number | bigint>;
}
export interface IncreaseOptions {
    package?: string;
    arguments: IncreaseArguments | [
        self: TransactionArgument,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function increase(options: IncreaseOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'increase',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DecreaseArguments {
    self: TransactionArgument;
    amount: RawTransactionArgument<number | bigint>;
}
export interface DecreaseOptions {
    package?: string;
    arguments: DecreaseArguments | [
        self: TransactionArgument,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function decrease(options: DecreaseOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'decrease',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetLimitArguments {
    self: TransactionArgument;
    limit: RawTransactionArgument<number | bigint>;
}
export interface SetLimitOptions {
    package?: string;
    arguments: SetLimitArguments | [
        self: TransactionArgument,
        limit: RawTransactionArgument<number | bigint>
    ];
}
export function setLimit(options: SetLimitOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "limit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'set_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LimitArguments {
    self: TransactionArgument;
}
export interface LimitOptions {
    package?: string;
    arguments: LimitArguments | [
        self: TransactionArgument
    ];
}
export function limit(options: LimitOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SupplyArguments {
    self: TransactionArgument;
}
export interface SupplyOptions {
    package?: string;
    arguments: SupplyArguments | [
        self: TransactionArgument
    ];
}
export function supply(options: SupplyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IncreasableAmountArguments {
    self: TransactionArgument;
}
export interface IncreasableAmountOptions {
    package?: string;
    arguments: IncreasableAmountArguments | [
        self: TransactionArgument
    ];
}
export function increasableAmount(options: IncreasableAmountOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'increasable_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsIncreasableArguments {
    self: TransactionArgument;
    amount: RawTransactionArgument<number | bigint>;
}
export interface IsIncreasableOptions {
    package?: string;
    arguments: IsIncreasableArguments | [
        self: TransactionArgument,
        amount: RawTransactionArgument<number | bigint>
    ];
}
export function isIncreasable(options: IsIncreasableOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'limited_supply',
        function: 'is_increasable',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}