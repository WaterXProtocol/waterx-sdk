/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as position from './position.ts';
import * as outcome from './outcome.ts';
const $moduleName = '@waterx/prediction::events';
export const KeeperAdded = new MoveStruct({ name: `${$moduleName}::KeeperAdded`, fields: {
        global_config_id: bcs.Address,
        keeper: bcs.Address
    } });
export const KeeperRemoved = new MoveStruct({ name: `${$moduleName}::KeeperRemoved`, fields: {
        global_config_id: bcs.Address,
        keeper: bcs.Address
    } });
export const MarketCreated = new MoveStruct({ name: `${$moduleName}::MarketCreated`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        by_admin: bcs.bool(),
        event_ts: bcs.u64()
    } });
export const OrderPlaced = new MoveStruct({ name: `${$moduleName}::OrderPlaced`, fields: {
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
export const OrderFilled = new MoveStruct({ name: `${$moduleName}::OrderFilled`, fields: {
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
export const OrderCancelled = new MoveStruct({ name: `${$moduleName}::OrderCancelled`, fields: {
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
export const MarketResolved = new MoveStruct({ name: `${$moduleName}::MarketResolved`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        outcome: outcome.Outcome,
        unclaimed_count: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const MarketResolvedByOracle = new MoveStruct({ name: `${$moduleName}::MarketResolvedByOracle`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        outcome: outcome.Outcome,
        settle_ticker: bcs.string(),
        settle_timestamp_ms: bcs.u64(),
        price: bcs.u128(),
        threshold: bcs.u128(),
        comparison: bcs.u8(),
        unclaimed_count: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const PriceSettlementSet = new MoveStruct({ name: `${$moduleName}::PriceSettlementSet`, fields: {
        market_registry_id: bcs.Address,
        market_id: bcs.vector(bcs.u8()),
        settle_ticker: bcs.string(),
        settle_timestamp_ms: bcs.u64(),
        threshold: bcs.u128(),
        comparison: bcs.u8(),
        event_ts: bcs.u64()
    } });
export const PositionClaimed = new MoveStruct({ name: `${$moduleName}::PositionClaimed`, fields: {
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
export const PositionTransferred = new MoveStruct({ name: `${$moduleName}::PositionTransferred`, fields: {
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
export const PositionSplit = new MoveStruct({ name: `${$moduleName}::PositionSplit`, fields: {
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
export const CloseRequested = new MoveStruct({ name: `${$moduleName}::CloseRequested`, fields: {
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
export const PartialCloseRequested = new MoveStruct({ name: `${$moduleName}::PartialCloseRequested`, fields: {
        market_registry_id: bcs.Address,
        source_position_id: bcs.u64(),
        new_position_id: bcs.u64(),
        close_order_id: bcs.u64(),
        account_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        close_shares: bcs.u64(),
        close_cost: bcs.u64(),
        remaining_shares: bcs.u64(),
        remaining_cost: bcs.u64(),
        min_proceeds: bcs.u64(),
        expiry_ts: bcs.u64(),
        event_ts: bcs.u64()
    } });
export const CloseConfirmed = new MoveStruct({ name: `${$moduleName}::CloseConfirmed`, fields: {
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
export const CloseCancelled = new MoveStruct({ name: `${$moduleName}::CloseCancelled`, fields: {
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
export const MarketPaused = new MoveStruct({ name: `${$moduleName}::MarketPaused`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8())
    } });
export const MarketUnpaused = new MoveStruct({ name: `${$moduleName}::MarketUnpaused`, fields: {
        market_registry_id: bcs.Address,
        market_key: bcs.u64(),
        market_id: bcs.vector(bcs.u8())
    } });
export const MarketRegistryWithdrawn = new MoveStruct({ name: `${$moduleName}::MarketRegistryWithdrawn`, fields: {
        market_registry_id: bcs.Address,
        amount: bcs.u64(),
        recipient: bcs.Address,
        new_balance: bcs.u64()
    } });
export const MinReserveUpdated = new MoveStruct({ name: `${$moduleName}::MinReserveUpdated`, fields: {
        market_registry_id: bcs.Address,
        old_reserve: bcs.u64(),
        new_reserve: bcs.u64()
    } });
export const OrderCancelCooldownUpdated = new MoveStruct({ name: `${$moduleName}::OrderCancelCooldownUpdated`, fields: {
        market_registry_id: bcs.Address,
        old_cooldown_ms: bcs.u64(),
        new_cooldown_ms: bcs.u64()
    } });