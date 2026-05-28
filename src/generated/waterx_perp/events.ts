/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * All event structs for the WaterX Perpetual Protocol. Follows Bucket naming
 * conventions: \_amount, \_address suffixes. Per-tx timestamp and sender are
 * available as Sui event metadata, so they're not duplicated on any event struct.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as float_2 from './deps/bucket_v2_framework/float.ts';
import * as float_3 from './deps/bucket_v2_framework/float.ts';
import * as double from './deps/bucket_v2_framework/double.ts';
import * as type_name_2 from './deps/std/type_name.ts';
import * as float_4 from './deps/bucket_v2_framework/float.ts';
import * as type_name_3 from './deps/std/type_name.ts';
import * as float_5 from './deps/bucket_v2_framework/float.ts';
import * as float_6 from './deps/bucket_v2_framework/float.ts';
import * as type_name_4 from './deps/std/type_name.ts';
import * as float_7 from './deps/bucket_v2_framework/float.ts';
import * as float_8 from './deps/bucket_v2_framework/float.ts';
import * as type_name_5 from './deps/std/type_name.ts';
import * as float_9 from './deps/bucket_v2_framework/float.ts';
import * as float_10 from './deps/bucket_v2_framework/float.ts';
import * as float_11 from './deps/bucket_v2_framework/float.ts';
import * as double_1 from './deps/bucket_v2_framework/double.ts';
import * as type_name_6 from './deps/std/type_name.ts';
import * as float_12 from './deps/bucket_v2_framework/float.ts';
import * as type_name_7 from './deps/std/type_name.ts';
import * as float_13 from './deps/bucket_v2_framework/float.ts';
import * as float_14 from './deps/bucket_v2_framework/float.ts';
import * as type_name_8 from './deps/std/type_name.ts';
import * as type_name_9 from './deps/std/type_name.ts';
import * as float_15 from './deps/bucket_v2_framework/float.ts';
import * as float_16 from './deps/bucket_v2_framework/float.ts';
import * as type_name_10 from './deps/std/type_name.ts';
import * as type_name_11 from './deps/std/type_name.ts';
import * as type_name_12 from './deps/std/type_name.ts';
import * as type_name_13 from './deps/std/type_name.ts';
import * as float_17 from './deps/bucket_v2_framework/float.ts';
import * as float_18 from './deps/bucket_v2_framework/float.ts';
import * as float_19 from './deps/bucket_v2_framework/float.ts';
import * as float_20 from './deps/bucket_v2_framework/float.ts';
import * as type_name_14 from './deps/std/type_name.ts';
import * as float_21 from './deps/bucket_v2_framework/float.ts';
import * as float_22 from './deps/bucket_v2_framework/float.ts';
import * as float_23 from './deps/bucket_v2_framework/float.ts';
import * as type_name_15 from './deps/std/type_name.ts';
import * as float_24 from './deps/bucket_v2_framework/float.ts';
import * as float_25 from './deps/bucket_v2_framework/float.ts';
import * as double_2 from './deps/bucket_v2_framework/double.ts';
import * as type_name_16 from './deps/std/type_name.ts';
import * as float_26 from './deps/bucket_v2_framework/float.ts';
import * as float_27 from './deps/bucket_v2_framework/float.ts';
import * as type_name_17 from './deps/std/type_name.ts';
import * as float_28 from './deps/bucket_v2_framework/float.ts';
import * as float_29 from './deps/bucket_v2_framework/float.ts';
import * as type_name_18 from './deps/std/type_name.ts';
import * as type_name_19 from './deps/std/type_name.ts';
import * as type_name_20 from './deps/std/type_name.ts';
import * as type_name_21 from './deps/std/type_name.ts';
import * as double_3 from './deps/bucket_v2_framework/double.ts';
import * as type_name_22 from './deps/std/type_name.ts';
import * as type_name_23 from './deps/std/type_name.ts';
import * as type_name_24 from './deps/std/type_name.ts';
import * as type_name_25 from './deps/std/type_name.ts';
import * as type_name_26 from './deps/std/type_name.ts';
import * as type_name_27 from './deps/std/type_name.ts';
import * as type_name_28 from './deps/std/type_name.ts';
import * as type_name_29 from './deps/std/type_name.ts';
import * as double_4 from './deps/bucket_v2_framework/double.ts';
import * as float_30 from './deps/bucket_v2_framework/float.ts';
import * as double_5 from './deps/bucket_v2_framework/double.ts';
import * as float_31 from './deps/bucket_v2_framework/float.ts';
import * as float_32 from './deps/bucket_v2_framework/float.ts';
import * as type_name_30 from './deps/std/type_name.ts';
import * as float_33 from './deps/bucket_v2_framework/float.ts';
import * as float_34 from './deps/bucket_v2_framework/float.ts';
import * as float_35 from './deps/bucket_v2_framework/float.ts';
import * as float_36 from './deps/bucket_v2_framework/float.ts';
import * as float_37 from './deps/bucket_v2_framework/float.ts';
import * as float_38 from './deps/bucket_v2_framework/float.ts';
import * as float_39 from './deps/bucket_v2_framework/float.ts';
import * as float_40 from './deps/bucket_v2_framework/float.ts';
import * as float_41 from './deps/bucket_v2_framework/float.ts';
import * as type_name_31 from './deps/std/type_name.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as float_42 from './deps/bucket_v2_framework/float.ts';
import * as float_43 from './deps/bucket_v2_framework/float.ts';
import * as float_44 from './deps/bucket_v2_framework/float.ts';
import * as float_45 from './deps/bucket_v2_framework/float.ts';
import * as double_6 from './deps/bucket_v2_framework/double.ts';
import * as type_name_32 from './deps/std/type_name.ts';
import * as float_46 from './deps/bucket_v2_framework/float.ts';
import * as float_47 from './deps/bucket_v2_framework/float.ts';
import * as float_48 from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/perp::events';
export const PositionOpened = new MoveStruct({ name: `${$moduleName}::PositionOpened`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        position_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name.TypeName,
        is_long: bcs.bool(),
        size: float.Float,
        collateral_amount: bcs.u64(),
        collateral_type: type_name_1.TypeName,
        leverage_bps: bcs.u64(),
        entry_price: float_1.Float,
        open_fee_amount: bcs.u64(),
        volume_usd: float_2.Float,
        entry_borrow_index: float_3.Float,
        entry_funding_sign: bcs.bool(),
        entry_funding_index: double.Double,
        unrealized_borrow_fee: bcs.u64(),
        unrealized_funding_sign: bcs.bool(),
        unrealized_funding_fee: bcs.u64(),
        memo: bcs.string()
    } });
