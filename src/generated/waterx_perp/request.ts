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
export const PlaceOrderArgument = new MoveStruct({ name: `${$moduleName}::PlaceOrderArgument`, fields: {
        is_long: bcs.bool(),
        is_stop_order: bcs.bool(),
        reduce_only: bcs.bool(),
        /** Scaled Float (1e9) — converted internally. */
        size: bcs.u128(),
        /** `None` = market order (parked at tick 0). Pre-orders must be `Some`. */
        trigger_price: bcs.option(bcs.u128()),
        /** `None` = standalone. Pre-orders must be `None` (auto-linked at activation). */
        linked_position_id: bcs.option(bcs.u64()),
        /** Honored only on market orders. */
        acceptable_price: bcs.option(bcs.u64()),
        /** Collateral debited from the wxa account. Pre-orders must be `0`. */
        collateral_amount: bcs.u64()
    } });
export const TradingRequest = new MoveStruct({ name: `${$moduleName}::TradingRequest<phantom C_TOKEN>`, fields: {
        market_id: bcs.Address,
        account_object_address: bcs.Address,
        action: bcs.u8(),
        sender: bcs.Address,
        is_long: bcs.bool(),
        size: float.Float,
        collateral: balance.Balance,
        order_id: bcs.option(bcs.u64()),
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
        /**
         * TP / SL pre-orders carried alongside a place-order action. Empty for
         * non-`ACTION_PLACE_ORDER` actions and for plain main orders.
         */
        pre_orders: bcs.vector(PlaceOrderArgument),
        witnesses: vec_set.VecSet(type_name.TypeName)
    } });
export interface NewPlaceOrderArgumentArguments {
    isLong: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<number | bigint>;
    triggerPrice: RawTransactionArgument<number | bigint | null>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    acceptablePrice: RawTransactionArgument<number | bigint | null>;
    collateralAmount: RawTransactionArgument<number | bigint>;
}
export interface NewPlaceOrderArgumentOptions {
    package?: string;
    arguments: NewPlaceOrderArgumentArguments | [
        isLong: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<number | bigint>,
        triggerPrice: RawTransactionArgument<number | bigint | null>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        acceptablePrice: RawTransactionArgument<number | bigint | null>,
        collateralAmount: RawTransactionArgument<number | bigint>
    ];
}
export function newPlaceOrderArgument(options: NewPlaceOrderArgumentOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool',
        'bool',
        'bool',
        'u128',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["isLong", "isStopOrder", "reduceOnly", "size", "triggerPrice", "linkedPositionId", "acceptablePrice", "collateralAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'new_place_order_argument',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgIsLongArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgIsLongOptions {
    package?: string;
    arguments: ArgIsLongArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argIsLong(options: ArgIsLongOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgIsStopOrderArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgIsStopOrderOptions {
    package?: string;
    arguments: ArgIsStopOrderArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argIsStopOrder(options: ArgIsStopOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_is_stop_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgReduceOnlyArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgReduceOnlyOptions {
    package?: string;
    arguments: ArgReduceOnlyArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argReduceOnly(options: ArgReduceOnlyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_reduce_only',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgSizeArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgSizeOptions {
    package?: string;
    arguments: ArgSizeArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argSize(options: ArgSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgTriggerPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgTriggerPriceOptions {
    package?: string;
    arguments: ArgTriggerPriceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argTriggerPrice(options: ArgTriggerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_trigger_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgLinkedPositionIdArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgLinkedPositionIdOptions {
    package?: string;
    arguments: ArgLinkedPositionIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argLinkedPositionId(options: ArgLinkedPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_linked_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgAcceptablePriceArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgAcceptablePriceOptions {
    package?: string;
    arguments: ArgAcceptablePriceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argAcceptablePrice(options: ArgAcceptablePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_acceptable_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ArgCollateralAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface ArgCollateralAmountOptions {
    package?: string;
    arguments: ArgCollateralAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function argCollateralAmount(options: ArgCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'arg_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
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
export interface OrderIdArguments {
    self: RawTransactionArgument<string>;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orderId(options: OrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'order_id',
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
export interface PreOrdersArguments {
    self: RawTransactionArgument<string>;
}
export interface PreOrdersOptions {
    package?: string;
    arguments: PreOrdersArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function preOrders(options: PreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'pre_orders',
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
export interface NewArguments {
    marketId: RawTransactionArgument<string>;
    accountObjectAddress: RawTransactionArgument<string>;
    action: RawTransactionArgument<number>;
    sender: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint | null>;
    positionId: RawTransactionArgument<number | bigint | null>;
    triggerPrice: RawTransactionArgument<string | null>;
    reduceOnly: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    triggerPriceKey: RawTransactionArgument<number | bigint | null>;
    withdrawAmount: RawTransactionArgument<number | bigint>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    preOrders: RawTransactionArgument<string[]>;
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
        orderId: RawTransactionArgument<number | bigint | null>,
        positionId: RawTransactionArgument<number | bigint | null>,
        triggerPrice: RawTransactionArgument<string | null>,
        reduceOnly: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        triggerPriceKey: RawTransactionArgument<number | bigint | null>,
        withdrawAmount: RawTransactionArgument<number | bigint>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        preOrders: RawTransactionArgument<string[]>
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
        '0x1::option::Option<u64>',
        '0x1::option::Option<null>',
        'bool',
        'bool',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        'u64',
        'u64',
        'vector<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountObjectAddress", "action", "sender", "isLong", "size", "collateral", "orderId", "positionId", "triggerPrice", "reduceOnly", "isStopOrder", "linkedPositionId", "triggerPriceKey", "withdrawAmount", "acceptablePrice", "preOrders"];
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
    orderId: RawTransactionArgument<number | bigint | null>;
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
        orderId: RawTransactionArgument<number | bigint | null>,
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
        '0x1::option::Option<u64>',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountObjectAddress", "action", "sender", "orderId", "positionId", "withdrawAmount", "acceptablePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'request',
        function: 'new_no_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}