/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Multi-account system for WaterX Perp DEX. One address can own multiple accounts
 * (e.g., for AI agent trading strategies). Accounts keyed by their object ID
 * (sui::object::ID), stored in ObjectTable to preserve UIDs.
 * 
 * Deposit flow (TTO — no contract call needed): transfer::public_transfer(coin,
 * account_id.to_address())
 * 
 * Receive flow (before trading or withdrawal): let coin =
 * receive_coin<TOKEN>(registry, account_id, receiving, ctx);
 * 
 * SDK reads "balance" by querying all Coin<T> objects owned by the UserAccount's
 * object ID.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as keyed_big_vector from './keyed_big_vector.ts';
import * as keyed_big_vector_1 from './keyed_big_vector.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as vec_map_1 from './deps/sui/vec_map.ts';
const $moduleName = '@waterx/perp::user_account';
export const AccountRegistry = new MoveStruct({ name: `${$moduleName}::AccountRegistry`, fields: {
        id: bcs.Address,
        /** Accounts keyed by object ID. */
        accounts: keyed_big_vector.KeyedBigVector,
        /** Maps address to list of owned account IDs. */
        user_accounts: keyed_big_vector_1.KeyedBigVector
    } });
export const DelegateInfo = new MoveStruct({ name: `${$moduleName}::DelegateInfo`, fields: {
        delegate_address: bcs.Address,
        permissions: bcs.u16()
    } });
export const UserAccount = new MoveStruct({ name: `${$moduleName}::UserAccount`, fields: {
        id: bcs.Address,
        /** Owner address. */
        owner_address: bcs.Address,
        /** Human-readable name. */
        name: bcs.string(),
        /** Delegate addresses. */
        delegates: bcs.vector(DelegateInfo),
        /** Position IDs keyed by Market ID. */
        positions: vec_map.VecMap(bcs.Address, bcs.vector(bcs.u64())),
        /** Order IDs keyed by Market ID. */
        orders: vec_map_1.VecMap(bcs.Address, bcs.vector(bcs.u64()))
    } });
export interface AccountOwnerAddressArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountOwnerAddressOptions {
    package?: string;
    arguments: AccountOwnerAddressArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountOwnerAddress(options: AccountOwnerAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_owner_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountAccountIdArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountAccountIdOptions {
    package?: string;
    arguments: AccountAccountIdArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountAccountId(options: AccountAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountNameArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountNameOptions {
    package?: string;
    arguments: AccountNameArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountName(options: AccountNameOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountPositionsArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountPositionsOptions {
    package?: string;
    arguments: AccountPositionsArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountPositions(options: AccountPositionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountOrdersArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountOrdersOptions {
    package?: string;
    arguments: AccountOrdersArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountOrders(options: AccountOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InitOptions {
    package?: string;
    arguments?: [
    ];
}
export function init(options: InitOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'init',
    });
}
export interface CreateAccountArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    name: RawTransactionArgument<string>;
}
export interface CreateAccountOptions {
    package?: string;
    arguments: CreateAccountArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        name: RawTransactionArgument<string>
    ];
}
/**
 * Creates a new named user account. Returns the account ID (object ID). One
 * address can own up to MAX_ACCOUNTS_PER_ADDRESS accounts.
 */
export function createAccount(options: CreateAccountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "name"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'create_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TransferCoinArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface TransferCoinOptions {
    package?: string;
    arguments: TransferCoinArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function transferCoin(options: TransferCoinOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'transfer_coin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReceiveCoinWithAmountArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    toReceives: RawTransactionArgument<string[]>;
    amountOpt: RawTransactionArgument<number | bigint | null>;
}
export interface ReceiveCoinWithAmountOptions {
    package?: string;
    arguments: ReceiveCoinWithAmountArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        toReceives: RawTransactionArgument<string[]>,
        amountOpt: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Receives coins from a UserAccount via TTO, merges them, and returns the
 * requested amount (or all if `amount_opt` is `none`). Remainder is returned to
 * the account. Requires PERM_WITHDRAW.
 */
export function receiveCoinWithAmount(options: ReceiveCoinWithAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'vector<null>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "toReceives", "amountOpt"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'receive_coin_with_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReceiveCoinWithAmountToArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    toReceives: RawTransactionArgument<string[]>;
    amountOpt: RawTransactionArgument<number | bigint | null>;
    recipient: RawTransactionArgument<string>;
}
export interface ReceiveCoinWithAmountToOptions {
    package?: string;
    arguments: ReceiveCoinWithAmountToArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        toReceives: RawTransactionArgument<string[]>,
        amountOpt: RawTransactionArgument<number | bigint | null>,
        recipient: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Same as `receive_coin_with_amount` but transfers the output to `recipient`. */
export function receiveCoinWithAmountTo(options: ReceiveCoinWithAmountToOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'vector<null>',
        '0x1::option::Option<u64>',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "toReceives", "amountOpt", "recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'receive_coin_with_amount_to',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountObjectIdArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountObjectIdOptions {
    package?: string;
    arguments: AccountObjectIdArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/**
 * Returns the object ID of a UserAccount as an address. Use this as the
 * destination for `transfer::public_transfer(coin, account_id.to_address())`.
 * Note: Since account_id IS the object ID, callers can also use
 * `account_id.to_address()` directly.
 */
export function accountObjectId(options: AccountObjectIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_object_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PermOpenPositionOptions {
    package?: string;
    arguments?: [
    ];
}
export function permOpenPosition(options: PermOpenPositionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
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
        module: 'user_account',
        function: 'perm_close_position',
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
        module: 'user_account',
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
        module: 'user_account',
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
        module: 'user_account',
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
        module: 'user_account',
        function: 'perm_withdraw_collateral',
    });
}
export interface PermDepositOptions {
    package?: string;
    arguments?: [
    ];
}
export function permDeposit(options: PermDepositOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_deposit',
    });
}
export interface PermWithdrawOptions {
    package?: string;
    arguments?: [
    ];
}
export function permWithdraw(options: PermWithdrawOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_withdraw',
    });
}
export interface PermTransferOptions {
    package?: string;
    arguments?: [
    ];
}
export function permTransfer(options: PermTransferOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_transfer',
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
        module: 'user_account',
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
        module: 'user_account',
        function: 'perm_redeem_wlp',
    });
}
export interface PermManageDelegatesOptions {
    package?: string;
    arguments?: [
    ];
}
export function permManageDelegates(options: PermManageDelegatesOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_manage_delegates',
    });
}
export interface PermAllTradingOptions {
    package?: string;
    arguments?: [
    ];
}
export function permAllTrading(options: PermAllTradingOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_all_trading',
    });
}
export interface PermAllOptions {
    package?: string;
    arguments?: [
    ];
}
export function permAll(options: PermAllOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'perm_all',
    });
}
export interface AddDelegateArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegate: RawTransactionArgument<string>;
    permissions: RawTransactionArgument<number>;
}
export interface AddDelegateOptions {
    package?: string;
    arguments: AddDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        delegate: RawTransactionArgument<string>,
        permissions: RawTransactionArgument<number>
    ];
}
/**
 * Adds a delegate with specific permissions to an account. Only owner can add
 * delegates.
 */