export const PositionClosed = new MoveStruct({ name: `${$moduleName}::PositionClosed`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        position_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_2.TypeName,
        is_long: bcs.bool(),
        size: float_4.Float,
        collateral_type: type_name_3.TypeName,
        exit_price: float_5.Float,
        pnl_amount: bcs.u64(),
        pnl_is_profit: bcs.bool(),
        close_fee_amount: bcs.u64(),
        funding_fee_amount: bcs.u64(),
        /**
         * `true` when the position paid funding (cost); `false` when the position received
         * funding (income). Without this companion the `funding_fee_amount` magnitude is
         * sign-blind.
         */
        funding_fee_is_cost: bcs.bool(),
        borrow_fee_amount: bcs.u64(),
        volume_usd: float_6.Float,
        memo: bcs.string()
    } });
export const PositionModified = new MoveStruct({ name: `${$moduleName}::PositionModified`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        position_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_4.TypeName,
        is_long: bcs.bool(),
        /**
         * `true` when this op grew the position size. Always `false` when `delta_size = 0`
         * (collateral-only changes); read with `delta_size` to disambiguate the direction.
         */
        is_increase: bcs.bool(),
        delta_size: float_7.Float,
        new_size: float_8.Float,
        /**
         * `true` when this op deposited collateral into the position; `false` when it
         * withdrew collateral. For pure deposit/withdraw ops this is the user's intent;
         * for size-change ops it's the net direction after PnL + fees settle into stored
         * collateral.
         */
        is_deposit: bcs.bool(),
        delta_collateral_amount: bcs.u64(),
        new_collateral_amount: bcs.u64(),
        collateral_type: type_name_5.TypeName,
        execution_price: float_9.Float,
        realized_pnl_amount: bcs.u64(),
        pnl_is_profit: bcs.bool(),
        /**
         * Sign-blind aggregate of all realized fees on this op. Kept for backwards
         * compatibility; new consumers should read the four component fields below.
         */
        fee_amount: bcs.u64(),
        close_fee_amount: bcs.u64(),
        funding_fee_amount: bcs.u64(),
        /**
         * `true` when the position paid funding (cost); `false` when the position received
         * funding (income).
         */
        funding_fee_is_cost: bcs.bool(),
        borrow_fee_amount: bcs.u64(),
        volume_usd: float_10.Float,
        entry_borrow_index: float_11.Float,
        entry_funding_sign: bcs.bool(),
        entry_funding_index: double_1.Double,
        unrealized_borrow_fee: bcs.u64(),
        unrealized_funding_sign: bcs.bool(),
        unrealized_funding_fee: bcs.u64(),
        memo: bcs.string()
    } });
export const PositionLiquidated = new MoveStruct({ name: `${$moduleName}::PositionLiquidated`, fields: {
        account_object_address: bcs.Address,
        liquidator_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_6.TypeName,
        is_long: bcs.bool(),
        size: float_12.Float,
        collateral_amount: bcs.u64(),
        collateral_type: type_name_7.TypeName,
        liquidator_fee_amount: bcs.u64(),
        insurance_fee_amount: bcs.u64(),
        lp_pool_amount: bcs.u64(),
        /**
         * Position-level fees realized at liquidation. Without these the disposition
         * (liquidator/insurance/pool) doesn't add up to gross PnL and per-fee-type
         * liquidation analytics aren't recoverable from the event stream.
         */
        funding_fee_amount: bcs.u64(),
        funding_fee_is_cost: bcs.bool(),
        borrow_fee_amount: bcs.u64(),
        mark_price: float_13.Float,
        volume_usd: float_14.Float,
        memo: bcs.string()
    } });
export const PositionLinkedOrderModified = new MoveStruct({ name: `${$moduleName}::PositionLinkedOrderModified`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        position_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_8.TypeName,
        order_id: bcs.u64(),
        linked_order_price_key: bcs.u128(),
        is_added: bcs.bool(),
        memo: bcs.string()
    } });
export const OrderCreated = new MoveStruct({ name: `${$moduleName}::OrderCreated`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_9.TypeName,
        order_type: bcs.u8(),
        is_long: bcs.bool(),
        reduce_only: bcs.bool(),
        linked_position_id: bcs.option(bcs.u64()),
        size: float_15.Float,
        trigger_price: bcs.option(float_16.Float),
        collateral_amount: bcs.u64(),
        collateral_type: type_name_10.TypeName,
        memo: bcs.string()
    } });
export const OrderCancelled = new MoveStruct({ name: `${$moduleName}::OrderCancelled`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_11.TypeName,
        withdrawal_collateral_amount: bcs.u64(),
        collateral_type: type_name_12.TypeName,
        memo: bcs.string()
    } });
export const OrderUpdated = new MoveStruct({ name: `${$moduleName}::OrderUpdated`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_13.TypeName,
        order_type: bcs.u8(),
        is_long: bcs.bool(),
        reduce_only: bcs.bool(),
        linked_position_id: bcs.option(bcs.u64()),
        old_size: float_17.Float,
        new_size: float_18.Float,
        old_trigger_price: float_19.Float,
        new_trigger_price: float_20.Float,
        memo: bcs.string()
    } });
