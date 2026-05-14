/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Position and Order structs and lifecycle management. All functions are
 * package-internal, used by trading.move. Collateral balances are stored in
 * GlobalVault (global_config.move), not in Position/Order.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as type_name from './deps/std/type_name.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as float_2 from './deps/bucket_v2_framework/float.ts';
import * as double from './deps/bucket_v2_framework/double.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as float_3 from './deps/bucket_v2_framework/float.ts';
import * as float_4 from './deps/bucket_v2_framework/float.ts';
import * as float_5 from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/perp::position';
export const Position = new MoveStruct({ name: `${$moduleName}::Position`, fields: {
        id: bcs.Address,
        /** Position ID (unique within market). */
        position_id: bcs.u64(),
        /** Owner address. */
        account_object_address: bcs.Address,
        /** Market ID. */
        market_id: bcs.Address,
        /** Whether this is a long position. */
        is_long: bcs.bool(),
        /** Position size as Float (fixed 9 decimals). */
        size: float.Float,
        /** Collateral token type. */
        collateral_token: type_name.TypeName,
        /** Collateral token decimal. */
        collateral_decimal: bcs.u8(),
        /** Collateral amount (tracked; actual balance in GlobalVault). */
        collateral_amount: bcs.u64(),
        /** Average entry price (Float). */
        average_price: float_1.Float,
        /** Entry cumulative borrow rate index as Float. */
        entry_borrow_index: float_2.Float,
        /** Pool reserve snapshot in collateral token units. */
        pool_reserve_amount: bcs.u64(),
        /** Borrow reserve snapshot in collateral token units. */
        borrow_reserve_amount: bcs.u64(),
        /** Entry cumulative funding rate sign (true = longs pay). */
        entry_funding_sign: bcs.bool(),
        /** Entry cumulative funding rate index (Double). */
        entry_funding_index: double.Double,
        /** Unrealized borrow fee in collateral token. */
        unrealized_borrow_fee: bcs.u64(),
        /** Unrealized funding fee sign (true = should pay). */
        unrealized_funding_sign: bcs.bool(),
        /** Unrealized funding fee in collateral token. */
        unrealized_funding_fee: bcs.u64(),
        /** Unrealized trading fee in collateral token. */
        unrealized_trading_fee: bcs.u64(),
        /** Linked order IDs. */
        linked_order_ids: bcs.vector(bcs.u64()),
        /** Linked order trigger price bucket keys paired with linked_order_ids. */
        linked_order_price_keys: bcs.vector(bcs.u128()),
        /** Creation timestamp. */
        create_timestamp: bcs.u64(),
        /** Last update timestamp. */
        update_timestamp: bcs.u64()
    } });
export const Order = new MoveStruct({ name: `${$moduleName}::Order`, fields: {
        id: bcs.Address,
        /** Order ID (unique within market). */
        order_id: bcs.u64(),
        /**
         * Owner account object address (UserAccount ID, same as
         * Position.account_object_address).
         */
        account_object_address: bcs.Address,
        /** Market ID. */
        market_id: bcs.Address,
        /** Linked position ID (for reduce-only). */
        linked_position_id: bcs.option(bcs.u64()),
        /** Collateral token type. */
        collateral_token: type_name_1.TypeName,
        /** Collateral token decimal. */
        collateral_decimal: bcs.u8(),
        /** Collateral amount (tracked; actual balance in GlobalVault). */
        collateral_amount: bcs.u64(),
        /** Whether this is a long order. */
        is_long: bcs.bool(),
        /** Whether this is a reduce-only order. */
        reduce_only: bcs.bool(),
        /** Whether this is a stop order (vs limit). */
        is_stop_order: bcs.bool(),
        /** Order size as Float (fixed 9 decimals). */
        size: float_3.Float,
        /**
         * Trigger price (Float). A value of zero marks the order as a market order: it
         * sits at price tick 0 in the limit book and matches at any oracle price (see
         * `check_order_fillable`).
         */
        trigger_price: float_4.Float,
        /**
         * Slippage limit (scaled `Float`) checked at match time. Zero disables the check.
         * Only carries meaning on market orders — limit/stop orders always pass it through
         * as zero.
         */
        acceptable_price: bcs.u64(),
        /** Leverage in bps. */
        leverage_bps: bcs.u64(),
        /** Oracle price when order was placed. */
        oracle_price_at_creation: float_5.Float,
        /** Creation timestamp. */
        create_timestamp: bcs.u64()
    } });
