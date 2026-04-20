/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Hot potato response from trading execution in WaterX Perp. No drop trait — must
 * be consumed by trading::destroy_response().
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as type_name from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp::response';
export const TradingResponse = new MoveStruct({ name: `${$moduleName}::TradingResponse`, fields: {
        market_id: bcs.Address,
        account_id: bcs.Address,
        action: bcs.u8(),
        sender: bcs.Address,
        position_id: bcs.option(bcs.u64()),
        pnl_amount: bcs.u64(),
        pnl_is_profit: bcs.bool(),
        fee_amount: bcs.u64(),
        is_long: bcs.bool(),
        size: float.Float,
        collateral_amount: bcs.u64(),
        execution_price: float_1.Float,
        witnesses: vec_set.VecSet(type_name.TypeName)
    } });
export interface AddWitnessArguments<W extends BcsType<any>> {
    self: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<W>;
}
export interface AddWitnessOptions<W extends BcsType<any>> {
    package?: string;
    arguments: AddWitnessArguments<W> | [
        self: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<W>
    ];
    typeArguments: [
        string
    ];
}
/** Adds a witness type to the response. */
export function addWitness<W extends BcsType<any>>(options: AddWitnessOptions<W>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'add_witness',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketIdArguments {
    self: RawTransactionArgument<string>;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function marketId(options: MarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdArguments {
    self: RawTransactionArgument<string>;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ActionArguments {
    self: RawTransactionArgument<string>;
}
export interface ActionOptions {
    package?: string;
    arguments: ActionArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function action(options: ActionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'action',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SenderArguments {
    self: RawTransactionArgument<string>;
}
export interface SenderOptions {
    package?: string;
    arguments: SenderArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function sender(options: SenderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'sender',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionIdArguments {
    self: RawTransactionArgument<string>;
}
export interface PositionIdOptions {
    package?: string;
    arguments: PositionIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function positionId(options: PositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PnlAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface PnlAmountOptions {
    package?: string;
    arguments: PnlAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function pnlAmount(options: PnlAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'pnl_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PnlIsProfitArguments {
    self: RawTransactionArgument<string>;
}
export interface PnlIsProfitOptions {
    package?: string;
    arguments: PnlIsProfitArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function pnlIsProfit(options: PnlIsProfitOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'pnl_is_profit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeeAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface FeeAmountOptions {
    package?: string;
    arguments: FeeAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function feeAmount(options: FeeAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'fee_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsLongArguments {
    self: RawTransactionArgument<string>;
}
export interface IsLongOptions {
    package?: string;
    arguments: IsLongArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function isLong(options: IsLongOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SizeArguments {
    self: RawTransactionArgument<string>;
}
export interface SizeOptions {
    package?: string;
    arguments: SizeArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function size(options: SizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CollateralAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface CollateralAmountOptions {
    package?: string;
    arguments: CollateralAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function collateralAmount(options: CollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ExecutionPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface ExecutionPriceOptions {
    package?: string;
    arguments: ExecutionPriceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function executionPrice(options: ExecutionPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'execution_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WitnessesArguments {
    self: RawTransactionArgument<string>;
}
export interface WitnessesOptions {
    package?: string;
    arguments: WitnessesArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function witnesses(options: WitnessesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'witnesses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewArguments {
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    action: RawTransactionArgument<number>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint | null>;
    pnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    feeAmount: RawTransactionArgument<number | bigint>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    executionPrice: RawTransactionArgument<string>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        action: RawTransactionArgument<number>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint | null>,
        pnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        feeAmount: RawTransactionArgument<number | bigint>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        executionPrice: RawTransactionArgument<string>
    ];
}
/** Creates a new TradingResponse. Package visibility only. */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        '0x2::object::ID',
        'u8',
        'address',
        '0x1::option::Option<u64>',
        'u64',
        'bool',
        'u64',
        'bool',
        null,
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountId", "action", "sender", "positionId", "pnlAmount", "pnlIsProfit", "feeAmount", "isLong", "size", "collateralAmount", "executionPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DestroyArguments {
    self: RawTransactionArgument<string>;
}
export interface DestroyOptions {
    package?: string;
    arguments: DestroyArguments | [
        self: RawTransactionArgument<string>
    ];
}
/** Destroys a TradingResponse, returning its fields. Package visibility only. */
export function destroy(options: DestroyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'destroy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}