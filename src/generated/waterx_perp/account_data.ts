/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Per-account perp state, stored as a `WaterXPerpData` blob on the shared
 * `waterx_account::Account` object via `wxa::new_data` / `wxa::borrow_data` /
 * `wxa::borrow_data_mut`. No separate `UserAccount` object and no perp-side
 * `AccountRegistry` exist — the wxa account IS the canonical user identity.
 * 
 * `WaterXPerp` is the witness type that gates every perp-side mutation of the wxa
 * account: the data slot (`new_data` / `borrow_data_mut`) AND fund movement
 * (`wxa_account::take<C, WaterXPerp>` / `wxa_account::put<C, WaterXPerp>`). Only
 * this module can construct `WaterXPerp {}`, so type-construction privacy is the
 * security boundary for both surfaces.
 * 
 * Deposit flow (no TTO): wxa::deposit<T_U, T_M>(...) // Mirrorable
 * wxa::deposit_raw_coin<T>(...) // Storable
 * 
 * Trading then draws collateral directly from the user's wxa balance in
 * `trading.move`; payback paths repay via `wxa_account::put`.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_map from './deps/sui/vec_map.ts';
import * as vec_map_1 from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/perp::account_data';
export const WaterXPerp = new MoveStruct({ name: `${$moduleName}::WaterXPerp`, fields: {
        dummy_field: bcs.bool()
    } });
export const WaterXPerpData = new MoveStruct({ name: `${$moduleName}::WaterXPerpData`, fields: {
        /** Position IDs keyed by Market ID. */
        positions: vec_map.VecMap(bcs.Address, bcs.vector(bcs.u64())),
        /** Order IDs keyed by Market ID. */
        orders: vec_map_1.VecMap(bcs.Address, bcs.vector(bcs.u64()))
    } });
export interface PermOpenPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permOpenPosition(options: PermOpenPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_open_position',
    });
}
export interface PermClosePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permClosePosition(options: PermClosePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_close_position',
    });
}
export interface PermIncreasePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permIncreasePosition(options: PermIncreasePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_increase_position',
    });
}
export interface PermDecreasePositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permDecreasePosition(options: PermDecreasePositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_decrease_position',
    });
}
export interface PermPlaceOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function permPlaceOrder(options: PermPlaceOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_place_order',
    });
}
export interface PermCancelOrderOptions {
    package?: string;
    arguments?: [
    ];
}
export function permCancelOrder(options: PermCancelOrderOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_cancel_order',
    });
}
export interface PermDepositCollateralOptions {
    package?: string;
    arguments?: [
    ];
}
export function permDepositCollateral(options: PermDepositCollateralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_deposit_collateral',
    });
}
export interface PermWithdrawCollateralOptions {
    package?: string;
    arguments?: [
    ];
}
export function permWithdrawCollateral(options: PermWithdrawCollateralOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_withdraw_collateral',
    });
}
export interface PermMintWlpOptions {
    package?: string;
    arguments?: [
    ];
}
export function permMintWlp(options: PermMintWlpOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_mint_wlp',
    });
}
export interface PermRedeemWlpOptions {
    package?: string;
    arguments?: [
    ];
}
export function permRedeemWlp(options: PermRedeemWlpOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'perm_redeem_wlp',
    });
}
export interface WitnessOptions {
    package?: string;
    arguments?: [
    ];
}
export function witness(options: WitnessOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'witness',
    });
}
export interface AccountPositionsArguments {
    data: RawTransactionArgument<string>;
}
export interface AccountPositionsOptions {
    package?: string;
    arguments: AccountPositionsArguments | [
        data: RawTransactionArgument<string>
    ];
}
export function accountPositions(options: AccountPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'account_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrdersArguments {
    data: RawTransactionArgument<string>;
}
export interface AccountOrdersOptions {
    package?: string;
    arguments: AccountOrdersArguments | [
        data: RawTransactionArgument<string>
    ];
}
export function accountOrders(options: AccountOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'account_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasAccountArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface HasAccountOptions {
    package?: string;
    arguments: HasAccountArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * True if a `WaterXPerpData` slot exists on the wxa account. The slot is
 * auto-installed on first position/order add — see `ensure_data`.
 */
export function hasAccount(options: HasAccountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'has_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowAccountArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface BorrowAccountOptions {
    package?: string;
    arguments: BorrowAccountArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Borrow the perp data blob (read-only). Aborts if no slot exists. */
export function borrowAccount(options: BorrowAccountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'borrow_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountObjectAddressArguments {
    WxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountObjectAddressOptions {
    package?: string;
    arguments: AccountObjectAddressArguments | [
        WxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * UID-derived address of the wxa account — the value stored on `Position` /
 * `Order` as `account_object_address`. Just `account_id.to_address()`.
 */
export function accountObjectAddress(options: AccountObjectAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["WxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'account_object_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddPositionArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface AddPositionOptions {
    package?: string;
    arguments: AddPositionArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function addPosition(options: AddPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'add_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePositionArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface RemovePositionOptions {
    package?: string;
    arguments: RemovePositionArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
export function removePosition(options: RemovePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'remove_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddOrderArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface AddOrderOptions {
    package?: string;
    arguments: AddOrderArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function addOrder(options: AddOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'add_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveOrderArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface RemoveOrderOptions {
    package?: string;
    arguments: RemoveOrderArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
export function removeOrder(options: RemoveOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId", "marketId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'remove_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EnsureDataArguments {
    wxaRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface EnsureDataOptions {
    package?: string;
    arguments: EnsureDataArguments | [
        wxaRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * Installs an empty `WaterXPerpData` slot on the wxa account if one doesn't
 * already exist. Idempotent. Called from `add_position` / `add_order` so the first
 * trade on an account auto-installs the slot without requiring an explicit
 * `create_account`.
 */
export function ensureData(options: EnsureDataOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["wxaRegistry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account_data',
        function: 'ensure_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}