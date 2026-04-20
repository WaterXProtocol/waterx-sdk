/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Error codes for the WaterX Perpetual Protocol. All errors use the pattern: const
 * EXXX: u64 = N; public(package) fun err_xxx() { abort EXXX }
 */

import { type Transaction } from '@mysten/sui/transactions';
export interface ErrMarketNotActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function errMarketNotActive(options: ErrMarketNotActiveOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_market_not_active',
    });
}
export interface ErrSymbolAlreadyExistsOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSymbolAlreadyExists(options: ErrSymbolAlreadyExistsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_symbol_already_exists',
    });
}
export interface ErrSymbolNotExistsOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSymbolNotExists(options: ErrSymbolNotExistsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_symbol_not_exists',
    });
}
export interface ErrSymbolNotActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSymbolNotActive(options: ErrSymbolNotActiveOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_symbol_not_active',
    });
}
export interface ErrExceedMaxLeverageOptions {
    package?: string;
    arguments?: [
    ];
}
export function errExceedMaxLeverage(options: ErrExceedMaxLeverageOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_exceed_max_leverage',
    });
}
export interface ErrExceedMaxOpenInterestOptions {
    package?: string;
    arguments?: [
    ];
}
export function errExceedMaxOpenInterest(options: ErrExceedMaxOpenInterestOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_exceed_max_open_interest',
    });
}
export interface ErrInvalidConfigOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidConfig(options: ErrInvalidConfigOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_config',
    });
}
export interface ErrPositionNotFoundOptions {
    package?: string;
    arguments?: [
    ];
}
export function errPositionNotFound(options: ErrPositionNotFoundOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_position_not_found',
    });
}
export interface ErrInvalidSizeOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidSize(options: ErrInvalidSizeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_size',
    });
}
export interface ErrInsufficientCollateralOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInsufficientCollateral(options: ErrInsufficientCollateralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_insufficient_collateral',
    });
}
export interface ErrPositionNotLiquidatableOptions {
    package?: string;
    arguments?: [
    ];
}
export function errPositionNotLiquidatable(options: ErrPositionNotLiquidatableOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_position_not_liquidatable',
    });
}
export interface ErrTooManyLinkedOrdersOptions {
    package?: string;
    arguments?: [
    ];
}
export function errTooManyLinkedOrders(options: ErrTooManyLinkedOrdersOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_too_many_linked_orders',
    });
}
export interface ErrUserMismatchOptions {
    package?: string;
    arguments?: [
    ];
}
export function errUserMismatch(options: ErrUserMismatchOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_user_mismatch',
    });
}
export interface ErrCooldownNotElapsedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errCooldownNotElapsed(options: ErrCooldownNotElapsedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_cooldown_not_elapsed',
    });
}
export interface ErrPositionFlipNotSupportedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errPositionFlipNotSupported(options: ErrPositionFlipNotSupportedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_position_flip_not_supported',
    });
}
export interface ErrInvalidCollateralTypeOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidCollateralType(options: ErrInvalidCollateralTypeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_collateral_type',
    });
}
export interface ErrOrderNotFoundOptions {
    package?: string;
    arguments?: [
    ];
}
export function errOrderNotFound(options: ErrOrderNotFoundOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_order_not_found',
    });
}
export interface ErrInvalidOrderTypeOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidOrderType(options: ErrInvalidOrderTypeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_order_type',
    });
}
export interface ErrInvalidTriggerPriceOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidTriggerPrice(options: ErrInvalidTriggerPriceOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_trigger_price',
    });
}
export interface ErrReduceOnlyRequiresPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function errReduceOnlyRequiresPosition(options: ErrReduceOnlyRequiresPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_reduce_only_requires_position',
    });
}
export interface ErrInvalidLinkedOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidLinkedOrder(options: ErrInvalidLinkedOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_linked_order',
    });
}
export interface ErrPoolNotActiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function errPoolNotActive(options: ErrPoolNotActiveOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_pool_not_active',
    });
}
export interface ErrTokenNotSupportedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errTokenNotSupported(options: ErrTokenNotSupportedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_token_not_supported',
    });
}
export interface ErrTokenAlreadySupportedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errTokenAlreadySupported(options: ErrTokenAlreadySupportedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_token_already_supported',
    });
}
export interface ErrInsufficientLiquidityOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInsufficientLiquidity(options: ErrInsufficientLiquidityOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_insufficient_liquidity',
    });
}
export interface ErrExceedCapacityOptions {
    package?: string;
    arguments?: [
    ];
}
export function errExceedCapacity(options: ErrExceedCapacityOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_exceed_capacity',
    });
}
export interface ErrSlippageExceededOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSlippageExceeded(options: ErrSlippageExceededOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_slippage_exceeded',
    });
}
export interface ErrInsufficientDepositOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInsufficientDeposit(options: ErrInsufficientDepositOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_insufficient_deposit',
    });
}
export interface ErrRedeemNotReadyOptions {
    package?: string;
    arguments?: [
    ];
}
export function errRedeemNotReady(options: ErrRedeemNotReadyOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_redeem_not_ready',
    });
}
export interface ErrNoRedeemRequestOptions {
    package?: string;
    arguments?: [
    ];
}
export function errNoRedeemRequest(options: ErrNoRedeemRequestOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_no_redeem_request',
    });
}
export interface ErrExceedReserveRatioOptions {
    package?: string;
    arguments?: [
    ];
}
export function errExceedReserveRatio(options: ErrExceedReserveRatioOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_exceed_reserve_ratio',
    });
}
export interface ErrInsufficientFreeLiquidityOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInsufficientFreeLiquidity(options: ErrInsufficientFreeLiquidityOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_insufficient_free_liquidity',
    });
}
export interface ErrExceedOiCapOptions {
    package?: string;
    arguments?: [
    ];
}
export function errExceedOiCap(options: ErrExceedOiCapOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_exceed_oi_cap',
    });
}
export interface ErrRedeemBlockedByUtilizationOptions {
    package?: string;
    arguments?: [
    ];
}
export function errRedeemBlockedByUtilization(options: ErrRedeemBlockedByUtilizationOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_redeem_blocked_by_utilization',
    });
}
export interface ErrZeroPriceOptions {
    package?: string;
    arguments?: [
    ];
}
export function errZeroPrice(options: ErrZeroPriceOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_zero_price',
    });
}
export interface ErrStalePriceOptions {
    package?: string;
    arguments?: [
    ];
}
export function errStalePrice(options: ErrStalePriceOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_stale_price',
    });
}
export interface ErrNotAccountOwnerOptions {
    package?: string;
    arguments?: [
    ];
}
export function errNotAccountOwner(options: ErrNotAccountOwnerOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_not_account_owner',
    });
}
export interface ErrInsufficientBalanceOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInsufficientBalance(options: ErrInsufficientBalanceOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_insufficient_balance',
    });
}
export interface ErrSubAccountNotFoundOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSubAccountNotFound(options: ErrSubAccountNotFoundOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_sub_account_not_found',
    });
}
export interface ErrMaxSubAccountsReachedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errMaxSubAccountsReached(options: ErrMaxSubAccountsReachedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_max_sub_accounts_reached',
    });
}
export interface ErrSubAccountNameTooLongOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSubAccountNameTooLong(options: ErrSubAccountNameTooLongOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_sub_account_name_too_long',
    });
}
export interface ErrReferralAlreadyBoundOptions {
    package?: string;
    arguments?: [
    ];
}
export function errReferralAlreadyBound(options: ErrReferralAlreadyBoundOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_referral_already_bound',
    });
}
export interface ErrSelfReferralOptions {
    package?: string;
    arguments?: [
    ];
}
export function errSelfReferral(options: ErrSelfReferralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_self_referral',
    });
}
export interface ErrInvalidReferralCodeOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidReferralCode(options: ErrInvalidReferralCodeOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_referral_code',
    });
}
export interface ErrReferralCodeBeingSetOptions {
    package?: string;
    arguments?: [
    ];
}
export function errReferralCodeBeingSet(options: ErrReferralCodeBeingSetOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_referral_code_being_set',
    });
}
export interface ErrReferralCodeNotExistsOptions {
    package?: string;
    arguments?: [
    ];
}
export function errReferralCodeNotExists(options: ErrReferralCodeNotExistsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_referral_code_not_exists',
    });
}
export interface ErrUnauthorizedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errUnauthorized(options: ErrUnauthorizedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_unauthorized',
    });
}
export interface ErrInvalidVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidVersion(options: ErrInvalidVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_version',
    });
}
export interface ErrMissingRequestWitnessOptions {
    package?: string;
    arguments?: [
    ];
}
export function errMissingRequestWitness(options: ErrMissingRequestWitnessOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_missing_request_witness',
    });
}
export interface ErrMissingResponseWitnessOptions {
    package?: string;
    arguments?: [
    ];
}
export function errMissingResponseWitness(options: ErrMissingResponseWitnessOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_missing_response_witness',
    });
}
export interface ErrPositionLockedOptions {
    package?: string;
    arguments?: [
    ];
}
export function errPositionLocked(options: ErrPositionLockedOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_position_locked',
    });
}
export interface ErrTradingSlippageExceededOptions {
    package?: string;
    arguments?: [
    ];
}
export function errTradingSlippageExceeded(options: ErrTradingSlippageExceededOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_trading_slippage_exceeded',
    });
}
export interface ErrWitnessAlreadyExistsOptions {
    package?: string;
    arguments?: [
    ];
}
export function errWitnessAlreadyExists(options: ErrWitnessAlreadyExistsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_witness_already_exists',
    });
}
export interface ErrInvalidActionOptions {
    package?: string;
    arguments?: [
    ];
}
export function errInvalidAction(options: ErrInvalidActionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_invalid_action',
    });
}
export interface ErrDeprecatedFunctionOptions {
    package?: string;
    arguments?: [
    ];
}
export function errDeprecatedFunction(options: ErrDeprecatedFunctionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'error',
        function: 'err_deprecated_function',
    });
}