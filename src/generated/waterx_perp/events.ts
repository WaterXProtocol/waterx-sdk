/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * All event structs for the WaterX Perpetual Protocol. Follows Bucket naming
 * conventions: \_amount, \_address, \_timestamp suffixes.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as type_name_2 from './deps/std/type_name.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as type_name_3 from './deps/std/type_name.ts';
import * as type_name_4 from './deps/std/type_name.ts';
import * as float_2 from './deps/bucket_v2_framework/float.ts';
import * as type_name_5 from './deps/std/type_name.ts';
import * as float_3 from './deps/bucket_v2_framework/float.ts';
import * as type_name_6 from './deps/std/type_name.ts';
import * as type_name_7 from './deps/std/type_name.ts';
import * as float_4 from './deps/bucket_v2_framework/float.ts';
import * as float_5 from './deps/bucket_v2_framework/float.ts';
import * as type_name_8 from './deps/std/type_name.ts';
import * as float_6 from './deps/bucket_v2_framework/float.ts';
import * as type_name_9 from './deps/std/type_name.ts';
import * as type_name_10 from './deps/std/type_name.ts';
import * as float_7 from './deps/bucket_v2_framework/float.ts';
import * as type_name_11 from './deps/std/type_name.ts';
import * as float_8 from './deps/bucket_v2_framework/float.ts';
import * as type_name_12 from './deps/std/type_name.ts';
import * as type_name_13 from './deps/std/type_name.ts';
import * as type_name_14 from './deps/std/type_name.ts';
import * as type_name_15 from './deps/std/type_name.ts';
import * as type_name_16 from './deps/std/type_name.ts';
import * as float_9 from './deps/bucket_v2_framework/float.ts';
import * as float_10 from './deps/bucket_v2_framework/float.ts';
import * as type_name_17 from './deps/std/type_name.ts';
import * as type_name_18 from './deps/std/type_name.ts';
import * as type_name_19 from './deps/std/type_name.ts';
import * as type_name_20 from './deps/std/type_name.ts';
import * as type_name_21 from './deps/std/type_name.ts';
import * as type_name_22 from './deps/std/type_name.ts';
import * as float_11 from './deps/bucket_v2_framework/float.ts';
import * as float_12 from './deps/bucket_v2_framework/float.ts';
import * as float_13 from './deps/bucket_v2_framework/float.ts';
import * as type_name_23 from './deps/std/type_name.ts';
import * as type_name_24 from './deps/std/type_name.ts';
import * as type_name_25 from './deps/std/type_name.ts';
import * as type_name_26 from './deps/std/type_name.ts';
import * as type_name_27 from './deps/std/type_name.ts';
import * as type_name_28 from './deps/std/type_name.ts';
import * as type_name_29 from './deps/std/type_name.ts';
import * as type_name_30 from './deps/std/type_name.ts';
import * as type_name_31 from './deps/std/type_name.ts';
import * as float_14 from './deps/bucket_v2_framework/float.ts';
import * as double from './deps/bucket_v2_framework/double.ts';
import * as float_15 from './deps/bucket_v2_framework/float.ts';
import * as float_16 from './deps/bucket_v2_framework/float.ts';
import * as type_name_32 from './deps/std/type_name.ts';
import * as type_name_33 from './deps/std/type_name.ts';
import * as type_name_34 from './deps/std/type_name.ts';
import * as type_name_35 from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp::events';
export const PositionOpened = new MoveStruct({ name: `${$moduleName}::PositionOpened`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        base_type: type_name.TypeName,
        wlp_type: type_name_1.TypeName,
        is_long: bcs.bool(),
        size: float.Float,
        collateral_amount: bcs.u64(),
        collateral_type: type_name_2.TypeName,
        leverage_bps: bcs.u64(),
        entry_price: float_1.Float,
        open_fee_amount: bcs.u64(),
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const PositionClosed = new MoveStruct({ name: `${$moduleName}::PositionClosed`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        base_type: type_name_3.TypeName,
        wlp_type: type_name_4.TypeName,
        is_long: bcs.bool(),
        size: float_2.Float,
        collateral_type: type_name_5.TypeName,
        exit_price: float_3.Float,
        pnl_amount: bcs.u64(),
        pnl_is_profit: bcs.bool(),
        close_fee_amount: bcs.u64(),
        funding_fee_amount: bcs.u64(),
        borrow_fee_amount: bcs.u64(),
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const PositionModified = new MoveStruct({ name: `${$moduleName}::PositionModified`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        base_type: type_name_6.TypeName,
        wlp_type: type_name_7.TypeName,
        is_long: bcs.bool(),
        is_increase: bcs.bool(),
        delta_size: float_4.Float,
        new_size: float_5.Float,
        new_collateral_amount: bcs.u64(),
        collateral_type: type_name_8.TypeName,
        execution_price: float_6.Float,
        realized_pnl_amount: bcs.u64(),
        pnl_is_profit: bcs.bool(),
        fee_amount: bcs.u64(),
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const PositionLiquidated = new MoveStruct({ name: `${$moduleName}::PositionLiquidated`, fields: {
        account_object_address: bcs.Address,
        liquidator_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        base_type: type_name_9.TypeName,
        wlp_type: type_name_10.TypeName,
        is_long: bcs.bool(),
        size: float_7.Float,
        collateral_amount: bcs.u64(),
        collateral_type: type_name_11.TypeName,
        liquidator_fee_amount: bcs.u64(),
        insurance_fee_amount: bcs.u64(),
        lp_pool_amount: bcs.u64(),
        mark_price: float_8.Float,
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const CollateralModified = new MoveStruct({ name: `${$moduleName}::CollateralModified`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        base_type: type_name_12.TypeName,
        wlp_type: type_name_13.TypeName,
        is_increase: bcs.bool(),
        delta_amount: bcs.u64(),
        new_collateral_amount: bcs.u64(),
        collateral_type: type_name_14.TypeName,
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const OrderCreated = new MoveStruct({ name: `${$moduleName}::OrderCreated`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        base_type: type_name_15.TypeName,
        wlp_type: type_name_16.TypeName,
        order_type: bcs.u8(),
        is_long: bcs.bool(),
        reduce_only: bcs.bool(),
        linked_position_id: bcs.option(bcs.u64()),
        size: float_9.Float,
        trigger_price: float_10.Float,
        collateral_amount: bcs.u64(),
        collateral_type: type_name_17.TypeName,
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const OrderCancelled = new MoveStruct({ name: `${$moduleName}::OrderCancelled`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        base_type: type_name_18.TypeName,
        wlp_type: type_name_19.TypeName,
        withdrawal_collateral_amount: bcs.u64(),
        collateral_type: type_name_20.TypeName,
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const OrderFilled = new MoveStruct({ name: `${$moduleName}::OrderFilled`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        base_type: type_name_21.TypeName,
        wlp_type: type_name_22.TypeName,
        position_id: bcs.u64(),
        filled_price: float_11.Float,
        filled_size: float_12.Float,
        fee_amount: bcs.u64(),
        volume_usd: float_13.Float,
        collateral_type: type_name_23.TypeName,
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const FeeCollected = new MoveStruct({ name: `${$moduleName}::FeeCollected`, fields: {
        fee_type: bcs.u8(),
        amount: bcs.u64(),
        market_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const ProtocolFeeCollected = new MoveStruct({ name: `${$moduleName}::ProtocolFeeCollected`, fields: {
        fee_address: bcs.Address,
        amount: bcs.u64(),
        market_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const WlpMinted = new MoveStruct({ name: `${$moduleName}::WlpMinted`, fields: {
        wlp_type: type_name_24.TypeName,
        token_type: type_name_25.TypeName,
        deposit_amount: bcs.u64(),
        wlp_amount: bcs.u64(),
        fee_amount: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const WlpRedeemRequested = new MoveStruct({ name: `${$moduleName}::WlpRedeemRequested`, fields: {
        user_address: bcs.Address,
        wlp_type: type_name_26.TypeName,
        token_type: type_name_27.TypeName,
        wlp_amount: bcs.u64(),
        request_id: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const WlpRedeemCancelled = new MoveStruct({ name: `${$moduleName}::WlpRedeemCancelled`, fields: {
        user_address: bcs.Address,
        wlp_type: type_name_28.TypeName,
        token_type: type_name_29.TypeName,
        request_id: bcs.u64(),
        wlp_amount: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const WlpRedeemSettled = new MoveStruct({ name: `${$moduleName}::WlpRedeemSettled`, fields: {
        user_address: bcs.Address,
        wlp_type: type_name_30.TypeName,
        token_type: type_name_31.TypeName,
        request_id: bcs.u64(),
        redeem_amount: bcs.u64(),
        fee_amount: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const FundingRateUpdated = new MoveStruct({ name: `${$moduleName}::FundingRateUpdated`, fields: {
        market_id: bcs.Address,
        funding_rate: float_14.Float,
        cumulative_index: double.Double,
        long_oi: float_15.Float,
        short_oi: float_16.Float,
        timestamp: bcs.u64()
    } });
export const BorrowRateUpdated = new MoveStruct({ name: `${$moduleName}::BorrowRateUpdated`, fields: {
        token_type: type_name_32.TypeName,
        borrow_rate: bcs.u64(),
        cumulative_rate: bcs.u64(),
        utilization_bps: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const AccountCreated = new MoveStruct({ name: `${$moduleName}::AccountCreated`, fields: {
        user_address: bcs.Address,
        account_id: bcs.Address,
        timestamp: bcs.u64()
    } });
export const Deposited = new MoveStruct({ name: `${$moduleName}::Deposited`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_33.TypeName,
        amount: bcs.u64(),
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const Withdrawn = new MoveStruct({ name: `${$moduleName}::Withdrawn`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_34.TypeName,
        amount: bcs.u64(),
        timestamp: bcs.u64(),
        sender: bcs.Address
    } });
export const ReferralBound = new MoveStruct({ name: `${$moduleName}::ReferralBound`, fields: {
        user_address: bcs.Address,
        referrer_address: bcs.Address,
        code: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const ReferralVolumeRecorded = new MoveStruct({ name: `${$moduleName}::ReferralVolumeRecorded`, fields: {
        referrer_address: bcs.Address,
        trader_address: bcs.Address,
        volume_amount: bcs.u64(),
        timestamp: bcs.u64()
    } });
export const SubAccountCreated = new MoveStruct({ name: `${$moduleName}::SubAccountCreated`, fields: {
        user_address: bcs.Address,
        sub_account_id: bcs.Address,
        name: bcs.string(),
        timestamp: bcs.u64()
    } });
export const SubAccountTransfer = new MoveStruct({ name: `${$moduleName}::SubAccountTransfer`, fields: {
        user_address: bcs.Address,
        sub_account_id: bcs.Address,
        token_type: type_name_35.TypeName,
        amount: bcs.u64(),
        is_deposit: bcs.bool(),
        timestamp: bcs.u64()
    } });
export interface EmitPositionOpenedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    leverageBps: RawTransactionArgument<number | bigint>;
    entryPrice: RawTransactionArgument<string>;
    openFeeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitPositionOpenedOptions {
    package?: string;
    arguments: EmitPositionOpenedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        leverageBps: RawTransactionArgument<number | bigint>,
        entryPrice: RawTransactionArgument<string>,
        openFeeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitPositionOpened(options: EmitPositionOpenedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'bool',
        null,
        'u64',
        null,
        'u64',
        null,
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "positionId", "baseType", "wlpType", "isLong", "size", "collateralAmount", "collateralType", "leverageBps", "entryPrice", "openFeeAmount", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_opened',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPositionClosedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralType: RawTransactionArgument<string>;
    exitPrice: RawTransactionArgument<string>;
    pnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    closeFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeAmount: RawTransactionArgument<number | bigint>;
    borrowFeeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitPositionClosedOptions {
    package?: string;
    arguments: EmitPositionClosedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralType: RawTransactionArgument<string>,
        exitPrice: RawTransactionArgument<string>,
        pnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        closeFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeAmount: RawTransactionArgument<number | bigint>,
        borrowFeeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitPositionClosed(options: EmitPositionClosedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'bool',
        null,
        null,
        null,
        'u64',
        'bool',
        'u64',
        'u64',
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "positionId", "baseType", "wlpType", "isLong", "size", "collateralType", "exitPrice", "pnlAmount", "pnlIsProfit", "closeFeeAmount", "fundingFeeAmount", "borrowFeeAmount", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_closed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPositionModifiedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    isIncrease: RawTransactionArgument<boolean>;
    deltaSize: RawTransactionArgument<string>;
    newSize: RawTransactionArgument<string>;
    newCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    realizedPnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    feeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitPositionModifiedOptions {
    package?: string;
    arguments: EmitPositionModifiedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        isIncrease: RawTransactionArgument<boolean>,
        deltaSize: RawTransactionArgument<string>,
        newSize: RawTransactionArgument<string>,
        newCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        realizedPnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        feeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitPositionModified(options: EmitPositionModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'bool',
        'bool',
        null,
        null,
        'u64',
        null,
        null,
        'u64',
        'bool',
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "positionId", "baseType", "wlpType", "isLong", "isIncrease", "deltaSize", "newSize", "newCollateralAmount", "collateralType", "executionPrice", "realizedPnlAmount", "pnlIsProfit", "feeAmount", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPositionLiquidatedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    liquidatorAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    liquidatorFeeAmount: RawTransactionArgument<number | bigint>;
    insuranceFeeAmount: RawTransactionArgument<number | bigint>;
    lpPoolAmount: RawTransactionArgument<number | bigint>;
    markPrice: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitPositionLiquidatedOptions {
    package?: string;
    arguments: EmitPositionLiquidatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        liquidatorAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        liquidatorFeeAmount: RawTransactionArgument<number | bigint>,
        insuranceFeeAmount: RawTransactionArgument<number | bigint>,
        lpPoolAmount: RawTransactionArgument<number | bigint>,
        markPrice: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitPositionLiquidated(options: EmitPositionLiquidatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'bool',
        null,
        'u64',
        null,
        'u64',
        'u64',
        'u64',
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "liquidatorAddress", "marketId", "positionId", "baseType", "wlpType", "isLong", "size", "collateralAmount", "collateralType", "liquidatorFeeAmount", "insuranceFeeAmount", "lpPoolAmount", "markPrice", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_liquidated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitCollateralModifiedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isIncrease: RawTransactionArgument<boolean>;
    deltaAmount: RawTransactionArgument<number | bigint>;
    newCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitCollateralModifiedOptions {
    package?: string;
    arguments: EmitCollateralModifiedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isIncrease: RawTransactionArgument<boolean>,
        deltaAmount: RawTransactionArgument<number | bigint>,
        newCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitCollateralModified(options: EmitCollateralModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'bool',
        'u64',
        'u64',
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "positionId", "baseType", "wlpType", "isIncrease", "deltaAmount", "newCollateralAmount", "collateralType", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_collateral_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderCreatedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitOrderCreatedOptions {
    package?: string;
    arguments: EmitOrderCreatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitOrderCreated(options: EmitOrderCreatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'u8',
        'bool',
        'bool',
        '0x1::option::Option<u64>',
        null,
        null,
        'u64',
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "baseType", "wlpType", "orderType", "isLong", "reduceOnly", "linkedPositionId", "size", "triggerPrice", "collateralAmount", "collateralType", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_created',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderCancelledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    withdrawalCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitOrderCancelledOptions {
    package?: string;
    arguments: EmitOrderCancelledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        withdrawalCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitOrderCancelled(options: EmitOrderCancelledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'u64',
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "baseType", "wlpType", "withdrawalCollateralAmount", "collateralType", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderFilledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    baseType: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    filledPrice: RawTransactionArgument<string>;
    filledSize: RawTransactionArgument<string>;
    feeAmount: RawTransactionArgument<number | bigint>;
    volumeUsd: RawTransactionArgument<string>;
    collateralType: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitOrderFilledOptions {
    package?: string;
    arguments: EmitOrderFilledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        baseType: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        filledPrice: RawTransactionArgument<string>,
        filledSize: RawTransactionArgument<string>,
        feeAmount: RawTransactionArgument<number | bigint>,
        volumeUsd: RawTransactionArgument<string>,
        collateralType: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitOrderFilled(options: EmitOrderFilledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        null,
        null,
        'u64',
        null,
        null,
        'u64',
        null,
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "baseType", "wlpType", "positionId", "filledPrice", "filledSize", "feeAmount", "volumeUsd", "collateralType", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_filled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitFeeCollectedArguments {
    feeType: RawTransactionArgument<number>;
    amount: RawTransactionArgument<number | bigint>;
    marketId: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitFeeCollectedOptions {
    package?: string;
    arguments: EmitFeeCollectedArguments | [
        feeType: RawTransactionArgument<number>,
        amount: RawTransactionArgument<number | bigint>,
        marketId: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitFeeCollected(options: EmitFeeCollectedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u8',
        'u64',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["feeType", "amount", "marketId", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_fee_collected',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitProtocolFeeCollectedArguments {
    feeAddress: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    marketId: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitProtocolFeeCollectedOptions {
    package?: string;
    arguments: EmitProtocolFeeCollectedArguments | [
        feeAddress: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        marketId: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitProtocolFeeCollected(options: EmitProtocolFeeCollectedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'u64',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["feeAddress", "amount", "marketId", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_protocol_fee_collected',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpMintedArguments {
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    depositAmount: RawTransactionArgument<number | bigint>;
    wlpAmount: RawTransactionArgument<number | bigint>;
    feeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpMintedOptions {
    package?: string;
    arguments: EmitWlpMintedArguments | [
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        depositAmount: RawTransactionArgument<number | bigint>,
        wlpAmount: RawTransactionArgument<number | bigint>,
        feeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpMinted(options: EmitWlpMintedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wlpType", "tokenType", "depositAmount", "wlpAmount", "feeAmount", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_minted',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemRequestedArguments {
    userAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    wlpAmount: RawTransactionArgument<number | bigint>;
    requestId: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemRequestedOptions {
    package?: string;
    arguments: EmitWlpRedeemRequestedArguments | [
        userAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        wlpAmount: RawTransactionArgument<number | bigint>,
        requestId: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemRequested(options: EmitWlpRedeemRequestedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "wlpType", "tokenType", "wlpAmount", "requestId", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_requested',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemCancelledArguments {
    userAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    wlpAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemCancelledOptions {
    package?: string;
    arguments: EmitWlpRedeemCancelledArguments | [
        userAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        wlpAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemCancelled(options: EmitWlpRedeemCancelledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "wlpType", "tokenType", "requestId", "wlpAmount", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemSettledArguments {
    userAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    redeemAmount: RawTransactionArgument<number | bigint>;
    feeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemSettledOptions {
    package?: string;
    arguments: EmitWlpRedeemSettledArguments | [
        userAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        redeemAmount: RawTransactionArgument<number | bigint>,
        feeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemSettled(options: EmitWlpRedeemSettledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "wlpType", "tokenType", "requestId", "redeemAmount", "feeAmount", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_settled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitFundingRateUpdatedArguments {
    marketId: RawTransactionArgument<string>;
    fundingRate: RawTransactionArgument<string>;
    cumulativeIndex: RawTransactionArgument<string>;
    longOi: RawTransactionArgument<string>;
    shortOi: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitFundingRateUpdatedOptions {
    package?: string;
    arguments: EmitFundingRateUpdatedArguments | [
        marketId: RawTransactionArgument<string>,
        fundingRate: RawTransactionArgument<string>,
        cumulativeIndex: RawTransactionArgument<string>,
        longOi: RawTransactionArgument<string>,
        shortOi: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitFundingRateUpdated(options: EmitFundingRateUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        null,
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "fundingRate", "cumulativeIndex", "longOi", "shortOi", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_funding_rate_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitBorrowRateUpdatedArguments {
    tokenType: RawTransactionArgument<string>;
    borrowRate: RawTransactionArgument<number | bigint>;
    cumulativeRate: RawTransactionArgument<number | bigint>;
    utilizationBps: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitBorrowRateUpdatedOptions {
    package?: string;
    arguments: EmitBorrowRateUpdatedArguments | [
        tokenType: RawTransactionArgument<string>,
        borrowRate: RawTransactionArgument<number | bigint>,
        cumulativeRate: RawTransactionArgument<number | bigint>,
        utilizationBps: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitBorrowRateUpdated(options: EmitBorrowRateUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["tokenType", "borrowRate", "cumulativeRate", "utilizationBps", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_borrow_rate_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitAccountCreatedArguments {
    userAddress: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitAccountCreatedOptions {
    package?: string;
    arguments: EmitAccountCreatedArguments | [
        userAddress: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitAccountCreated(options: EmitAccountCreatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "accountId", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_account_created',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitDepositedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitDepositedOptions {
    package?: string;
    arguments: EmitDepositedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitDeposited(options: EmitDepositedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "tokenType", "amount", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_deposited',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWithdrawnArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
    sender: RawTransactionArgument<string>;
}
export interface EmitWithdrawnOptions {
    package?: string;
    arguments: EmitWithdrawnArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>,
        sender: RawTransactionArgument<string>
    ];
}
export function emitWithdrawn(options: EmitWithdrawnOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        'u64',
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "tokenType", "amount", "timestamp", "sender"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_withdrawn',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitReferralBoundArguments {
    userAddress: RawTransactionArgument<string>;
    referrerAddress: RawTransactionArgument<string>;
    code: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitReferralBoundOptions {
    package?: string;
    arguments: EmitReferralBoundArguments | [
        userAddress: RawTransactionArgument<string>,
        referrerAddress: RawTransactionArgument<string>,
        code: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitReferralBound(options: EmitReferralBoundOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'address',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "referrerAddress", "code", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_referral_bound',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitReferralVolumeRecordedArguments {
    referrerAddress: RawTransactionArgument<string>;
    traderAddress: RawTransactionArgument<string>;
    volumeAmount: RawTransactionArgument<number | bigint>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitReferralVolumeRecordedOptions {
    package?: string;
    arguments: EmitReferralVolumeRecordedArguments | [
        referrerAddress: RawTransactionArgument<string>,
        traderAddress: RawTransactionArgument<string>,
        volumeAmount: RawTransactionArgument<number | bigint>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitReferralVolumeRecorded(options: EmitReferralVolumeRecordedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'address',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["referrerAddress", "traderAddress", "volumeAmount", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_referral_volume_recorded',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitSubAccountCreatedArguments {
    userAddress: RawTransactionArgument<string>;
    subAccountId: RawTransactionArgument<string>;
    name: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitSubAccountCreatedOptions {
    package?: string;
    arguments: EmitSubAccountCreatedArguments | [
        userAddress: RawTransactionArgument<string>,
        subAccountId: RawTransactionArgument<string>,
        name: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitSubAccountCreated(options: EmitSubAccountCreatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        '0x1::string::String',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "subAccountId", "name", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_sub_account_created',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitSubAccountTransferArguments {
    userAddress: RawTransactionArgument<string>;
    subAccountId: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    isDeposit: RawTransactionArgument<boolean>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface EmitSubAccountTransferOptions {
    package?: string;
    arguments: EmitSubAccountTransferArguments | [
        userAddress: RawTransactionArgument<string>,
        subAccountId: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        isDeposit: RawTransactionArgument<boolean>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function emitSubAccountTransfer(options: EmitSubAccountTransferOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        null,
        'u64',
        'bool',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["userAddress", "subAccountId", "tokenType", "amount", "isDeposit", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_sub_account_transfer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}