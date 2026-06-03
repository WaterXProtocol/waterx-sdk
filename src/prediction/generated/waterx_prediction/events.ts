/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as position from './position.ts';
import * as outcome from './outcome.ts';
const $moduleName = '@waterx/prediction::events';
export const KeeperAdded: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::KeeperAdded`, fields: {
        global_config_id: bcs.Address,
        keeper: bcs.Address
    } });
export const KeeperRemoved: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::KeeperRemoved`, fields: {
        global_config_id: bcs.Address,
        keeper: bcs.Address
    } });
export const MarketCreated: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketCreated`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        by_admin: bcs.bool(),
        event_ts: bcs.u64()
    } });
export const OrderPlaced: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::OrderPlaced`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        /** Funding/refund account for the pending order. */
        account_id: bcs.Address,
        /** Account that receives the position after fill. */
        receiver_account_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        max_spend: bcs.u64(),
        min_shares: bcs.u64(),
        price_cap: bcs.u64(),
        expiry_ts: bcs.u64(),
        self_cancel_after_ts: bcs.u64(),
        created_ts: bcs.u64(),
        /** True if this order was placed by an admin (Track A campaign etc.). */
        by_admin: bcs.bool(),
        event_ts: bcs.u64()
    } });
export const OrderFilled: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::OrderFilled`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        account_id: bcs.Address,
        position_id: bcs.u64(),
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const OrderCancelled: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::OrderCancelled`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        account_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        refund_amount: bcs.u64(),
        by_self: bcs.bool(),
        event_ts: bcs.u64()
    } });
export const MarketResolved: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketResolved`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        outcome: outcome.Outcome,
        unclaimed_count: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const PositionClaimed: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::PositionClaimed`, fields: {
        market_registry_id: bcs.Address,
        account_id: bcs.Address,
        position_id: bcs.u64(),
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        outcome: outcome.Outcome,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        payout: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const PositionTransferred: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::PositionTransferred`, fields: {
        market_registry_id: bcs.Address,
        position_id: bcs.u64(),
        from_account_id: bcs.Address,
        to_account_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const PositionSplit: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::PositionSplit`, fields: {
        market_registry_id: bcs.Address,
        source_position_id: bcs.u64(),
        split_position_id: bcs.u64(),
        from_account_id: bcs.Address,
        to_account_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        split_shares: bcs.u64(),
        split_cost: bcs.u64(),
        remaining_shares: bcs.u64(),
        remaining_cost: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const CloseRequested: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::CloseRequested`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        account_id: bcs.Address,
        position_id: bcs.u64(),
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        min_proceeds: bcs.u64(),
        expiry_ts: bcs.u64(),
        self_cancel_after_ts: bcs.u64(),
        created_ts: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const CloseConfirmed: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::CloseConfirmed`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        account_id: bcs.Address,
        position_id: bcs.u64(),
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        proceeds: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const CloseCancelled: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::CloseCancelled`, fields: {
        market_registry_id: bcs.Address,
        order_id: bcs.u64(),
        account_id: bcs.Address,
        position_id: bcs.u64(),
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        /** True if the user initiated the cancel via self_cancel_close. */
        by_self: bcs.bool(),
        event_ts: bcs.u64()
    } });
export const MarketPaused: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketPaused`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8())
    } });
export const MarketUnpaused: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketUnpaused`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8())
    } });
export const MarketRegistryWithdrawn: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketRegistryWithdrawn`, fields: {
        market_registry_id: bcs.Address,
        amount: bcs.u64(),
        recipient: bcs.Address,
        new_balance: bcs.u64()
    } });
export const MinReserveUpdated: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MinReserveUpdated`, fields: {
        market_registry_id: bcs.Address,
        old_reserve: bcs.u64(),
        new_reserve: bcs.u64()
    } });
export const OrderCancelCooldownUpdated: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::OrderCancelCooldownUpdated`, fields: {
        market_registry_id: bcs.Address,
        old_cooldown_ms: bcs.u64(),
        new_cooldown_ms: bcs.u64()
    } });