export interface CreateOrderArguments {
    orderId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    collateral: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
    collateralDecimal: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    isStopOrder: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
    acceptablePrice: RawTransactionArgument<number | bigint>;
    leverageBps: RawTransactionArgument<number | bigint>;
    oraclePrice: RawTransactionArgument<string>;
}
export interface CreateOrderOptions {
    package?: string;
    arguments: CreateOrderArguments | [
        orderId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        collateral: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>,
        collateralDecimal: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        isStopOrder: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>,
        acceptablePrice: RawTransactionArgument<number | bigint>,
        leverageBps: RawTransactionArgument<number | bigint>,
        oraclePrice: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Creates a new trading order. Collateral is deposited into the vault.
 * `acceptable_price = 0` means no slippage check; non-zero values are only carried
 * by market orders (trigger_price == 0) and consulted by `match_orders` at fill
 * time.
 */
export function createOrder(options: CreateOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'address',
        '0x2::object::ID',
        '0x1::option::Option<u64>',
        null,
        null,
        'u8',
        'bool',
        'bool',
        'bool',
        null,
        null,
        'u64',
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["orderId", "accountObjectAddress", "marketId", "linkedPositionId", "collateral", "vault", "collateralDecimal", "isLong", "reduceOnly", "isStopOrder", "size", "triggerPrice", "acceptablePrice", "leverageBps", "oraclePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'create_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveOrderArguments {
    order: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
}
export interface RemoveOrderOptions {
    package?: string;
    arguments: RemoveOrderArguments | [
        order: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Removes an order and returns its collateral from the vault. */
export function removeOrder(options: RemoveOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order", "vault"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'remove_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateOrderArguments {
    order: RawTransactionArgument<string>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
    leverageBps: RawTransactionArgument<number | bigint>;
}
export interface UpdateOrderOptions {
    package?: string;
    arguments: UpdateOrderArguments | [
        order: RawTransactionArgument<string>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>,
        leverageBps: RawTransactionArgument<number | bigint>
    ];
}
export function updateOrder(options: UpdateOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["order", "size", "triggerPrice", "leverageBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'update_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetLinkedPositionIdArguments {
    order: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface SetLinkedPositionIdOptions {
    package?: string;
    arguments: SetLinkedPositionIdArguments | [
        order: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Stamp the resolved linked position ID on an order whose `linked_position_id` is
 * currently `None`. Used by the pre-order activation path: when a main with
 * reserved pre-orders fills, the perp fills in the freshly-minted `position_id` on
 * each reserved `Order` before moving it onto the live book.
 */
export function setLinkedPositionId(options: SetLinkedPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["order", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'set_linked_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatePositionArguments {
    positionId: RawTransactionArgument<number | bigint>;
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
    collateralDecimal: RawTransactionArgument<number>;
    averagePrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    entryBorrowIndex: RawTransactionArgument<string>;
    entryFundingSign: RawTransactionArgument<boolean>;
    entryFundingIndex: RawTransactionArgument<string>;
    tradingFee: RawTransactionArgument<number | bigint>;
}
export interface CreatePositionOptions {
    package?: string;
    arguments: CreatePositionArguments | [
        positionId: RawTransactionArgument<number | bigint>,
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>,
        collateralDecimal: RawTransactionArgument<number>,
        averagePrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        entryBorrowIndex: RawTransactionArgument<string>,
        entryFundingSign: RawTransactionArgument<boolean>,
        entryFundingIndex: RawTransactionArgument<string>,
        tradingFee: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Creates a new position. Collateral is deposited into the vault. */
export function createPosition(options: CreatePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'address',
        '0x2::object::ID',
        'bool',
        null,
        null,
        null,
        'u8',
        null,
        null,
        null,
        'bool',
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["positionId", "accountObjectAddress", "marketId", "isLong", "size", "collateral", "vault", "collateralDecimal", "averagePrice", "collateralPrice", "entryBorrowIndex", "entryFundingSign", "entryFundingIndex", "tradingFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'create_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositCollateralArguments {
    position: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
}
export interface DepositCollateralOptions {
    package?: string;
    arguments: DepositCollateralArguments | [
        position: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Deposits collateral into position via the vault. */
export function depositCollateral(options: DepositCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "vault", "collateral"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'deposit_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawCollateralArguments {
    position: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawCollateralOptions {
    package?: string;
    arguments: WithdrawCollateralArguments | [
        position: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Withdraws collateral from a position via the vault. */
export function withdrawCollateral(options: WithdrawCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "vault", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'withdraw_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemovePositionArguments {
    position: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
}
export interface RemovePositionOptions {
    package?: string;
    arguments: RemovePositionArguments | [
        position: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Removes a position, returning its collateral from the vault and linked order
 * metadata.
 */
export function removePosition(options: RemovePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "vault"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'remove_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertPositionCollateralTypeArguments {
    position: RawTransactionArgument<string>;
}
export interface AssertPositionCollateralTypeOptions {
    package?: string;
    arguments: AssertPositionCollateralTypeArguments | [
        position: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertPositionCollateralType(options: AssertPositionCollateralTypeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'assert_position_collateral_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertOrderCollateralTypeArguments {
    order: RawTransactionArgument<string>;
}
export interface AssertOrderCollateralTypeOptions {
    package?: string;
    arguments: AssertOrderCollateralTypeArguments | [
        order: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertOrderCollateralType(options: AssertOrderCollateralTypeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'assert_order_collateral_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculatePoolReserveAmountFromValuesArguments {
    size: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface CalculatePoolReserveAmountFromValuesOptions {
    package?: string;
    arguments: CalculatePoolReserveAmountFromValuesArguments | [
        size: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function calculatePoolReserveAmountFromValues(options: CalculatePoolReserveAmountFromValuesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["size", "price", "collateralDecimal", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'calculate_pool_reserve_amount_from_values',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateReserveAmountArguments {
    position: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface CalculateReserveAmountOptions {
    package?: string;
    arguments: CalculateReserveAmountArguments | [
        position: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function calculateReserveAmount(options: CalculateReserveAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "price", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'calculate_reserve_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateReserveAmountFromValuesArguments {
    size: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralDecimal: RawTransactionArgument<number>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface CalculateReserveAmountFromValuesOptions {
    package?: string;
    arguments: CalculateReserveAmountFromValuesArguments | [
        size: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralDecimal: RawTransactionArgument<number>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function calculateReserveAmountFromValues(options: CalculateReserveAmountFromValuesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["size", "price", "collateralAmount", "collateralDecimal", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'calculate_reserve_amount_from_values',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RefreshBorrowReserveArguments {
    position: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
}
export interface RefreshBorrowReserveOptions {
    package?: string;
    arguments: RefreshBorrowReserveArguments | [
        position: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>
    ];
}
export function refreshBorrowReserve(options: RefreshBorrowReserveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "price", "collateralPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'refresh_borrow_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddPoolReserveArguments {
    position: RawTransactionArgument<string>;
    reserveAmount: RawTransactionArgument<number | bigint>;
}
export interface AddPoolReserveOptions {
    package?: string;
    arguments: AddPoolReserveArguments | [
        position: RawTransactionArgument<string>,
        reserveAmount: RawTransactionArgument<number | bigint>
    ];
}
export function addPoolReserve(options: AddPoolReserveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "reserveAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'add_pool_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RealizePoolReserveArguments {
    position: RawTransactionArgument<string>;
    reduceSize: RawTransactionArgument<string>;
    originalSize: RawTransactionArgument<string>;
}
export interface RealizePoolReserveOptions {
    package?: string;
    arguments: RealizePoolReserveArguments | [
        position: RawTransactionArgument<string>,
        reduceSize: RawTransactionArgument<string>,
        originalSize: RawTransactionArgument<string>
    ];
}
export function realizePoolReserve(options: RealizePoolReserveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "reduceSize", "originalSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'realize_pool_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdatePositionSizeArguments {
    position: RawTransactionArgument<string>;
    newSize: RawTransactionArgument<string>;
    newAvgPrice: RawTransactionArgument<string>;
    newSide: RawTransactionArgument<boolean>;
}
export interface UpdatePositionSizeOptions {
    package?: string;
    arguments: UpdatePositionSizeArguments | [
        position: RawTransactionArgument<string>,
        newSize: RawTransactionArgument<string>,
        newAvgPrice: RawTransactionArgument<string>,
        newSide: RawTransactionArgument<boolean>
    ];
}
/** Updates position size and average price (on partial fill / increase). */
export function updatePositionSize(options: UpdatePositionSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "newSize", "newAvgPrice", "newSide"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'update_position_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateFeesArguments {
    position: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    cumulativeBorrowRate: RawTransactionArgument<string>;
    cumulativeFundingSign: RawTransactionArgument<boolean>;
    cumulativeFundingIndex: RawTransactionArgument<string>;
}
export interface UpdateFeesOptions {
    package?: string;
    arguments: UpdateFeesArguments | [
        position: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        cumulativeBorrowRate: RawTransactionArgument<string>,
        cumulativeFundingSign: RawTransactionArgument<boolean>,
        cumulativeFundingIndex: RawTransactionArgument<string>
    ];
}
/** Updates position borrow and funding fee state. */
export function updateFees(options: UpdateFeesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "collateralPrice", "cumulativeBorrowRate", "cumulativeFundingSign", "cumulativeFundingIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'update_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddTradingFeeArguments {
    position: RawTransactionArgument<string>;
    fee: RawTransactionArgument<number | bigint>;
}
export interface AddTradingFeeOptions {
    package?: string;
    arguments: AddTradingFeeArguments | [
        position: RawTransactionArgument<string>,
        fee: RawTransactionArgument<number | bigint>
    ];
}
/** Adds trading fee to unrealized. */
export function addTradingFee(options: AddTradingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "fee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'add_trading_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RealizePartialFeesArguments {
    position: RawTransactionArgument<string>;
    reduceSize: RawTransactionArgument<string>;
    originalSize: RawTransactionArgument<string>;
}
export interface RealizePartialFeesOptions {
    package?: string;
    arguments: RealizePartialFeesArguments | [
        position: RawTransactionArgument<string>,
        reduceSize: RawTransactionArgument<string>,
        originalSize: RawTransactionArgument<string>
    ];
}
/**
 * Realizes a proportional share of fees for a partial reduction. Returns
 * (borrow_fee, funding_sign, funding_fee, trading_fee).
 */
export function realizePartialFees(options: RealizePartialFeesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "reduceSize", "originalSize"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'realize_partial_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddLinkedOrderArguments {
    position: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    priceKey: RawTransactionArgument<number | bigint>;
}
export interface AddLinkedOrderOptions {
    package?: string;
    arguments: AddLinkedOrderArguments | [
        position: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        priceKey: RawTransactionArgument<number | bigint>
    ];
}
/** Adds a linked order to a position. */
export function addLinkedOrder(options: AddLinkedOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "orderId", "priceKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'add_linked_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxLinkedOrdersOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxLinkedOrders(options: MaxLinkedOrdersOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'max_linked_orders',
    });
}
export interface RemoveLinkedOrderArguments {
    position: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface RemoveLinkedOrderOptions {
    package?: string;
    arguments: RemoveLinkedOrderArguments | [
        position: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
/** Removes a linked order from a position. */
export function removeLinkedOrder(options: RemoveLinkedOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["position", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'remove_linked_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnrealizedPnlArguments {
    position: RawTransactionArgument<string>;
    currentPrice: RawTransactionArgument<string>;
}
export interface UnrealizedPnlOptions {
    package?: string;
    arguments: UnrealizedPnlArguments | [
        position: RawTransactionArgument<string>,
        currentPrice: RawTransactionArgument<string>
    ];
}
/** Calculates unrealized PnL. Returns (is_profit, pnl as Float in USD). */
export function unrealizedPnl(options: UnrealizedPnlOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "currentPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'unrealized_pnl',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CheckOrderFillableArguments {
    order: RawTransactionArgument<string>;
    oraclePrice: RawTransactionArgument<string>;
}
export interface CheckOrderFillableOptions {
    package?: string;
    arguments: CheckOrderFillableArguments | [
        order: RawTransactionArgument<string>,
        oraclePrice: RawTransactionArgument<string>
    ];
}
/** Returns true if the order should be filled at the given oracle price. */
export function checkOrderFillable(options: CheckOrderFillableOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order", "oraclePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'check_order_fillable',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsLiquidatableArguments {
    position: RawTransactionArgument<string>;
    currentPrice: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    closingFee: RawTransactionArgument<string>;
    maintenanceMargin: RawTransactionArgument<string>;
    cumulativeBorrowRate: RawTransactionArgument<string>;
    cumulativeFundingSign: RawTransactionArgument<boolean>;
    cumulativeFundingIndex: RawTransactionArgument<string>;
}
export interface IsLiquidatableOptions {
    package?: string;
    arguments: IsLiquidatableArguments | [
        position: RawTransactionArgument<string>,
        currentPrice: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        closingFee: RawTransactionArgument<string>,
        maintenanceMargin: RawTransactionArgument<string>,
        cumulativeBorrowRate: RawTransactionArgument<string>,
        cumulativeFundingSign: RawTransactionArgument<boolean>,
        cumulativeFundingIndex: RawTransactionArgument<string>
    ];
}
/**
 * Returns true if the position is liquidatable. `maintenance_margin` is a Float
 * rate (e.g. 0.015 = 1.5%).
 */
export function isLiquidatable(options: IsLiquidatableOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        null,
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "currentPrice", "collateralPrice", "closingFee", "maintenanceMargin", "cumulativeBorrowRate", "cumulativeFundingSign", "cumulativeFundingIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'is_liquidatable',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateBorrowFeeArguments {
    position: RawTransactionArgument<string>;
    cumulativeBorrowRate: RawTransactionArgument<string>;
}
export interface CalculateBorrowFeeOptions {
    package?: string;
    arguments: CalculateBorrowFeeArguments | [
        position: RawTransactionArgument<string>,
        cumulativeBorrowRate: RawTransactionArgument<string>
    ];
}
export function calculateBorrowFee(options: CalculateBorrowFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "cumulativeBorrowRate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'calculate_borrow_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateFundingFeeArguments {
    position: RawTransactionArgument<string>;
    collateralPrice: RawTransactionArgument<string>;
    cumulativeFundingSign: RawTransactionArgument<boolean>;
    cumulativeFundingIndex: RawTransactionArgument<string>;
}
export interface CalculateFundingFeeOptions {
    package?: string;
    arguments: CalculateFundingFeeArguments | [
        position: RawTransactionArgument<string>,
        collateralPrice: RawTransactionArgument<string>,
        cumulativeFundingSign: RawTransactionArgument<boolean>,
        cumulativeFundingIndex: RawTransactionArgument<string>
    ];
}
export function calculateFundingFee(options: CalculateFundingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position", "collateralPrice", "cumulativeFundingSign", "cumulativeFundingIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'calculate_funding_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetPositionIdArguments {
    p: RawTransactionArgument<string>;
}
export interface GetPositionIdOptions {
    package?: string;
    arguments: GetPositionIdArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function getPositionId(options: GetPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'get_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionAccountObjectAddressArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionAccountObjectAddressOptions {
    package?: string;
    arguments: PositionAccountObjectAddressArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionAccountObjectAddress(options: PositionAccountObjectAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_account_object_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionMarketIdArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionMarketIdOptions {
    package?: string;
    arguments: PositionMarketIdArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionMarketId(options: PositionMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionIsLongArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionIsLongOptions {
    package?: string;
    arguments: PositionIsLongArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionIsLong(options: PositionIsLongOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionSizeArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionSizeOptions {
    package?: string;
    arguments: PositionSizeArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionSize(options: PositionSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCollateralTokenArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionCollateralTokenOptions {
    package?: string;
    arguments: PositionCollateralTokenArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionCollateralToken(options: PositionCollateralTokenOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_collateral_token',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCollateralDecimalArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionCollateralDecimalOptions {
    package?: string;
    arguments: PositionCollateralDecimalArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionCollateralDecimal(options: PositionCollateralDecimalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_collateral_decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCollateralAmountArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionCollateralAmountOptions {
    package?: string;
    arguments: PositionCollateralAmountArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionCollateralAmount(options: PositionCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionAveragePriceArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionAveragePriceOptions {
    package?: string;
    arguments: PositionAveragePriceArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionAveragePrice(options: PositionAveragePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_average_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionEntryBorrowIndexArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionEntryBorrowIndexOptions {
    package?: string;
    arguments: PositionEntryBorrowIndexArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionEntryBorrowIndex(options: PositionEntryBorrowIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_entry_borrow_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionPoolReserveAmountArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionPoolReserveAmountOptions {
    package?: string;
    arguments: PositionPoolReserveAmountArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionPoolReserveAmount(options: PositionPoolReserveAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_pool_reserve_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionBorrowReserveAmountArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionBorrowReserveAmountOptions {
    package?: string;
    arguments: PositionBorrowReserveAmountArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionBorrowReserveAmount(options: PositionBorrowReserveAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_borrow_reserve_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionLinkedOrderIdsArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionLinkedOrderIdsOptions {
    package?: string;
    arguments: PositionLinkedOrderIdsArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionLinkedOrderIds(options: PositionLinkedOrderIdsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_linked_order_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionLinkedOrderPriceKeysArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionLinkedOrderPriceKeysOptions {
    package?: string;
    arguments: PositionLinkedOrderPriceKeysArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionLinkedOrderPriceKeys(options: PositionLinkedOrderPriceKeysOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_linked_order_price_keys',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionUnrealizedBorrowFeeArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionUnrealizedBorrowFeeOptions {
    package?: string;
    arguments: PositionUnrealizedBorrowFeeArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionUnrealizedBorrowFee(options: PositionUnrealizedBorrowFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_unrealized_borrow_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionUnrealizedTradingFeeArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionUnrealizedTradingFeeOptions {
    package?: string;
    arguments: PositionUnrealizedTradingFeeArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionUnrealizedTradingFee(options: PositionUnrealizedTradingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_unrealized_trading_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionUnrealizedFundingSignArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionUnrealizedFundingSignOptions {
    package?: string;
    arguments: PositionUnrealizedFundingSignArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionUnrealizedFundingSign(options: PositionUnrealizedFundingSignOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_unrealized_funding_sign',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionUnrealizedFundingFeeArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionUnrealizedFundingFeeOptions {
    package?: string;
    arguments: PositionUnrealizedFundingFeeArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionUnrealizedFundingFee(options: PositionUnrealizedFundingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_unrealized_funding_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionUpdateTimestampArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionUpdateTimestampOptions {
    package?: string;
    arguments: PositionUpdateTimestampArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionUpdateTimestamp(options: PositionUpdateTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_update_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionEntryFundingSignArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionEntryFundingSignOptions {
    package?: string;
    arguments: PositionEntryFundingSignArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionEntryFundingSign(options: PositionEntryFundingSignOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_entry_funding_sign',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionEntryFundingIndexArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionEntryFundingIndexOptions {
    package?: string;
    arguments: PositionEntryFundingIndexArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionEntryFundingIndex(options: PositionEntryFundingIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_entry_funding_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionFeeStateArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionFeeStateOptions {
    package?: string;
    arguments: PositionFeeStateArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionFeeState(options: PositionFeeStateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_fee_state',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCreateTimestampArguments {
    p: RawTransactionArgument<string>;
}
export interface PositionCreateTimestampOptions {
    package?: string;
    arguments: PositionCreateTimestampArguments | [
        p: RawTransactionArgument<string>
    ];
}
export function positionCreateTimestamp(options: PositionCreateTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["p"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'position_create_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetOrderIdArguments {
    o: RawTransactionArgument<string>;
}
export interface GetOrderIdOptions {
    package?: string;
    arguments: GetOrderIdArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function getOrderId(options: GetOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'get_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderAccountObjectAddressArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderAccountObjectAddressOptions {
    package?: string;
    arguments: OrderAccountObjectAddressArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderAccountObjectAddress(options: OrderAccountObjectAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_account_object_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderMarketIdArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderMarketIdOptions {
    package?: string;
    arguments: OrderMarketIdArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderMarketId(options: OrderMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderIsLongArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderIsLongOptions {
    package?: string;
    arguments: OrderIsLongArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderIsLong(options: OrderIsLongOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderIsStopOrderArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderIsStopOrderOptions {
    package?: string;
    arguments: OrderIsStopOrderArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderIsStopOrder(options: OrderIsStopOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_is_stop_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderReduceOnlyArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderReduceOnlyOptions {
    package?: string;
    arguments: OrderReduceOnlyArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderReduceOnly(options: OrderReduceOnlyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_reduce_only',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderSizeArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderSizeOptions {
    package?: string;
    arguments: OrderSizeArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderSize(options: OrderSizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderTriggerPriceArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderTriggerPriceOptions {
    package?: string;
    arguments: OrderTriggerPriceArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderTriggerPrice(options: OrderTriggerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_trigger_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderAcceptablePriceArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderAcceptablePriceOptions {
    package?: string;
    arguments: OrderAcceptablePriceArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderAcceptablePrice(options: OrderAcceptablePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_acceptable_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderLinkedPositionIdArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderLinkedPositionIdOptions {
    package?: string;
    arguments: OrderLinkedPositionIdArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderLinkedPositionId(options: OrderLinkedPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_linked_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCollateralTokenArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderCollateralTokenOptions {
    package?: string;
    arguments: OrderCollateralTokenArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderCollateralToken(options: OrderCollateralTokenOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_collateral_token',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCollateralDecimalArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderCollateralDecimalOptions {
    package?: string;
    arguments: OrderCollateralDecimalArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderCollateralDecimal(options: OrderCollateralDecimalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_collateral_decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCollateralAmountArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderCollateralAmountOptions {
    package?: string;
    arguments: OrderCollateralAmountArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderCollateralAmount(options: OrderCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderLeverageBpsArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderLeverageBpsOptions {
    package?: string;
    arguments: OrderLeverageBpsArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderLeverageBps(options: OrderLeverageBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_leverage_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCreateTimestampArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderCreateTimestampOptions {
    package?: string;
    arguments: OrderCreateTimestampArguments | [
        o: RawTransactionArgument<string>
    ];
}
export function orderCreateTimestamp(options: OrderCreateTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_create_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderTypeTagArguments {
    o: RawTransactionArgument<string>;
}
export interface OrderTypeTagOptions {
    package?: string;
    arguments: OrderTypeTagArguments | [
        o: RawTransactionArgument<string>
    ];
}
/** Returns order type tag: 0=limit_buy, 1=limit_sell, 2=stop_buy, 3=stop_sell. */
export function orderTypeTag(options: OrderTypeTagOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["o"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'order_type_tag',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}