export const OrderFilled = new MoveStruct({ name: `${$moduleName}::OrderFilled`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        order_id: bcs.u64(),
        order_type: bcs.u8(),
        /**
         * Side of the **order** (may differ from the affected position when
         * `reduce_only=true`; reduce-only fills sit on the opposite side of the position
         * they close).
         */
        is_long: bcs.bool(),
        /**
         * `true` if the fill grew the linked/new position (open or linked-increase);
         * `false` if it reduced a position (linked-reduce, including full close).
         * Standalone opens emit `true`.
         */
        is_increase: bcs.bool(),
        reduce_only: bcs.bool(),
        symbol: bcs.string(),
        wlp_type: type_name_14.TypeName,
        position_id: bcs.u64(),
        filled_price: float_21.Float,
        filled_size: float_22.Float,
        fee_amount: bcs.u64(),
        volume_usd: float_23.Float,
        collateral_type: type_name_15.TypeName,
        /**
         * Post-fill size of the affected position. `Float::zero()` for a linked-reduce
         * that fully closed the position.
         */
        new_size: float_24.Float,
        /**
         * Post-fill collateral amount of the affected position. `0` for a linked-reduce
         * full close.
         */
        new_collateral_amount: bcs.u64(),
        /**
         * Post-`update_fees` snapshot — same six fields as `PositionOpened` /
         * `PositionModified`. All zero for a linked-reduce full close.
         */
        entry_borrow_index: float_25.Float,
        entry_funding_sign: bcs.bool(),
        entry_funding_index: double_2.Double,
        unrealized_borrow_fee: bcs.u64(),
        unrealized_funding_sign: bcs.bool(),
        unrealized_funding_fee: bcs.u64(),
        memo: bcs.string()
    } });
export const PreOrderCreated = new MoveStruct({ name: `${$moduleName}::PreOrderCreated`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        main_order_id: bcs.u64(),
        pre_order_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_16.TypeName,
        order_type: bcs.u8(),
        is_long: bcs.bool(),
        size: float_26.Float,
        trigger_price: float_27.Float,
        memo: bcs.string()
    } });
export const PreOrderCancelled = new MoveStruct({ name: `${$moduleName}::PreOrderCancelled`, fields: {
        account_object_address: bcs.Address,
        market_id: bcs.Address,
        main_order_id: bcs.u64(),
        pre_order_id: bcs.u64(),
        symbol: bcs.string(),
        wlp_type: type_name_17.TypeName,
        order_type: bcs.u8(),
        is_long: bcs.bool(),
        size: float_28.Float,
        trigger_price: float_29.Float,
        memo: bcs.string()
    } });
export const ProtocolFeeCollected = new MoveStruct({ name: `${$moduleName}::ProtocolFeeCollected`, fields: {
        amount: bcs.u64(),
        market_id: bcs.Address,
        memo: bcs.string()
    } });
export const WlpEquityChanged = new MoveStruct({ name: `${$moduleName}::WlpEquityChanged`, fields: {
        /** Symbol of the market whose settlement produced this LP-equity move. */
        market_ticker: bcs.string(),
        wlp_type: type_name_18.TypeName,
        token_type: type_name_19.TypeName,
        amount: bcs.u64(),
        is_profit: bcs.bool(),
        memo: bcs.string()
    } });
export const WlpMinted = new MoveStruct({ name: `${$moduleName}::WlpMinted`, fields: {
        account_object_address: bcs.Address,
        wlp_type: type_name_20.TypeName,
        token_type: type_name_21.TypeName,
        deposit_amount: bcs.u64(),
        wlp_amount: bcs.u64(),
        fee_amount: bcs.u64(),
        /**
         * USD price per 1 WLP at this mint
         * (`net_deposit_usd / wlp_amount * 10^lp_decimal`). Avoids joining against
         * `snapshots_wlp_pool` for per-mint NAV.
         */
        share_price: double_3.Double,
        memo: bcs.string()
    } });
export const WlpRedeemRequested = new MoveStruct({ name: `${$moduleName}::WlpRedeemRequested`, fields: {
        account_object_address: bcs.Address,
        wlp_type: type_name_22.TypeName,
        token_type: type_name_23.TypeName,
        wlp_amount: bcs.u64(),
        request_id: bcs.u64(),
        memo: bcs.string()
    } });
export const WlpRedeemCancelled = new MoveStruct({ name: `${$moduleName}::WlpRedeemCancelled`, fields: {
        account_object_address: bcs.Address,
        wlp_type: type_name_24.TypeName,
        token_type: type_name_25.TypeName,
        request_id: bcs.u64(),
        wlp_amount: bcs.u64(),
        memo: bcs.string()
    } });
export const WlpRedeemRejected = new MoveStruct({ name: `${$moduleName}::WlpRedeemRejected`, fields: {
        account_object_address: bcs.Address,
        operator_address: bcs.Address,
        wlp_type: type_name_26.TypeName,
        token_type: type_name_27.TypeName,
        request_id: bcs.u64(),
        wlp_amount: bcs.u64(),
        memo: bcs.string()
    } });
export const WlpRedeemSettled = new MoveStruct({ name: `${$moduleName}::WlpRedeemSettled`, fields: {
        account_object_address: bcs.Address,
        wlp_type: type_name_28.TypeName,
        token_type: type_name_29.TypeName,
        request_id: bcs.u64(),
        redeem_amount: bcs.u64(),
        fee_amount: bcs.u64(),
        /**
         * USD price per 1 WLP at this redeem
         * (`gross_redeem_usd / wlp_amount * 10^lp_decimal`). Avoids joining against
         * `snapshots_wlp_pool` for per-redeem NAV.
         */
        share_price: double_4.Double,
        memo: bcs.string()
    } });
export const FundingRateUpdated = new MoveStruct({ name: `${$moduleName}::FundingRateUpdated`, fields: {
        market_id: bcs.Address,
        funding_rate: float_30.Float,
        /**
         * `true` when this period's funding has longs paying shorts; `false` when shorts
         * pay longs.
         */
        funding_rate_sign: bcs.bool(),
        cumulative_index: double_5.Double,
        /**
         * `true` when the cumulative funding index is on the "longs pay" side; `false`
         * when it's on the "shorts pay" side.
         */
        cumulative_funding_sign: bcs.bool(),
        long_oi: float_31.Float,
        short_oi: float_32.Float,
        memo: bcs.string()
    } });
export const BorrowRateUpdated = new MoveStruct({ name: `${$moduleName}::BorrowRateUpdated`, fields: {
        token_type: type_name_30.TypeName,
        borrow_rate: float_33.Float,
        cumulative_rate: float_34.Float,
        utilization_bps: bcs.u64(),
        memo: bcs.string()
    } });
