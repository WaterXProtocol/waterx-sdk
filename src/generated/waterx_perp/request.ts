/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Hot potato request for trading actions in WaterX Perp. No drop trait — must be
 * consumed by trading::execute().
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as balance from './deps/sui/balance.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as type_name from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp::request';
export const TradingRequest = new MoveStruct({ name: `${$moduleName}::TradingRequest<phantom C_TOKEN>`, fields: {
        market_id: bcs.Address,
        account_object_address: bcs.Address,
        action: bcs.u8(),
        sender: bcs.Address,
        is_long: bcs.bool(),
        size: float.Float,
        collateral: balance.Balance,
        position_id: bcs.option(bcs.u64()),
        trigger_price: bcs.option(float_1.Float),
        reduce_only: bcs.bool(),
        is_stop_order: bcs.bool(),
        linked_position_id: bcs.option(bcs.u64()),
        trigger_price_key: bcs.option(bcs.u128()),
        withdraw_amount: bcs.u64(),
        /**
         * Slippage protection: acceptable execution price (0 = no limit). For long open /
         * short close: assert price <= acceptable_price. For short open / long close:
         * assert price >= acceptable_price.
         */
        acceptable_price: bcs.u64(),
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
        string,
        string
    ];
}
/** Adds a witness type to the request. */
export function addWitness<W extends BcsType<any>>(options: AddWitnessOptions<W>) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountObjectAddressArguments {
    self: RawTransactionArgument<string>;
}
export interface AccountObjectAddressOptions {
    package?: string;
    arguments: AccountObjectAddressArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountObjectAddress(options: AccountObjectAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'account_object_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'action',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'sender',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface DepositAmountOptions {
    package?: string;
    arguments: DepositAmountArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function depositAmount(options: DepositAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'deposit_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TriggerPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface TriggerPriceOptions {
    package?: string;
    arguments: TriggerPriceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function triggerPrice(options: TriggerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'trigger_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReduceOnlyArguments {
    self: RawTransactionArgument<string>;
}
export interface ReduceOnlyOptions {
    package?: string;
    arguments: ReduceOnlyArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function reduceOnly(options: ReduceOnlyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'reduce_only',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsStopOrderArguments {
    self: RawTransactionArgument<string>;
}
export interface IsStopOrderOptions {
    package?: string;
    arguments: IsStopOrderArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isStopOrder(options: IsStopOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'is_stop_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LinkedPositionIdArguments {
    self: RawTransactionArgument<string>;
}
export interface LinkedPositionIdOptions {
    package?: string;
    arguments: LinkedPositionIdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function linkedPositionId(options: LinkedPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'linked_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TriggerPriceKeyArguments {
    self: RawTransactionArgument<string>;
}
export interface TriggerPriceKeyOptions {
    package?: string;
    arguments: TriggerPriceKeyArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function triggerPriceKey(options: TriggerPriceKeyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'trigger_price_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface WithdrawAmountOptions {
    package?: string;
    arguments: WithdrawAmountArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function withdrawAmount(options: WithdrawAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'withdraw_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AcceptablePriceArguments {
    self: RawTransactionArgument<string>;
}
export interface AcceptablePriceOptions {
    package?: string;
    arguments: AcceptablePriceArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function acceptablePrice(options: AcceptablePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'acceptable_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        module: 'request',
        function: 'witnesses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ActionOpenPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionOpenPosition(options: ActionOpenPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_open_position',
    });
}
export interface ActionClosePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionClosePosition(options: ActionClosePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_close_position',
    });
}
export interface ActionPlaceOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionPlaceOrder(options: ActionPlaceOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_place_order',
    });
}
export interface ActionCancelOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionCancelOrder(options: ActionCancelOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_cancel_order',
    });
}
export interface ActionDepositCollateralOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionDepositCollateral(options: ActionDepositCollateralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_deposit_collateral',
    });
}
export interface ActionWithdrawCollateralOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionWithdrawCollateral(options: ActionWithdrawCollateralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_withdraw_collateral',
    });
}
export interface ActionLiquidateOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionLiquidate(options: ActionLiquidateOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_liquidate',
    });
}
export interface ActionIncreasePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionIncreasePosition(options: ActionIncreasePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_increase_position',
    });
}
export interface ActionDecreasePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function actionDecreasePosition(options: ActionDecreasePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'action_decrease_position',
    });
}
export interface NewArguments {
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    action: RawTransactionArgument<number>;
    sender: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint | null>;
    triggerPrice: RawTransactionArgument<string | null>;
    reduceOnly: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    triggerPriceKey: RawTransactionArgument<number | bigint | null>;
    withdrawAmount: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        action: RawTransactionArgument<number>,
        sender: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint | null>,
        triggerPrice: RawTransactionArgument<string | null>,
        reduceOnly: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        triggerPriceKey: RawTransactionArgument<number | bigint | null>,
        withdrawAmount: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Creates a new TradingRequest. Package visibility only. */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        'address',
        'u8',
        'address',
        'bool',
        null,
        null,
        '0x1::option::Option<u64>',
        '0x1::option::Option<null>',
        'bool',
        'bool',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountObjectAddress", "action", "sender", "isLong", "size", "collateral", "positionId", "triggerPrice", "reduceOnly", "isStopOrder", "linkedPositionId", "triggerPriceKey", "withdrawAmount", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
    ];
}
/** Destroys a TradingRequest, returning its fields. Package visibility only. */
export function destroy(options: DestroyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'destroy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NewNoCollateralArguments {
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    action: RawTransactionArgument<number>;
    sender: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint | null>;
    withdrawAmount: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
}
export interface NewNoCollateralOptions {
    package?: string;
    arguments: NewNoCollateralArguments | [
        marketId: RawTransactionArgument<string>,
        accountObjectAddress: RawTransactionArgument<string>,
        action: RawTransactionArgument<number>,
        sender: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint | null>,
        withdrawAmount: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Creates an empty-collateral request (for actions that don't need collateral). */
export function newNoCollateral(options: NewNoCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        'address',
        'u8',
        'address',
        '0x1::option::Option<u64>',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountObjectAddress", "action", "sender", "positionId", "withdrawAmount", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'new_no_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}