export function addDelegate(options: AddDelegateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegate", "permissions"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'add_delegate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveDelegateArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegate: RawTransactionArgument<string>;
}
export interface RemoveDelegateOptions {
    package?: string;
    arguments: RemoveDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        delegate: RawTransactionArgument<string>
    ];
}
/** Removes a delegate from a specific account. Only owner can remove delegates. */
export function removeDelegate(options: RemoveDelegateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'remove_delegate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateDelegatePermissionsArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegate: RawTransactionArgument<string>;
    newPermissions: RawTransactionArgument<number>;
}
export interface UpdateDelegatePermissionsOptions {
    package?: string;
    arguments: UpdateDelegatePermissionsArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        delegate: RawTransactionArgument<string>,
        newPermissions: RawTransactionArgument<number>
    ];
}
/** Updates permissions for an existing delegate. Only owner can update permissions. */
export function updateDelegatePermissions(options: UpdateDelegatePermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegate", "newPermissions"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'update_delegate_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegatePermissionsArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegate: RawTransactionArgument<string>;
}
export interface DelegatePermissionsOptions {
    package?: string;
    arguments: DelegatePermissionsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        delegate: RawTransactionArgument<string>
    ];
}
/** Gets the permissions bitmask for a delegate. Returns 0 if not a delegate. */
export function delegatePermissions(options: DelegatePermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'delegate_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasPermissionArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    permission: RawTransactionArgument<number>;
}
export interface HasPermissionOptions {
    package?: string;
    arguments: HasPermissionArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        permission: RawTransactionArgument<number>
    ];
}
/** Checks if an address has a specific permission on an account. */
export function hasPermission(options: HasPermissionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "permission"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'has_permission',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountCountArguments {
    registry: RawTransactionArgument<string>;
    owner: RawTransactionArgument<string>;
}
export interface AccountCountOptions {
    package?: string;
    arguments: AccountCountArguments | [
        registry: RawTransactionArgument<string>,
        owner: RawTransactionArgument<string>
    ];
}
/** Returns the number of accounts owned by an address. */
export function accountCount(options: AccountCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdsArguments {
    registry: RawTransactionArgument<string>;
    owner: RawTransactionArgument<string>;
}
export interface AccountIdsOptions {
    package?: string;
    arguments: AccountIdsArguments | [
        registry: RawTransactionArgument<string>,
        owner: RawTransactionArgument<string>
    ];
}
/** Returns the list of account IDs owned by an address. */
export function accountIds(options: AccountIdsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetAccountNameArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface GetAccountNameOptions {
    package?: string;
    arguments: GetAccountNameArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Gets the name of an account by ID. */
export function getAccountName(options: GetAccountNameOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'get_account_name',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GetAccountOwnerArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface GetAccountOwnerOptions {
    package?: string;
    arguments: GetAccountOwnerArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Gets the owner of an account by ID. */
export function getAccountOwner(options: GetAccountOwnerOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'get_account_owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasAccountArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface HasAccountOptions {
    package?: string;
    arguments: HasAccountArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Checks if an account exists. */
export function hasAccount(options: HasAccountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'has_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasAccountsArguments {
    registry: RawTransactionArgument<string>;
    owner: RawTransactionArgument<string>;
}
export interface HasAccountsOptions {
    package?: string;
    arguments: HasAccountsArguments | [
        registry: RawTransactionArgument<string>,
        owner: RawTransactionArgument<string>
    ];
}
/** Checks if an address owns any accounts. */
export function hasAccounts(options: HasAccountsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'has_accounts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsAuthorizedArguments {
    account: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface IsAuthorizedOptions {
    package?: string;
    arguments: IsAuthorizedArguments | [
        account: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Checks if an address is authorized for an account (owner or any delegate). */
export function isAuthorized(options: IsAuthorizedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["account", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'is_authorized',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReceiveAndMergeInternalArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    receivings: RawTransactionArgument<string[]>;
}
export interface ReceiveAndMergeInternalOptions {
    package?: string;
    arguments: ReceiveAndMergeInternalArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        receivings: RawTransactionArgument<string[]>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Receives a coin from a UserAccount on behalf of a permissioned delegate. The
 * delegate never holds the Coin — it goes directly into the trading request. Only
 * callable within the package (trading.move). Receives multiple coins from a
 * UserAccount and merges them into one. Returns the merged coin and the account's
 * object address (for returning remainders). Only callable within the package
 * (trading.move).
 */
export function receiveAndMergeInternal(options: ReceiveAndMergeInternalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'vector<null>'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "receivings"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'receive_and_merge_internal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddPositionArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface AddPositionOptions {
    package?: string;
    arguments: AddPositionArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
/** Adds a position ID to the account's position list for a given market. */
export function addPosition(options: AddPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "marketId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'add_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePositionArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface RemovePositionOptions {
    package?: string;
    arguments: RemovePositionArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
/** Removes a position ID from the account's position list for a given market. */
export function removePosition(options: RemovePositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "marketId", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'remove_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddOrderArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface AddOrderOptions {
    package?: string;
    arguments: AddOrderArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
/** Adds an order ID to the account's order list for a given market. */
export function addOrder(options: AddOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "marketId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'add_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveOrderArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface RemoveOrderOptions {
    package?: string;
    arguments: RemoveOrderArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
}
/** Removes an order ID from the account's order list for a given market. */
export function removeOrder(options: RemoveOrderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "marketId", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'remove_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowAccountArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface BorrowAccountOptions {
    package?: string;
    arguments: BorrowAccountArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
/** Borrows an account by ID (read-only, no ownership check). */
export function borrowAccount(options: BorrowAccountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'borrow_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountDelegatesArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountDelegatesOptions {
    package?: string;
    arguments: AccountDelegatesArguments | [
        account: RawTransactionArgument<string>
    ];
}
/** Returns the delegates vector for a given account. */
export function accountDelegates(options: AccountDelegatesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'account_delegates',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateInfoAddressArguments {
    d: RawTransactionArgument<string>;
}
export interface DelegateInfoAddressOptions {
    package?: string;
    arguments: DelegateInfoAddressArguments | [
        d: RawTransactionArgument<string>
    ];
}
/** Returns the delegate address. */
export function delegateInfoAddress(options: DelegateInfoAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["d"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'delegate_info_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateInfoPermissionsArguments {
    d: RawTransactionArgument<string>;
}
export interface DelegateInfoPermissionsOptions {
    package?: string;
    arguments: DelegateInfoPermissionsArguments | [
        d: RawTransactionArgument<string>
    ];
}
/** Returns the delegate permissions bitmask. */
export function delegateInfoPermissions(options: DelegateInfoPermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["d"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'delegate_info_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BorrowMutAccountCheckedArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    owner: RawTransactionArgument<string>;
}
export interface BorrowMutAccountCheckedOptions {
    package?: string;
    arguments: BorrowMutAccountCheckedArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        owner: RawTransactionArgument<string>
    ];
}
/** Borrows a mutable account by ID with ownership check. */
export function borrowMutAccountChecked(options: BorrowMutAccountCheckedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'user_account',
        function: 'borrow_mut_account_checked',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}