export const MarketConfigUpdated = new MoveStruct({ name: `${$moduleName}::MarketConfigUpdated`, fields: {
        market_id: bcs.Address,
        is_paused: bcs.bool(),
        max_leverage_bps: bcs.u64(),
        min_coll_value: bcs.u64(),
        trading_fee: float_35.Float,
        max_impact_fee: float_36.Float,
        allocated_lp_exposure_bps: bcs.u64(),
        impact_fee_curvature: bcs.u64(),
        impact_fee_scale: bcs.u64(),
        maintenance_margin: float_37.Float,
        max_long_oi: float_38.Float,
        max_short_oi: float_39.Float,
        cooldown_ms: bcs.u64(),
        order_price_tick: float_40.Float,
        max_pre_orders: bcs.u64(),
        basic_funding_rate: float_41.Float,
        funding_interval_ms: bcs.u64(),
        request_checklist: bcs.vector(type_name_31.TypeName),
        position_locker: vec_set.VecSet(bcs.u64()),
        long_oi: float_42.Float,
        short_oi: float_43.Float,
        long_avg_entry_price: float_44.Float,
        short_avg_entry_price: float_45.Float,
        next_position_id: bcs.u64(),
        next_order_id: bcs.u64(),
        last_funding_timestamp: bcs.u64(),
        cumulative_funding_sign: bcs.bool(),
        cumulative_funding_index: double_6.Double,
        memo: bcs.string()
    } });
export const TokenPoolInfoUpdated = new MoveStruct({ name: `${$moduleName}::TokenPoolInfoUpdated`, fields: {
        token_type: type_name_32.TypeName,
        token_decimal: bcs.u8(),
        target_weight_bps: bcs.u64(),
        mint_fee_bps: bcs.u64(),
        burn_fee_bps: bcs.u64(),
        max_capacity: bcs.u64(),
        min_deposit: bcs.u64(),
        basic_borrow_rate_0: float_46.Float,
        basic_borrow_rate_1: float_47.Float,
        basic_borrow_rate_2: float_48.Float,
        utilization_threshold_0_bps: bcs.u64(),
        utilization_threshold_1_bps: bcs.u64(),
        borrow_interval_ms: bcs.u64(),
        max_reserve_ratio_bps: bcs.u64(),
        memo: bcs.string()
    } });
