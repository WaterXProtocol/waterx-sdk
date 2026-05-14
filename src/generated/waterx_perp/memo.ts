/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Standard event memo strings for WaterX Perp events. */

import { type Transaction } from '@mysten/sui/transactions';
import { normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
export interface PositionOpenedOptions {
    package?: string;
    arguments?: [
    ];
}
export function positionOpened(options: PositionOpenedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_opened',
    });
}
export interface PositionClosedOptions {
    package?: string;
    arguments?: [
    ];
}
export function positionClosed(options: PositionClosedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_closed',
    });
}
export interface PositionModifiedArguments {
    isIncrease: RawTransactionArgument<boolean>;
}
export interface PositionModifiedOptions {
    package?: string;
    arguments: PositionModifiedArguments | [
        isIncrease: RawTransactionArgument<boolean>
    ];
}
export function positionModified(options: PositionModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["isIncrease"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionLiquidatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function positionLiquidated(options: PositionLiquidatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_liquidated',
    });
}
export interface CollateralModifiedArguments {
    isIncrease: RawTransactionArgument<boolean>;
}
export interface CollateralModifiedOptions {
    package?: string;
    arguments: CollateralModifiedArguments | [
        isIncrease: RawTransactionArgument<boolean>
    ];
}
export function collateralModified(options: CollateralModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["isIncrease"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'collateral_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionLinkedOrderModifiedArguments {
    isAdded: RawTransactionArgument<boolean>;
}
export interface PositionLinkedOrderModifiedOptions {
    package?: string;
    arguments: PositionLinkedOrderModifiedArguments | [
        isAdded: RawTransactionArgument<boolean>
    ];
}
export function positionLinkedOrderModified(options: PositionLinkedOrderModifiedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["isAdded"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_linked_order_modified',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderCreatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCreated(options: OrderCreatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_created',
    });
}
export interface OrderFilledOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderFilled(options: OrderFilledOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_filled',
    });
}
export interface OrderUpdatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderUpdated(options: OrderUpdatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_updated',
    });
}
export interface PreOrderCreatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function preOrderCreated(options: PreOrderCreatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'pre_order_created',
    });
}
export interface PreOrderCancelledOptions {
    package?: string;
    arguments?: [
    ];
}
export function preOrderCancelled(options: PreOrderCancelledOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'pre_order_cancelled',
    });
}
export interface OrderCancelledByUserOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCancelledByUser(options: OrderCancelledByUserOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_by_user',
    });
}
export interface OrderCancelledMissingLinkedPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCancelledMissingLinkedPosition(options: OrderCancelledMissingLinkedPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_missing_linked_position',
    });
}
export interface OrderCancelledTooManyFailedMatchesOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCancelledTooManyFailedMatches(options: OrderCancelledTooManyFailedMatchesOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_too_many_failed_matches',
    });
}
export interface OrderCancelledInvalidMatchOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * `match_orders` linked-reduce blocked: the order's linked position is on the same
 * side (reduce-only can't grow), or a partial reduce would leave the position with
 * a deficit / collateral below `min_coll_value`. Either way the order can never
 * fill against the current position state.
 */
export function orderCancelledInvalidMatch(options: OrderCancelledInvalidMatchOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_invalid_match',
    });
}
export interface OrderCancelledSlippageExceededOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * `place_order` market-order shortcut: oracle price is on the wrong side of the
 * caller-supplied `acceptable_price`. Cancel instead of aborting so the caller's
 * PTB still settles (collateral returns to the wxa account).
 */
export function orderCancelledSlippageExceeded(options: OrderCancelledSlippageExceededOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_slippage_exceeded',
    });
}
export interface OrderCancelledPositionClosedOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCancelledPositionClosed(options: OrderCancelledPositionClosedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_position_closed',
    });
}
export interface OrderCancelledPositionLiquidatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function orderCancelledPositionLiquidated(options: OrderCancelledPositionLiquidatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_position_liquidated',
    });
}
export interface PositionClosedCodeOptions {
    package?: string;
    arguments?: [
    ];
}
export function positionClosedCode(options: PositionClosedCodeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_closed_code',
    });
}
export interface PositionLiquidatedCodeOptions {
    package?: string;
    arguments?: [
    ];
}
export function positionLiquidatedCode(options: PositionLiquidatedCodeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'position_liquidated_code',
    });
}
export interface OrderCancelledFromCodeArguments {
    code: RawTransactionArgument<number>;
}
export interface OrderCancelledFromCodeOptions {
    package?: string;
    arguments: OrderCancelledFromCodeArguments | [
        code: RawTransactionArgument<number>
    ];
}
export function orderCancelledFromCode(options: OrderCancelledFromCodeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["code"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'order_cancelled_from_code',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProtocolFeeCollectedOptions {
    package?: string;
    arguments?: [
    ];
}
export function protocolFeeCollected(options: ProtocolFeeCollectedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'protocol_fee_collected',
    });
}
export interface WlpEquityFeeOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpEquityFee(options: WlpEquityFeeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_equity_fee',
    });
}
export interface WlpEquityWinOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * LP-wins side of a position close: trader's realized loss paid into the pool as
 * LP equity (is_profit = true).
 */
export function wlpEquityWin(options: WlpEquityWinOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_equity_win',
    });
}
export interface WlpEquityLossOptions {
    package?: string;
    arguments?: [
    ];
}
/**
 * LP-loses side: trader's realized profit paid out of the pool (is_profit =
 * false).
 */
export function wlpEquityLoss(options: WlpEquityLossOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_equity_loss',
    });
}
export interface WlpEquityLeftoverOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpEquityLeftover(options: WlpEquityLeftoverOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_equity_leftover',
    });
}
export interface WlpMintedOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpMinted(options: WlpMintedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_minted',
    });
}
export interface WlpRedeemRequestedOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpRedeemRequested(options: WlpRedeemRequestedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_redeem_requested',
    });
}
export interface WlpRedeemCancelledOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpRedeemCancelled(options: WlpRedeemCancelledOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_redeem_cancelled',
    });
}
export interface WlpRedeemRejectedOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpRedeemRejected(options: WlpRedeemRejectedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_redeem_rejected',
    });
}
export interface WlpRedeemSettledOptions {
    package?: string;
    arguments?: [
    ];
}
export function wlpRedeemSettled(options: WlpRedeemSettledOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'wlp_redeem_settled',
    });
}
export interface FundingRateUpdatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function fundingRateUpdated(options: FundingRateUpdatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'funding_rate_updated',
    });
}
export interface BorrowRateUpdatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function borrowRateUpdated(options: BorrowRateUpdatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'borrow_rate_updated',
    });
}
export interface MarketConfigUpdatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function marketConfigUpdated(options: MarketConfigUpdatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'market_config_updated',
    });
}
export interface TokenPoolInfoUpdatedOptions {
    package?: string;
    arguments?: [
    ];
}
export function tokenPoolInfoUpdated(options: TokenPoolInfoUpdatedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'memo',
        function: 'token_pool_info_updated',
    });
}