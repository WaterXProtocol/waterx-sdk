/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Module for double precision floating points */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@bucket/framework::double';
export const Double: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Double`, fields: {
        value: bcs.u256()
    } });
export interface ZeroOptions {
    package?: string;
    arguments?: [
    ];
}
/** Public Funs */
export function zero(options: ZeroOptions = {}) {
    const packageAddress = options.package ?? '@bucket/framework';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'zero',
    });
}
export interface OneOptions {
    package?: string;
    arguments?: [
    ];
}
export function one(options: OneOptions = {}) {
    const packageAddress = options.package ?? '@bucket/framework';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'one',
    });
}
export interface TenOptions {
    package?: string;
    arguments?: [
    ];
}
export function ten(options: TenOptions = {}) {
    const packageAddress = options.package ?? '@bucket/framework';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'ten',
    });
}
export interface FromArguments {
    v: RawTransactionArgument<number | bigint>;
}
export interface FromOptions {
    package?: string;
    arguments: FromArguments | [
        v: RawTransactionArgument<number | bigint>
    ];
}
export function _from(options: FromOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromPercentArguments {
    v: RawTransactionArgument<number>;
}
export interface FromPercentOptions {
    package?: string;
    arguments: FromPercentArguments | [
        v: RawTransactionArgument<number>
    ];
}
export function fromPercent(options: FromPercentOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_percent',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromPercentU64Arguments {
    v: RawTransactionArgument<number | bigint>;
}
export interface FromPercentU64Options {
    package?: string;
    arguments: FromPercentU64Arguments | [
        v: RawTransactionArgument<number | bigint>
    ];
}
export function fromPercentU64(options: FromPercentU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_percent_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromBpsArguments {
    v: RawTransactionArgument<number | bigint>;
}
export interface FromBpsOptions {
    package?: string;
    arguments: FromBpsArguments | [
        v: RawTransactionArgument<number | bigint>
    ];
}
export function fromBps(options: FromBpsOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromFractionArguments {
    n: RawTransactionArgument<number | bigint>;
    m: RawTransactionArgument<number | bigint>;
}
export interface FromFractionOptions {
    package?: string;
    arguments: FromFractionArguments | [
        n: RawTransactionArgument<number | bigint>,
        m: RawTransactionArgument<number | bigint>
    ];
}
export function fromFraction(options: FromFractionOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["n", "m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_fraction',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromScaledValArguments {
    v: RawTransactionArgument<number | bigint>;
}
export interface FromScaledValOptions {
    package?: string;
    arguments: FromScaledValArguments | [
        v: RawTransactionArgument<number | bigint>
    ];
}
export function fromScaledVal(options: FromScaledValOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u256'
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_scaled_val',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FromFloatArguments {
    f: TransactionArgument;
}
export interface FromFloatOptions {
    package?: string;
    arguments: FromFloatArguments | [
        f: TransactionArgument
    ];
}
export function fromFloat(options: FromFloatOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["f"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'from_float',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ToScaledValArguments {
    v: TransactionArgument;
}
export interface ToScaledValOptions {
    package?: string;
    arguments: ToScaledValArguments | [
        v: TransactionArgument
    ];
}
export function toScaledVal(options: ToScaledValOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'to_scaled_val',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TryIntoFloatArguments {
    v: TransactionArgument;
}
export interface TryIntoFloatOptions {
    package?: string;
    arguments: TryIntoFloatArguments | [
        v: TransactionArgument
    ];
}
export function tryIntoFloat(options: TryIntoFloatOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'try_into_float',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface AddOptions {
    package?: string;
    arguments: AddArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function add(options: AddOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'add',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface SubOptions {
    package?: string;
    arguments: SubArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function sub(options: SubOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'sub',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SaturatingSubArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface SaturatingSubOptions {
    package?: string;
    arguments: SaturatingSubArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function saturatingSub(options: SaturatingSubOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'saturating_sub',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MulArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface MulOptions {
    package?: string;
    arguments: MulArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function mul(options: MulOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'mul',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DivArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface DivOptions {
    package?: string;
    arguments: DivArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function div(options: DivOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'div',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddU64Arguments {
    a: TransactionArgument;
    b: RawTransactionArgument<number | bigint>;
}
export interface AddU64Options {
    package?: string;
    arguments: AddU64Arguments | [
        a: TransactionArgument,
        b: RawTransactionArgument<number | bigint>
    ];
}
export function addU64(options: AddU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'add_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SubU64Arguments {
    a: TransactionArgument;
    b: RawTransactionArgument<number | bigint>;
}
export interface SubU64Options {
    package?: string;
    arguments: SubU64Arguments | [
        a: TransactionArgument,
        b: RawTransactionArgument<number | bigint>
    ];
}
export function subU64(options: SubU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'sub_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SaturatingSubU64Arguments {
    a: TransactionArgument;
    b: RawTransactionArgument<number | bigint>;
}
export interface SaturatingSubU64Options {
    package?: string;
    arguments: SaturatingSubU64Arguments | [
        a: TransactionArgument,
        b: RawTransactionArgument<number | bigint>
    ];
}
export function saturatingSubU64(options: SaturatingSubU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'saturating_sub_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MulU64Arguments {
    a: TransactionArgument;
    b: RawTransactionArgument<number | bigint>;
}
export interface MulU64Options {
    package?: string;
    arguments: MulU64Arguments | [
        a: TransactionArgument,
        b: RawTransactionArgument<number | bigint>
    ];
}
export function mulU64(options: MulU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'mul_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DivU64Arguments {
    a: TransactionArgument;
    b: RawTransactionArgument<number | bigint>;
}
export interface DivU64Options {
    package?: string;
    arguments: DivU64Arguments | [
        a: TransactionArgument,
        b: RawTransactionArgument<number | bigint>
    ];
}
export function divU64(options: DivU64Options) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'div_u64',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PowArguments {
    b: TransactionArgument;
    e: RawTransactionArgument<number | bigint>;
}
export interface PowOptions {
    package?: string;
    arguments: PowArguments | [
        b: TransactionArgument,
        e: RawTransactionArgument<number | bigint>
    ];
}
export function pow(options: PowOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["b", "e"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'pow',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FloorArguments {
    v: TransactionArgument;
}
export interface FloorOptions {
    package?: string;
    arguments: FloorArguments | [
        v: TransactionArgument
    ];
}
export function floor(options: FloorOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'floor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CeilArguments {
    v: TransactionArgument;
}
export interface CeilOptions {
    package?: string;
    arguments: CeilArguments | [
        v: TransactionArgument
    ];
}
export function ceil(options: CeilOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'ceil',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RoundArguments {
    v: TransactionArgument;
}
export interface RoundOptions {
    package?: string;
    arguments: RoundArguments | [
        v: TransactionArgument
    ];
}
export function round(options: RoundOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'round',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EqArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface EqOptions {
    package?: string;
    arguments: EqArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function eq(options: EqOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'eq',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GtArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface GtOptions {
    package?: string;
    arguments: GtArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function gt(options: GtOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'gt',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GteArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface GteOptions {
    package?: string;
    arguments: GteArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function gte(options: GteOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'gte',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LtArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface LtOptions {
    package?: string;
    arguments: LtArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function lt(options: LtOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'lt',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LteArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface LteOptions {
    package?: string;
    arguments: LteArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function lte(options: LteOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'lte',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MinArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface MinOptions {
    package?: string;
    arguments: MinArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function min(options: MinOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'min',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface MaxOptions {
    package?: string;
    arguments: MaxArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function max(options: MaxOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'max',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DiffArguments {
    a: TransactionArgument;
    b: TransactionArgument;
}
export interface DiffOptions {
    package?: string;
    arguments: DiffArguments | [
        a: TransactionArgument,
        b: TransactionArgument
    ];
}
export function diff(options: DiffOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'diff',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PrecisionOptions {
    package?: string;
    arguments?: [
    ];
}
export function precision(options: PrecisionOptions = {}) {
    const packageAddress = options.package ?? '@bucket/framework';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'double',
        function: 'precision',
    });
}