export interface EmitPositionOpenedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    leverageBps: RawTransactionArgument<number | bigint>;
    entryPrice: RawTransactionArgument<string>;
    openFeeAmount: RawTransactionArgument<number | bigint>;
    volumeUsd: RawTransactionArgument<string>;
    entryBorrowIndex: RawTransactionArgument<string>;
    entryFundingSign: RawTransactionArgument<boolean>;
    entryFundingIndex: RawTransactionArgument<string>;
    unrealizedBorrowFee: RawTransactionArgument<number | bigint>;
    unrealizedFundingSign: RawTransactionArgument<boolean>;
    unrealizedFundingFee: RawTransactionArgument<number | bigint>;
}
export interface EmitPositionOpenedOptions {
    package?: string;
    arguments: EmitPositionOpenedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        leverageBps: RawTransactionArgument<number | bigint>,
        entryPrice: RawTransactionArgument<string>,
        openFeeAmount: RawTransactionArgument<number | bigint>,
        volumeUsd: RawTransactionArgument<string>,
        entryBorrowIndex: RawTransactionArgument<string>,
        entryFundingSign: RawTransactionArgument<boolean>,
        entryFundingIndex: RawTransactionArgument<string>,
        unrealizedBorrowFee: RawTransactionArgument<number | bigint>,
        unrealizedFundingSign: RawTransactionArgument<boolean>,
        unrealizedFundingFee: RawTransactionArgument<number | bigint>
    ];
}
export function emitPositionOpened(options: EmitPositionOpenedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u64',
        '0x1::string::String',
        null,
        'bool',
        null,
        'u64',
        null,
        'u64',
        null,
        'u64',
        null,
        null,
        'bool',
        null,
        'u64',
        'bool',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "positionId", "symbol", "wlpType", "isLong", "size", "collateralAmount", "collateralType", "leverageBps", "entryPrice", "openFeeAmount", "volumeUsd", "entryBorrowIndex", "entryFundingSign", "entryFundingIndex", "unrealizedBorrowFee", "unrealizedFundingSign", "unrealizedFundingFee"];
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
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralType: RawTransactionArgument<string>;
    exitPrice: RawTransactionArgument<string>;
    pnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    closeFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeIsCost: RawTransactionArgument<boolean>;
    borrowFeeAmount: RawTransactionArgument<number | bigint>;
    volumeUsd: RawTransactionArgument<string>;
}
export interface EmitPositionClosedOptions {
    package?: string;
    arguments: EmitPositionClosedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralType: RawTransactionArgument<string>,
        exitPrice: RawTransactionArgument<string>,
        pnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        closeFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeIsCost: RawTransactionArgument<boolean>,
        borrowFeeAmount: RawTransactionArgument<number | bigint>,
        volumeUsd: RawTransactionArgument<string>
    ];
}
export function emitPositionClosed(options: EmitPositionClosedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u64',
        '0x1::string::String',
        null,
        'bool',
        null,
        null,
        null,
        'u64',
        'bool',
        'u64',
        'u64',
        'bool',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "positionId", "symbol", "wlpType", "isLong", "size", "collateralType", "exitPrice", "pnlAmount", "pnlIsProfit", "closeFeeAmount", "fundingFeeAmount", "fundingFeeIsCost", "borrowFeeAmount", "volumeUsd"];
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
    orderId: RawTransactionArgument<number | bigint>;
    positionId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    isIncrease: RawTransactionArgument<boolean>;
    deltaSize: RawTransactionArgument<string>;
    newSize: RawTransactionArgument<string>;
    isDeposit: RawTransactionArgument<boolean>;
    deltaCollateralAmount: RawTransactionArgument<number | bigint>;
    newCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
    realizedPnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    feeAmount: RawTransactionArgument<number | bigint>;
    closeFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeIsCost: RawTransactionArgument<boolean>;
    borrowFeeAmount: RawTransactionArgument<number | bigint>;
    volumeUsd: RawTransactionArgument<string>;
    entryBorrowIndex: RawTransactionArgument<string>;
    entryFundingSign: RawTransactionArgument<boolean>;
    entryFundingIndex: RawTransactionArgument<string>;
    unrealizedBorrowFee: RawTransactionArgument<number | bigint>;
    unrealizedFundingSign: RawTransactionArgument<boolean>;
    unrealizedFundingFee: RawTransactionArgument<number | bigint>;
}
export interface EmitPositionModifiedOptions {
    package?: string;
    arguments: EmitPositionModifiedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        positionId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        isIncrease: RawTransactionArgument<boolean>,
        deltaSize: RawTransactionArgument<string>,
        newSize: RawTransactionArgument<string>,
        isDeposit: RawTransactionArgument<boolean>,
        deltaCollateralAmount: RawTransactionArgument<number | bigint>,
        newCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>,
        realizedPnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        feeAmount: RawTransactionArgument<number | bigint>,
        closeFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeIsCost: RawTransactionArgument<boolean>,
        borrowFeeAmount: RawTransactionArgument<number | bigint>,
        volumeUsd: RawTransactionArgument<string>,
        entryBorrowIndex: RawTransactionArgument<string>,
        entryFundingSign: RawTransactionArgument<boolean>,
        entryFundingIndex: RawTransactionArgument<string>,
        unrealizedBorrowFee: RawTransactionArgument<number | bigint>,
        unrealizedFundingSign: RawTransactionArgument<boolean>,
        unrealizedFundingFee: RawTransactionArgument<number | bigint>
    ];
}
export function emitPositionModified(options: EmitPositionModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u64',
        '0x1::string::String',
        null,
        'bool',
        'bool',
        null,
        null,
        'bool',
        'u64',
        'u64',
        null,
        null,
        'u64',
        'bool',
        'u64',
        'u64',
        'u64',
        'bool',
        'u64',
        null,
        null,
        'bool',
        null,
        'u64',
        'bool',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "positionId", "symbol", "wlpType", "isLong", "isIncrease", "deltaSize", "newSize", "isDeposit", "deltaCollateralAmount", "newCollateralAmount", "collateralType", "executionPrice", "realizedPnlAmount", "pnlIsProfit", "feeAmount", "closeFeeAmount", "fundingFeeAmount", "fundingFeeIsCost", "borrowFeeAmount", "volumeUsd", "entryBorrowIndex", "entryFundingSign", "entryFundingIndex", "unrealizedBorrowFee", "unrealizedFundingSign", "unrealizedFundingFee"];
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
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    liquidatorFeeAmount: RawTransactionArgument<number | bigint>;
    insuranceFeeAmount: RawTransactionArgument<number | bigint>;
    lpPoolAmount: RawTransactionArgument<number | bigint>;
    fundingFeeAmount: RawTransactionArgument<number | bigint>;
    fundingFeeIsCost: RawTransactionArgument<boolean>;
    borrowFeeAmount: RawTransactionArgument<number | bigint>;
    markPrice: RawTransactionArgument<string>;
    volumeUsd: RawTransactionArgument<string>;
}
export interface EmitPositionLiquidatedOptions {
    package?: string;
    arguments: EmitPositionLiquidatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        liquidatorAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        liquidatorFeeAmount: RawTransactionArgument<number | bigint>,
        insuranceFeeAmount: RawTransactionArgument<number | bigint>,
        lpPoolAmount: RawTransactionArgument<number | bigint>,
        fundingFeeAmount: RawTransactionArgument<number | bigint>,
        fundingFeeIsCost: RawTransactionArgument<boolean>,
        borrowFeeAmount: RawTransactionArgument<number | bigint>,
        markPrice: RawTransactionArgument<string>,
        volumeUsd: RawTransactionArgument<string>
    ];
}
export function emitPositionLiquidated(options: EmitPositionLiquidatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'address',
        '0x2::object::ID',
        'u64',
        '0x1::string::String',
        null,
        'bool',
        null,
        'u64',
        null,
        'u64',
        'u64',
        'u64',
        'u64',
        'bool',
        'u64',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "liquidatorAddress", "marketId", "positionId", "symbol", "wlpType", "isLong", "size", "collateralAmount", "collateralType", "liquidatorFeeAmount", "insuranceFeeAmount", "lpPoolAmount", "fundingFeeAmount", "fundingFeeIsCost", "borrowFeeAmount", "markPrice", "volumeUsd"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_liquidated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPositionLinkedOrderModifiedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    linkedOrderPriceKey: RawTransactionArgument<number | bigint>;
    isAdded: RawTransactionArgument<boolean>;
}
export interface EmitPositionLinkedOrderModifiedOptions {
    package?: string;
    arguments: EmitPositionLinkedOrderModifiedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        linkedOrderPriceKey: RawTransactionArgument<number | bigint>,
        isAdded: RawTransactionArgument<boolean>
    ];
}
export function emitPositionLinkedOrderModified(options: EmitPositionLinkedOrderModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        '0x1::string::String',
        null,
        'u64',
        'u128',
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "positionId", "symbol", "wlpType", "orderId", "linkedOrderPriceKey", "isAdded"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_position_linked_order_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderCreatedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string | null>;
    collateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
}
export interface EmitOrderCreatedOptions {
    package?: string;
    arguments: EmitOrderCreatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string | null>,
        collateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>
    ];
}
export function emitOrderCreated(options: EmitOrderCreatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        '0x1::string::String',
        null,
        'u8',
        'bool',
        'bool',
        '0x1::option::Option<u64>',
        null,
        '0x1::option::Option<null>',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "symbol", "wlpType", "orderType", "isLong", "reduceOnly", "linkedPositionId", "size", "triggerPrice", "collateralAmount", "collateralType"];
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
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    withdrawalCollateralAmount: RawTransactionArgument<number | bigint>;
    collateralType: RawTransactionArgument<string>;
    memo: RawTransactionArgument<string>;
}
export interface EmitOrderCancelledOptions {
    package?: string;
    arguments: EmitOrderCancelledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        withdrawalCollateralAmount: RawTransactionArgument<number | bigint>,
        collateralType: RawTransactionArgument<string>,
        memo: RawTransactionArgument<string>
    ];
}
export function emitOrderCancelled(options: EmitOrderCancelledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        '0x1::string::String',
        null,
        'u64',
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "symbol", "wlpType", "withdrawalCollateralAmount", "collateralType", "memo"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderUpdatedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    linkedPositionId: RawTransactionArgument<number | bigint | null>;
    oldSize: RawTransactionArgument<string>;
    newSize: RawTransactionArgument<string>;
    oldTriggerPrice: RawTransactionArgument<string>;
    newTriggerPrice: RawTransactionArgument<string>;
}
export interface EmitOrderUpdatedOptions {
    package?: string;
    arguments: EmitOrderUpdatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        linkedPositionId: RawTransactionArgument<number | bigint | null>,
        oldSize: RawTransactionArgument<string>,
        newSize: RawTransactionArgument<string>,
        oldTriggerPrice: RawTransactionArgument<string>,
        newTriggerPrice: RawTransactionArgument<string>
    ];
}
export function emitOrderUpdated(options: EmitOrderUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        '0x1::string::String',
        null,
        'u8',
        'bool',
        'bool',
        '0x1::option::Option<u64>',
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "symbol", "wlpType", "orderType", "isLong", "reduceOnly", "linkedPositionId", "oldSize", "newSize", "oldTriggerPrice", "newTriggerPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitOrderFilledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    isIncrease: RawTransactionArgument<boolean>;
    reduceOnly: RawTransactionArgument<boolean>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    filledPrice: RawTransactionArgument<string>;
    filledSize: RawTransactionArgument<string>;
    feeAmount: RawTransactionArgument<number | bigint>;
    volumeUsd: RawTransactionArgument<string>;
    collateralType: RawTransactionArgument<string>;
    newSize: RawTransactionArgument<string>;
    newCollateralAmount: RawTransactionArgument<number | bigint>;
    entryBorrowIndex: RawTransactionArgument<string>;
    entryFundingSign: RawTransactionArgument<boolean>;
    entryFundingIndex: RawTransactionArgument<string>;
    unrealizedBorrowFee: RawTransactionArgument<number | bigint>;
    unrealizedFundingSign: RawTransactionArgument<boolean>;
    unrealizedFundingFee: RawTransactionArgument<number | bigint>;
}
export interface EmitOrderFilledOptions {
    package?: string;
    arguments: EmitOrderFilledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        isIncrease: RawTransactionArgument<boolean>,
        reduceOnly: RawTransactionArgument<boolean>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        filledPrice: RawTransactionArgument<string>,
        filledSize: RawTransactionArgument<string>,
        feeAmount: RawTransactionArgument<number | bigint>,
        volumeUsd: RawTransactionArgument<string>,
        collateralType: RawTransactionArgument<string>,
        newSize: RawTransactionArgument<string>,
        newCollateralAmount: RawTransactionArgument<number | bigint>,
        entryBorrowIndex: RawTransactionArgument<string>,
        entryFundingSign: RawTransactionArgument<boolean>,
        entryFundingIndex: RawTransactionArgument<string>,
        unrealizedBorrowFee: RawTransactionArgument<number | bigint>,
        unrealizedFundingSign: RawTransactionArgument<boolean>,
        unrealizedFundingFee: RawTransactionArgument<number | bigint>
    ];
}
export function emitOrderFilled(options: EmitOrderFilledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u8',
        'bool',
        'bool',
        'bool',
        '0x1::string::String',
        null,
        'u64',
        null,
        null,
        'u64',
        null,
        null,
        null,
        'u64',
        null,
        'bool',
        null,
        'u64',
        'bool',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "orderId", "orderType", "isLong", "isIncrease", "reduceOnly", "symbol", "wlpType", "positionId", "filledPrice", "filledSize", "feeAmount", "volumeUsd", "collateralType", "newSize", "newCollateralAmount", "entryBorrowIndex", "entryFundingSign", "entryFundingIndex", "unrealizedBorrowFee", "unrealizedFundingSign", "unrealizedFundingFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_order_filled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPreOrderCreatedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    preOrderId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
}
export interface EmitPreOrderCreatedOptions {
    package?: string;
    arguments: EmitPreOrderCreatedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        preOrderId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>
    ];
}
export function emitPreOrderCreated(options: EmitPreOrderCreatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u64',
        '0x1::string::String',
        null,
        'u8',
        'bool',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "mainOrderId", "preOrderId", "symbol", "wlpType", "orderType", "isLong", "size", "triggerPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_pre_order_created',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitPreOrderCancelledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    mainOrderId: RawTransactionArgument<number | bigint>;
    preOrderId: RawTransactionArgument<number | bigint>;
    symbol: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    orderType: RawTransactionArgument<number>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    triggerPrice: RawTransactionArgument<string>;
}
export interface EmitPreOrderCancelledOptions {
    package?: string;
    arguments: EmitPreOrderCancelledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        mainOrderId: RawTransactionArgument<number | bigint>,
        preOrderId: RawTransactionArgument<number | bigint>,
        symbol: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        orderType: RawTransactionArgument<number>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        triggerPrice: RawTransactionArgument<string>
    ];
}
export function emitPreOrderCancelled(options: EmitPreOrderCancelledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        '0x2::object::ID',
        'u64',
        'u64',
        '0x1::string::String',
        null,
        'u8',
        'bool',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "marketId", "mainOrderId", "preOrderId", "symbol", "wlpType", "orderType", "isLong", "size", "triggerPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_pre_order_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitProtocolFeeCollectedArguments {
    amount: RawTransactionArgument<number | bigint>;
    marketId: RawTransactionArgument<string>;
}
export interface EmitProtocolFeeCollectedOptions {
    package?: string;
    arguments: EmitProtocolFeeCollectedArguments | [
        amount: RawTransactionArgument<number | bigint>,
        marketId: RawTransactionArgument<string>
    ];
}
export function emitProtocolFeeCollected(options: EmitProtocolFeeCollectedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["amount", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_protocol_fee_collected',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpEquityChangedArguments {
    marketTicker: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    isProfit: RawTransactionArgument<boolean>;
    memo: RawTransactionArgument<string>;
}
export interface EmitWlpEquityChangedOptions {
    package?: string;
    arguments: EmitWlpEquityChangedArguments | [
        marketTicker: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        isProfit: RawTransactionArgument<boolean>,
        memo: RawTransactionArgument<string>
    ];
}
export function emitWlpEquityChanged(options: EmitWlpEquityChangedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x1::string::String',
        null,
        null,
        'u64',
        'bool',
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["marketTicker", "wlpType", "tokenType", "amount", "isProfit", "memo"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_equity_changed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpMintedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    depositAmount: RawTransactionArgument<number | bigint>;
    wlpAmount: RawTransactionArgument<number | bigint>;
    feeAmount: RawTransactionArgument<number | bigint>;
    sharePrice: RawTransactionArgument<string>;
}
export interface EmitWlpMintedOptions {
    package?: string;
    arguments: EmitWlpMintedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        depositAmount: RawTransactionArgument<number | bigint>,
        wlpAmount: RawTransactionArgument<number | bigint>,
        feeAmount: RawTransactionArgument<number | bigint>,
        sharePrice: RawTransactionArgument<string>
    ];
}
export function emitWlpMinted(options: EmitWlpMintedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "wlpType", "tokenType", "depositAmount", "wlpAmount", "feeAmount", "sharePrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_minted',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemRequestedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    wlpAmount: RawTransactionArgument<number | bigint>;
    requestId: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemRequestedOptions {
    package?: string;
    arguments: EmitWlpRedeemRequestedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        wlpAmount: RawTransactionArgument<number | bigint>,
        requestId: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemRequested(options: EmitWlpRedeemRequestedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "wlpType", "tokenType", "wlpAmount", "requestId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_requested',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemCancelledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    wlpAmount: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemCancelledOptions {
    package?: string;
    arguments: EmitWlpRedeemCancelledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        wlpAmount: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemCancelled(options: EmitWlpRedeemCancelledOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "wlpType", "tokenType", "requestId", "wlpAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_cancelled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemRejectedArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    operatorAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    wlpAmount: RawTransactionArgument<number | bigint>;
}
export interface EmitWlpRedeemRejectedOptions {
    package?: string;
    arguments: EmitWlpRedeemRejectedArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        operatorAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        wlpAmount: RawTransactionArgument<number | bigint>
    ];
}
export function emitWlpRedeemRejected(options: EmitWlpRedeemRejectedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'address',
        'address',
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "operatorAddress", "wlpType", "tokenType", "requestId", "wlpAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_wlp_redeem_rejected',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitWlpRedeemSettledArguments {
    accountObjectAddress: RawTransactionArgument<string>;
    wlpType: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    redeemAmount: RawTransactionArgument<number | bigint>;
    feeAmount: RawTransactionArgument<number | bigint>;
    sharePrice: RawTransactionArgument<string>;
}
export interface EmitWlpRedeemSettledOptions {
    package?: string;
    arguments: EmitWlpRedeemSettledArguments | [
        accountObjectAddress: RawTransactionArgument<string>,
        wlpType: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        redeemAmount: RawTransactionArgument<number | bigint>,
        feeAmount: RawTransactionArgument<number | bigint>,
        sharePrice: RawTransactionArgument<string>
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
        null
    ] satisfies (string | null)[];
    const parameterNames = ["accountObjectAddress", "wlpType", "tokenType", "requestId", "redeemAmount", "feeAmount", "sharePrice"];
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
    fundingRateSign: RawTransactionArgument<boolean>;
    cumulativeIndex: RawTransactionArgument<string>;
    cumulativeFundingSign: RawTransactionArgument<boolean>;
    longOi: RawTransactionArgument<string>;
    shortOi: RawTransactionArgument<string>;
}
export interface EmitFundingRateUpdatedOptions {
    package?: string;
    arguments: EmitFundingRateUpdatedArguments | [
        marketId: RawTransactionArgument<string>,
        fundingRate: RawTransactionArgument<string>,
        fundingRateSign: RawTransactionArgument<boolean>,
        cumulativeIndex: RawTransactionArgument<string>,
        cumulativeFundingSign: RawTransactionArgument<boolean>,
        longOi: RawTransactionArgument<string>,
        shortOi: RawTransactionArgument<string>
    ];
}
export function emitFundingRateUpdated(options: EmitFundingRateUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        null,
        'bool',
        null,
        'bool',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "fundingRate", "fundingRateSign", "cumulativeIndex", "cumulativeFundingSign", "longOi", "shortOi"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_funding_rate_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitBorrowRateUpdatedArguments {
    tokenType: RawTransactionArgument<string>;
    borrowRate: RawTransactionArgument<string>;
    cumulativeRate: RawTransactionArgument<string>;
    utilizationBps: RawTransactionArgument<number | bigint>;
}
export interface EmitBorrowRateUpdatedOptions {
    package?: string;
    arguments: EmitBorrowRateUpdatedArguments | [
        tokenType: RawTransactionArgument<string>,
        borrowRate: RawTransactionArgument<string>,
        cumulativeRate: RawTransactionArgument<string>,
        utilizationBps: RawTransactionArgument<number | bigint>
    ];
}
export function emitBorrowRateUpdated(options: EmitBorrowRateUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["tokenType", "borrowRate", "cumulativeRate", "utilizationBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_borrow_rate_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitMarketConfigUpdatedArguments {
    marketId: RawTransactionArgument<string>;
    isPaused: RawTransactionArgument<boolean>;
    maxLeverageBps: RawTransactionArgument<number | bigint>;
    minCollValue: RawTransactionArgument<number | bigint>;
    tradingFee: RawTransactionArgument<string>;
    maxImpactFee: RawTransactionArgument<string>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint>;
    impactFeeCurvature: RawTransactionArgument<number | bigint>;
    impactFeeScale: RawTransactionArgument<number | bigint>;
    maintenanceMargin: RawTransactionArgument<string>;
    maxLongOi: RawTransactionArgument<string>;
    maxShortOi: RawTransactionArgument<string>;
    cooldownMs: RawTransactionArgument<number | bigint>;
    orderPriceTick: RawTransactionArgument<string>;
    maxPreOrders: RawTransactionArgument<number | bigint>;
    basicFundingRate: RawTransactionArgument<string>;
    fundingIntervalMs: RawTransactionArgument<number | bigint>;
    requestChecklist: RawTransactionArgument<string[]>;
    positionLocker: RawTransactionArgument<string>;
    longOi: RawTransactionArgument<string>;
    shortOi: RawTransactionArgument<string>;
    longAvgEntryPrice: RawTransactionArgument<string>;
    shortAvgEntryPrice: RawTransactionArgument<string>;
    nextPositionId: RawTransactionArgument<number | bigint>;
    nextOrderId: RawTransactionArgument<number | bigint>;
    lastFundingTimestamp: RawTransactionArgument<number | bigint>;
    cumulativeFundingSign: RawTransactionArgument<boolean>;
    cumulativeFundingIndex: RawTransactionArgument<string>;
}
export interface EmitMarketConfigUpdatedOptions {
    package?: string;
    arguments: EmitMarketConfigUpdatedArguments | [
        marketId: RawTransactionArgument<string>,
        isPaused: RawTransactionArgument<boolean>,
        maxLeverageBps: RawTransactionArgument<number | bigint>,
        minCollValue: RawTransactionArgument<number | bigint>,
        tradingFee: RawTransactionArgument<string>,
        maxImpactFee: RawTransactionArgument<string>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint>,
        impactFeeCurvature: RawTransactionArgument<number | bigint>,
        impactFeeScale: RawTransactionArgument<number | bigint>,
        maintenanceMargin: RawTransactionArgument<string>,
        maxLongOi: RawTransactionArgument<string>,
        maxShortOi: RawTransactionArgument<string>,
        cooldownMs: RawTransactionArgument<number | bigint>,
        orderPriceTick: RawTransactionArgument<string>,
        maxPreOrders: RawTransactionArgument<number | bigint>,
        basicFundingRate: RawTransactionArgument<string>,
        fundingIntervalMs: RawTransactionArgument<number | bigint>,
        requestChecklist: RawTransactionArgument<string[]>,
        positionLocker: RawTransactionArgument<string>,
        longOi: RawTransactionArgument<string>,
        shortOi: RawTransactionArgument<string>,
        longAvgEntryPrice: RawTransactionArgument<string>,
        shortAvgEntryPrice: RawTransactionArgument<string>,
        nextPositionId: RawTransactionArgument<number | bigint>,
        nextOrderId: RawTransactionArgument<number | bigint>,
        lastFundingTimestamp: RawTransactionArgument<number | bigint>,
        cumulativeFundingSign: RawTransactionArgument<boolean>,
        cumulativeFundingIndex: RawTransactionArgument<string>
    ];
}
export function emitMarketConfigUpdated(options: EmitMarketConfigUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        'bool',
        'u64',
        'u64',
        null,
        null,
        'u64',
        'u64',
        'u64',
        null,
        null,
        null,
        'u64',
        null,
        'u64',
        null,
        'u64',
        'vector<null>',
        null,
        null,
        null,
        null,
        null,
        'u64',
        'u64',
        'u64',
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "isPaused", "maxLeverageBps", "minCollValue", "tradingFee", "maxImpactFee", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale", "maintenanceMargin", "maxLongOi", "maxShortOi", "cooldownMs", "orderPriceTick", "maxPreOrders", "basicFundingRate", "fundingIntervalMs", "requestChecklist", "positionLocker", "longOi", "shortOi", "longAvgEntryPrice", "shortAvgEntryPrice", "nextPositionId", "nextOrderId", "lastFundingTimestamp", "cumulativeFundingSign", "cumulativeFundingIndex"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_market_config_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmitTokenPoolInfoUpdatedArguments {
    tokenType: RawTransactionArgument<string>;
    tokenDecimal: RawTransactionArgument<number>;
    targetWeightBps: RawTransactionArgument<number | bigint>;
    mintFeeBps: RawTransactionArgument<number | bigint>;
    burnFeeBps: RawTransactionArgument<number | bigint>;
    maxCapacity: RawTransactionArgument<number | bigint>;
    minDeposit: RawTransactionArgument<number | bigint>;
    basicBorrowRate_0: RawTransactionArgument<string>;
    basicBorrowRate_1: RawTransactionArgument<string>;
    basicBorrowRate_2: RawTransactionArgument<string>;
    utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>;
    utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>;
    borrowIntervalMs: RawTransactionArgument<number | bigint>;
    maxReserveRatioBps: RawTransactionArgument<number | bigint>;
}
export interface EmitTokenPoolInfoUpdatedOptions {
    package?: string;
    arguments: EmitTokenPoolInfoUpdatedArguments | [
        tokenType: RawTransactionArgument<string>,
        tokenDecimal: RawTransactionArgument<number>,
        targetWeightBps: RawTransactionArgument<number | bigint>,
        mintFeeBps: RawTransactionArgument<number | bigint>,
        burnFeeBps: RawTransactionArgument<number | bigint>,
        maxCapacity: RawTransactionArgument<number | bigint>,
        minDeposit: RawTransactionArgument<number | bigint>,
        basicBorrowRate_0: RawTransactionArgument<string>,
        basicBorrowRate_1: RawTransactionArgument<string>,
        basicBorrowRate_2: RawTransactionArgument<string>,
        utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>,
        utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>,
        borrowIntervalMs: RawTransactionArgument<number | bigint>,
        maxReserveRatioBps: RawTransactionArgument<number | bigint>
    ];
}
export function emitTokenPoolInfoUpdated(options: EmitTokenPoolInfoUpdatedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        null,
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["tokenType", "tokenDecimal", "targetWeightBps", "mintFeeBps", "burnFeeBps", "maxCapacity", "minDeposit", "basicBorrowRate_0", "basicBorrowRate_1", "basicBorrowRate_2", "utilizationThreshold_0Bps", "utilizationThreshold_1Bps", "borrowIntervalMs", "maxReserveRatioBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'events',
        function: 'emit_token_pool_info_updated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
