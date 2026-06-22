/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Generalized multi-account framework for the WaterX ecosystem.
 * 
 * Pure custody layer. Accounts hold per-T `Balance<T>` as dynamic fields keyed by
 * `BalanceKey<T>()`, with a `VecMap<TypeName, u64>` mirror on each `Account` for
 * fast enumeration. External flow in/out is mediated by hot-potato
 * `DepositRequest<T>` / `WithdrawRequest<T>` that the framework issues; a
 * registered policy module destroys the potato with its own witness and decides
 * what final asset to put back into the account (e.g. a PSM policy turns
 * `Coin<USDC>` into `Balance<USD>` and credits the account via `put<USD, P>`).
 * 
 * Internal protocol ↔ account flow stays witness-gated via `take<T, P>` /
 * `put<T, P>` with no policy registration involved — the protocol module's witness
 * is the only authority needed, since only that module can construct a value of
 * its witness type.
 * 
 * Types of T:
 * 
 * - Has registered deposit policy → `request_deposit<T>` works.
 * - Has registered withdraw policy → `request_withdraw<T>` works.
 * - Neither → "Parkable". Coins can sit on the account address via
 *   `transfer_coin<T>` or external `transfer::public_transfer`, but nothing the
 *   framework does will fold them into the account until a policy is registered
 *   (or owner drains via `receive_coin`).
 */

import { MoveStruct, MoveTuple, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as object_table from './deps/sui/object_table.ts';
import * as table from './deps/sui/table.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as balance_1 from './deps/sui/balance.ts';
import * as sheet from './deps/bucket_v2_framework/sheet.ts';
const $moduleName = '@waterx/account::account';
export const ACCOUNT = new MoveStruct({ name: `${$moduleName}::ACCOUNT`, fields: {
        dummy_field: bcs.bool()
    } });
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export const WaterXAccount = new MoveStruct({ name: `${$moduleName}::WaterXAccount`, fields: {
        dummy_field: bcs.bool()
    } });
export const AccountRegistry = new MoveStruct({ name: `${$moduleName}::AccountRegistry`, fields: {
        id: bcs.Address,
        /**
         * `ObjectTable` (not plain `Table`) so each `Account` retains a distinct on-chain
         * address that off-chain callers can query directly via `getObject(account_id)`
         * instead of walking dynamic-field handles on the registry UID.
         */
        accounts: object_table.ObjectTable,
        owner_index: table.Table,
        /**
         * Admin-managed whitelist of protocol witness types allowed to move funds
         * (`take<T, P>` / `put<T, P>`) and mutate per-account protocol data
         * (`new_data<P, D>` / `borrow_data_mut<P, D>` / `remove_data<P, D>`). For each
         * whitelisted `P`, the value is the set of asset types `T` that protocol is
         * allowed to draw via `take<T, P>` — admin opts each pair in via two phases:
         * `whitelist_protocol<P>(registry, &AdminCap)` registers `P` with an empty asset
         * set, then `allow_protocol_asset<P, T>(registry,  &AdminCap)` adds each T.
         *
         * Gates:
         *
         * - `take<T, P>` requires both `P` whitelisted AND `T` in `protocol_whitelist[P]`
         *   (plus per-account auth on the caller).
         * - `put<T, P>` requires only `P` whitelisted. The T-gate stays open even after
         *   `disallow_protocol_asset<P, T>`, so existing positions can always close.
         * - `new_data<P, _>` / `borrow_data_mut<P, _>` / `remove_data<P, _>` require only
         *   `P` whitelisted.
         */
        protocol_whitelist: vec_map.VecMap(type_name.TypeName, vec_set.VecSet(type_name.TypeName)),
        /**
         * `T → registered DepositPolicy witness TypeName`. Presence means
         * `request_deposit<T>` / `request_deposit_from_receivings<T>` are permitted; only
         * the module that defines the registered witness type can call
         * `consume_deposit<T, P>` to unwrap the resulting `DepositRequest<T>`. Deposit
         * policy registration is independent of `protocol_whitelist` — a policy can be the
         * _consumer_ of a request without being allowed to `take`/`put`.
         * `T → set of DepositPolicy witness TypeNames`. Multiple policies can be
         * registered per T to support extension (a new policy added alongside the old) and
         * migration (both coexist while consumers switch). `request_deposit<T>` requires
         * the set to be non-empty; `consume_deposit<T, P>` requires P to be in the set.
         */
        deposit_policies: vec_map.VecMap(type_name.TypeName, vec_set.VecSet(type_name.TypeName)),
        /**
         * `T → set of WithdrawPolicy witness TypeNames`. Symmetric to `deposit_policies`
         * for `request_withdraw<T>` / `consume_withdraw`.
         */
        withdraw_policies: vec_map.VecMap(type_name.TypeName, vec_set.VecSet(type_name.TypeName)),
        /**
         * Per-T aggregate of `Balance<T>` currently held inside accounts. Incremented in
         * `put<T, P>`, decremented in `take<T, P>` and `request_withdraw<T>`. Does _not_
         * include balance held by protocols (after `take`) or sitting in flight inside a
         * `DepositRequest` / `WithdrawRequest` hot potato.
         */
        balances: vec_map.VecMap(type_name.TypeName, bcs.u64()),
        allowed_versions: vec_set.VecSet(bcs.u16()),
        managers: vec_set.VecSet(bcs.Address),
        paused: bcs.bool()
    } });
export const VaultKey = new MoveTuple({ name: `${$moduleName}::VaultKey<phantom T>`, fields: [bcs.bool()] });
export const Vault = new MoveStruct({ name: `${$moduleName}::Vault<phantom T>`, fields: {
        balance: balance_1.Balance,
        sheet: sheet.Sheet
    } });
export const ProtocolDataKey = new MoveTuple({ name: `${$moduleName}::ProtocolDataKey<phantom PROTOCOL>`, fields: [bcs.bool()] });
export const Delegate = new MoveStruct({ name: `${$moduleName}::Delegate`, fields: {
        delegate_address: bcs.Address,
        alias: bcs.string(),
        /** Framework-level action bitmap (PERM_WITHDRAW etc). */
        permissions: bcs.u32(),
        /**
         * Per-protocol bitmap. Missing key → delegate cannot drive that protocol. Each
         * protocol's module interprets its own bits. Owner always has `PERM_ALL` per
         * protocol regardless of this field.
         */
        protocol_permissions: vec_map.VecMap(type_name.TypeName, bcs.u32()),
        expires_at_ms: bcs.option(bcs.u64())
    } });
export const Account = new MoveStruct({ name: `${$moduleName}::Account`, fields: {
        id: bcs.Address,
        owner_address: bcs.Address,
        alias: bcs.string(),
        delegates: bcs.vector(Delegate),
        /**
         * Mirror of the per-T `Balance<T>` values stored as dynamic fields under
         * `BalanceKey<T>()` on this UID. Always equals the matching stored balance's
         * `value()`.
         */
        balances: vec_map.VecMap(type_name.TypeName, bcs.u64())
    } });
export const DepositRequest = new MoveStruct({ name: `${$moduleName}::DepositRequest<phantom T>`, fields: {
        account_id: bcs.Address,
        balance: balance_1.Balance,
        extra_data: bcs.vector(bcs.u8())
    } });
export const WithdrawRequest = new MoveStruct({ name: `${$moduleName}::WithdrawRequest<phantom T>`, fields: {
        account_id: bcs.Address,
        balance: balance_1.Balance,
        recipient: bcs.Address,
        extra_data: bcs.vector(bcs.u8())
    } });
export const PausedProtocolsKey = new MoveTuple({ name: `${$moduleName}::PausedProtocolsKey`, fields: [bcs.bool()] });
export const AccountKey = new MoveStruct({ name: `${$moduleName}::AccountKey`, fields: {
        owner: bcs.Address,
        index: bcs.u64()
    } });
export interface PermNoneOptions {
    package?: string;
    arguments?: [
    ];
}
export function permNone(options: PermNoneOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'perm_none',
    });
}
export interface PermWithdrawOptions {
    package?: string;
    arguments?: [
    ];
}
export function permWithdraw(options: PermWithdrawOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'perm_withdraw',
    });
}
export interface PermManageDelegatesOptions {
    package?: string;
    arguments?: [
    ];
}
export function permManageDelegates(options: PermManageDelegatesOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'perm_manage_delegates',
    });
}
export interface PermReceiveOptions {
    package?: string;
    arguments?: [
    ];
}
export function permReceive(options: PermReceiveOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'perm_receive',
    });
}
export interface PermAllOptions {
    package?: string;
    arguments?: [
    ];
}
export function permAll(options: PermAllOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'perm_all',
    });
}
export interface AliasMaxLengthOptions {
    package?: string;
    arguments?: [
    ];
}
export function aliasMaxLength(options: AliasMaxLengthOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'alias_max_length',
    });
}
export interface MaxAccountsPerOwnerOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxAccountsPerOwner(options: MaxAccountsPerOwnerOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'max_accounts_per_owner',
    });
}
export interface MaxDelegatesPerAccountOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxDelegatesPerAccount(options: MaxDelegatesPerAccountOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'max_delegates_per_account',
    });
}
export interface MaxProtocolPermsPerDelegateOptions {
    package?: string;
    arguments?: [
    ];
}
export function maxProtocolPermsPerDelegate(options: MaxProtocolPermsPerDelegateOptions = {}) {
    const packageAddress = options.package ?? '@waterx/account';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'max_protocol_perms_per_delegate',
    });
}
export interface AssertVersionArguments {
    registry: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsVersionAllowedArguments {
    registry: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface IsVersionAllowedOptions {
    package?: string;
    arguments: IsVersionAllowedArguments | [
        registry: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function isVersionAllowed(options: IsVersionAllowedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_version_allowed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPausedArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsPausedOptions {
    package?: string;
    arguments: IsPausedArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function isPaused(options: IsPausedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertNotPausedArguments {
    registry: RawTransactionArgument<string>;
}
export interface AssertNotPausedOptions {
    package?: string;
    arguments: AssertNotPausedArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function assertNotPaused(options: AssertNotPausedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'assert_not_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PauseArguments {
    registry: RawTransactionArgument<string>;
    managerRequest: TransactionArgument;
}
export interface PauseOptions {
    package?: string;
    arguments: PauseArguments | [
        registry: RawTransactionArgument<string>,
        managerRequest: TransactionArgument
    ];
}
export function pause(options: PauseOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "managerRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'pause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnpauseArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface UnpauseOptions {
    package?: string;
    arguments: UnpauseArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
}
export function unpause(options: UnpauseOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'unpause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsManagerArguments {
    registry: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface IsManagerOptions {
    package?: string;
    arguments: IsManagerArguments | [
        registry: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
export function isManager(options: IsManagerOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ManagersArguments {
    registry: RawTransactionArgument<string>;
}
export interface ManagersOptions {
    package?: string;
    arguments: ManagersArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function managers(options: ManagersOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'managers',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddManagerArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    manager: RawTransactionArgument<string>;
}
export interface AddManagerOptions {
    package?: string;
    arguments: AddManagerArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        manager: RawTransactionArgument<string>
    ];
}
export function addManager(options: AddManagerOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "manager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'add_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveManagerArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    manager: RawTransactionArgument<string>;
}
export interface RemoveManagerOptions {
    package?: string;
    arguments: RemoveManagerArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        manager: RawTransactionArgument<string>
    ];
}
export function removeManager(options: RemoveManagerOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "manager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'remove_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsProtocolWhitelistedArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsProtocolWhitelistedOptions {
    package?: string;
    arguments: IsProtocolWhitelistedArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isProtocolWhitelisted(options: IsProtocolWhitelistedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_protocol_whitelisted',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsProtocolAssetAllowedArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsProtocolAssetAllowedOptions {
    package?: string;
    arguments: IsProtocolAssetAllowedArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function isProtocolAssetAllowed(options: IsProtocolAssetAllowedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_protocol_asset_allowed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolWhitelistArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolWhitelistOptions {
    package?: string;
    arguments: ProtocolWhitelistArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function protocolWhitelist(options: ProtocolWhitelistOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'protocol_whitelist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WhitelistProtocolArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface WhitelistProtocolOptions {
    package?: string;
    arguments: WhitelistProtocolArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: register witness type `P` with an empty asset set. After this, admin must
 * call `allow_protocol_asset<P, T>` for each T the protocol may draw. Strict —
 * aborts if `P` is already listed.
 */
export function whitelistProtocol(options: WhitelistProtocolOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'whitelist_protocol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DelistProtocolArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface DelistProtocolOptions {
    package?: string;
    arguments: DelistProtocolArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: remove witness type `P` (and its entire asset set) from the protocol
 * whitelist. After this, every `take<T, P>` / `put<T, P>` and witness-gated
 * data-slot call aborts. Existing data slots and protocol-held balances are
 * untouched — only future calls are blocked, so admin can pause a misbehaving
 * protocol without stranding state on accounts.
 */
export function delistProtocol(options: DelistProtocolOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delist_protocol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseProtocolArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface PauseProtocolOptions {
    package?: string;
    arguments: PauseProtocolArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: pause protocol `P` WITHOUT delisting it. A paused protocol cannot
 * `take<_, P>` (new outbound debits) or `new_data<P, _>` (new account state), but
 * `put<_, P>`, `borrow_data_mut<P, _>`, and `remove_data<P, _>` keep working — so
 * in-flight refunds, claims, and close/cleanup can complete. Use this instead of
 * `delist_protocol` for emergency stops; delisting blocks the exit paths too and
 * strands active per-account state (see audit M09).
 */
export function pauseProtocol(options: PauseProtocolOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'pause_protocol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnpauseProtocolArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface UnpauseProtocolOptions {
    package?: string;
    arguments: UnpauseProtocolArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Admin: lift a `pause_protocol<P>`. Idempotent on a non-paused protocol. */
export function unpauseProtocol(options: UnpauseProtocolOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'unpause_protocol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsProtocolPausedArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsProtocolPausedOptions {
    package?: string;
    arguments: IsProtocolPausedArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isProtocolPaused(options: IsProtocolPausedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_protocol_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AllowProtocolAssetArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface AllowProtocolAssetOptions {
    package?: string;
    arguments: AllowProtocolAssetArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Admin: add asset type `T` to protocol `P`'s allowed-asset set. After this,
 * `take<T, P>` is permitted (subject to per-account auth). Aborts if `P` is not
 * whitelisted or if `T` is already in the set.
 */
export function allowProtocolAsset(options: AllowProtocolAssetOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'allow_protocol_asset',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DisallowProtocolAssetArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface DisallowProtocolAssetOptions {
    package?: string;
    arguments: DisallowProtocolAssetArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Admin: remove asset type `T` from protocol `P`'s allowed-asset set. Blocks
 * future `take<T, P>` calls but `put<T, P>` on `T` stays open so existing
 * positions can always close. Aborts if `P` is not whitelisted or if `T` is not in
 * the set.
 */
export function disallowProtocolAsset(options: DisallowProtocolAssetOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'disallow_protocol_asset',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsDepositPolicyRegisteredArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsDepositPolicyRegisteredOptions {
    package?: string;
    arguments: IsDepositPolicyRegisteredArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Returns true if `T` has at least one deposit policy registered. Used by
 * `request_deposit<T>` to gate inflow and by `withdraw_from_funds<T>` to refuse
 * policy-managed types.
 */
export function isDepositPolicyRegistered(options: IsDepositPolicyRegisteredOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_deposit_policy_registered',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsWithdrawPolicyRegisteredArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsWithdrawPolicyRegisteredOptions {
    package?: string;
    arguments: IsWithdrawPolicyRegisteredArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Returns true if `T` has at least one withdraw policy registered. */
export function isWithdrawPolicyRegistered(options: IsWithdrawPolicyRegisteredOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_withdraw_policy_registered',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsDepositPolicyRegisteredForArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsDepositPolicyRegisteredForOptions {
    package?: string;
    arguments: IsDepositPolicyRegisteredForArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Returns true if the specific witness `P` is one of T's registered deposit
 * policies. `consume_deposit<T, P>` aborts `EPolicyMismatch` when this would
 * return false.
 */
export function isDepositPolicyRegisteredFor(options: IsDepositPolicyRegisteredForOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_deposit_policy_registered_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsWithdrawPolicyRegisteredForArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsWithdrawPolicyRegisteredForOptions {
    package?: string;
    arguments: IsWithdrawPolicyRegisteredForArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function isWithdrawPolicyRegisteredFor(options: IsWithdrawPolicyRegisteredForOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_withdraw_policy_registered_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositPoliciesForArguments {
    registry: RawTransactionArgument<string>;
}
export interface DepositPoliciesForOptions {
    package?: string;
    arguments: DepositPoliciesForArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Returns the full set of deposit-policy witness typenames registered for `T`, as
 * a `vector<TypeName>` copy (TypeName is `copy + drop +  store`, so this is
 * cheap). Aborts if T has no policies. Off-chain consumers wanting iteration
 * without the copy should walk the full `deposit_policies()` map instead.
 */
export function depositPoliciesFor(options: DepositPoliciesForOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_policies_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawPoliciesForArguments {
    registry: RawTransactionArgument<string>;
}
export interface WithdrawPoliciesForOptions {
    package?: string;
    arguments: WithdrawPoliciesForArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function withdrawPoliciesFor(options: WithdrawPoliciesForOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_policies_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositPoliciesArguments {
    registry: RawTransactionArgument<string>;
}
export interface DepositPoliciesOptions {
    package?: string;
    arguments: DepositPoliciesArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function depositPolicies(options: DepositPoliciesOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WithdrawPoliciesArguments {
    registry: RawTransactionArgument<string>;
}
export interface WithdrawPoliciesOptions {
    package?: string;
    arguments: WithdrawPoliciesArguments | [
        registry: RawTransactionArgument<string>
    ];
}
export function withdrawPolicies(options: WithdrawPoliciesOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_policies',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RegisterDepositPolicyArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface RegisterDepositPolicyOptions {
    package?: string;
    arguments: RegisterDepositPolicyArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Admin: register witness type `P` as a deposit policy for `T`. Multiple policies
 * can coexist per T to support extension (a new module added alongside the old)
 * and migration (consumers switch one at a time). Idempotent — adding an
 * already-registered `(T, P)` pair is a silent no-op so admin can re-run deploy
 * scripts safely.
 */
export function registerDepositPolicy(options: RegisterDepositPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'register_deposit_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RegisterWithdrawPolicyArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface RegisterWithdrawPolicyOptions {
    package?: string;
    arguments: RegisterWithdrawPolicyArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function registerWithdrawPolicy(options: RegisterWithdrawPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'register_withdraw_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnregisterDepositPolicyArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface UnregisterDepositPolicyOptions {
    package?: string;
    arguments: UnregisterDepositPolicyArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Admin: remove `P` from T's deposit-policy set. Other registered policies for `T`
 * keep working. If `P` is the last entry, the `T` key is cleaned up so
 * `is_deposit_policy_registered<T>` returns false. Aborts if `(T, P)` isn't
 * registered.
 */
export function unregisterDepositPolicy(options: UnregisterDepositPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'unregister_deposit_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnregisterWithdrawPolicyArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface UnregisterWithdrawPolicyOptions {
    package?: string;
    arguments: UnregisterWithdrawPolicyArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function unregisterWithdrawPolicy(options: UnregisterWithdrawPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'unregister_withdraw_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreateAccountArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    alias: RawTransactionArgument<string>;
}
export interface CreateAccountOptions {
    package?: string;
    arguments: CreateAccountArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        alias: RawTransactionArgument<string>
    ];
}
export function createAccount(options: CreateAccountOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "alias"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'create_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DeriveAccountAddressArguments {
    registry: RawTransactionArgument<string>;
    owner: RawTransactionArgument<string>;
    index: RawTransactionArgument<number | bigint>;
}
export interface DeriveAccountAddressOptions {
    package?: string;
    arguments: DeriveAccountAddressArguments | [
        registry: RawTransactionArgument<string>,
        owner: RawTransactionArgument<string>,
        index: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Off-chain view: compute the address a future `create_account` call will produce
 * for `(owner, index)`. Mirrors `derived_object::derive_address` keyed on
 * `AccountKey`. Useful for SDKs that want to address an account before it exists,
 * or to discover all of an owner's accounts by iterating index from 0 up to
 * `MAX_ACCOUNTS_PER_OWNER` and checking `has_account` against each derived
 * address.
 */
export function deriveAccountAddress(options: DeriveAccountAddressOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner", "index"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'derive_account_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetAliasArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    alias: RawTransactionArgument<string>;
}
export interface SetAliasOptions {
    package?: string;
    arguments: SetAliasArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        alias: RawTransactionArgument<string>
    ];
}
export function setAlias(options: SetAliasOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        '0x1::string::String'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "alias"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'set_alias',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddDelegateArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
    alias: RawTransactionArgument<string>;
    permissions: RawTransactionArgument<number>;
    expiresAtMs: RawTransactionArgument<number | bigint | null>;
}
export interface AddDelegateOptions {
    package?: string;
    arguments: AddDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        delegateAddress: RawTransactionArgument<string>,
        alias: RawTransactionArgument<string>,
        permissions: RawTransactionArgument<number>,
        expiresAtMs: RawTransactionArgument<number | bigint | null>
    ];
}
export function addDelegate(options: AddDelegateOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        '0x1::string::String',
        'u32',
        '0x1::option::Option<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegateAddress", "alias", "permissions", "expiresAtMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'add_delegate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveDelegateArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
}
export interface RemoveDelegateOptions {
    package?: string;
    arguments: RemoveDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        delegateAddress: RawTransactionArgument<string>
    ];
}
/**
 * Owner-only for live delegates; permissionless once the delegate has passed its
 * `expires_at_ms`. Lets a keeper / bot prune dead entries without bothering the
 * owner — an expired delegate carries no authority, so removing it is purely
 * janitorial.
 */
export function removeDelegate(options: RemoveDelegateOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegateAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'remove_delegate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateDelegateArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
    alias: RawTransactionArgument<string>;
    permissions: RawTransactionArgument<number>;
    expiresAtMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateDelegateOptions {
    package?: string;
    arguments: UpdateDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        delegateAddress: RawTransactionArgument<string>,
        alias: RawTransactionArgument<string>,
        permissions: RawTransactionArgument<number>,
        expiresAtMs: RawTransactionArgument<number | bigint | null>
    ];
}
export function updateDelegate(options: UpdateDelegateOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        '0x1::string::String',
        'u32',
        '0x1::option::Option<u64>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegateAddress", "alias", "permissions", "expiresAtMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'update_delegate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetDelegateProtocolPermissionArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
    permissions: RawTransactionArgument<number>;
}
export interface SetDelegateProtocolPermissionOptions {
    package?: string;
    arguments: SetDelegateProtocolPermissionArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        delegateAddress: RawTransactionArgument<string>,
        permissions: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function setDelegateProtocolPermission(options: SetDelegateProtocolPermissionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        'u32',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegateAddress", "permissions"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'set_delegate_protocol_permission',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnsetDelegateProtocolPermissionArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
}
export interface UnsetDelegateProtocolPermissionOptions {
    package?: string;
    arguments: UnsetDelegateProtocolPermissionArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        delegateAddress: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unsetDelegateProtocolPermission(options: UnsetDelegateProtocolPermissionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "delegateAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'unset_delegate_protocol_permission',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestDepositArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    extraData: RawTransactionArgument<Array<number>>;
}
export interface RequestDepositOptions {
    package?: string;
    arguments: RequestDepositArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Wraps an in-PTB `Coin<T>` into a `DepositRequest<T>` for the account.
 * Permissionless — anyone can pay into any account, since the policy (not the
 * framework) decides what the eventual credited asset is. `T` must have a
 * registered deposit policy; aborts otherwise.
 */
export function requestDeposit(options: RequestDepositOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "coin", "extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'request_deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestDepositFromReceivingsArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    receivings: TransactionArgument;
    extraData: RawTransactionArgument<Array<number>>;
}
export interface RequestDepositFromReceivingsOptions {
    package?: string;
    arguments: RequestDepositFromReceivingsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        receivings: TransactionArgument,
        extraData: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Drains `Receiving<Coin<T>>` entries addressed to the account's UID into a single
 * merged `Coin<T>` and wraps it as a `DepositRequest<T>`. Used when a user (or
 * anyone) previously `transfer_coin`-ed a `Coin<T>` onto the account address and
 * now wants to fold it into custody. Permissionless for the same reason as
 * `request_deposit<T>`.
 */
export function requestDepositFromReceivings(options: RequestDepositFromReceivingsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'vector<null>',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "receivings", "extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'request_deposit_from_receivings',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestDepositFromFundsArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    accumulatorRoot: RawTransactionArgument<string>;
    extraData: RawTransactionArgument<Array<number>>;
}
export interface RequestDepositFromFundsOptions {
    package?: string;
    arguments: RequestDepositFromFundsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        accumulatorRoot: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Drains every `Balance<T>` sitting at the account's UID-derived address in Sui's
 * native funds accumulator and wraps the total into a single `DepositRequest<T>`.
 * Useful for accounts that receive `Coin<T>` via `0x2::balance::send_funds<T>` (or
 * any path that lands T at `account_id.to_address()` directly) and want it folded
 * into framework custody through the deposit-policy pipeline.
 *
 * The total drained equals `settled_funds_value<T>(root, addr)` as of the last
 * consensus commit — within the writing PTB itself, that read returns the pre-tx
 * value, so SDKs should treat this as a between-tx drain. Permissionless
 * (crediting an account is always allowed), pause-free, requires `T` to have a
 * registered deposit policy. Returns a deposit request even when the address holds
 * zero T (the carried balance is `Balance::zero()` in that case) — callers can
 * short-circuit off-chain by checking `settled_funds_value` first.
 */
export function requestDepositFromFunds(options: RequestDepositFromFundsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "accumulatorRoot", "extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'request_deposit_from_funds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConsumeDepositArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    req: TransactionArgument;
    Witness: RawTransactionArgument<P>;
}
export interface ConsumeDepositOptions<P extends BcsType<any>> {
    package?: string;
    arguments: ConsumeDepositArguments<P> | [
        registry: RawTransactionArgument<string>,
        req: TransactionArgument,
        Witness: RawTransactionArgument<P>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Policy-side unwrap. Verifies that `P` is the registered deposit policy for `T`,
 * then destructures the hot potato. The policy module is responsible for what
 * happens next — typically swap / convert `Balance<T>` to some `Balance<T_OUT>`
 * and call `put<T_OUT, P>` to credit the account.
 */
export function consumeDeposit<P extends BcsType<any>>(options: ConsumeDepositOptions<P>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "req", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'consume_deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestWithdrawArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    recipient: RawTransactionArgument<string>;
    extraData: RawTransactionArgument<Array<number>>;
}
export interface RequestWithdrawOptions {
    package?: string;
    arguments: RequestWithdrawArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        recipient: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Debits `amount` of the account's stored `Balance<T>` and packages it into a
 * `WithdrawRequest<T>` for the registered withdraw policy. Auth (`PERM_WITHDRAW`
 * on `T`'s account) and pause are checked here, not in `consume_withdraw`.
 */
export function requestWithdraw(options: RequestWithdrawOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        'address',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "amount", "recipient", "extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'request_withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConsumeWithdrawArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    req: TransactionArgument;
    Witness: RawTransactionArgument<P>;
}
export interface ConsumeWithdrawOptions<P extends BcsType<any>> {
    package?: string;
    arguments: ConsumeWithdrawArguments<P> | [
        registry: RawTransactionArgument<string>,
        req: TransactionArgument,
        Witness: RawTransactionArgument<P>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Policy-side unwrap. Verifies that `P` is the registered withdraw policy for `T`,
 * then destructures the hot potato. The policy module decides what to do with the
 * `Balance<T>` (transfer to `recipient` as `Coin<T>`, swap to another asset and
 * transfer, queue for later settlement, etc.).
 */
export function consumeWithdraw<P extends BcsType<any>>(options: ConsumeWithdrawOptions<P>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "req", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'consume_withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
/**
 * TTOs a `Coin<T>` to the account's UID address. The coin sits there until someone
 * calls `request_deposit_from_receivings<T>` (which requires a registered deposit
 * policy that then folds the coin into the account's stored balance) or
 * `receive<Coin<T>>` (owner / `PERM_RECEIVE` delegate, no policy needed). Useful
 * for async / cross-PTB deposits and for routing protocol payouts (e.g. reward
 * claims) into an account when `T` has no deposit policy.
 */
export function transferCoin(options: TransferCoinOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'transfer_coin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReceiveArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    receiving: TransactionArgument;
}
export interface ReceiveOptions {
    package?: string;
    arguments: ReceiveArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        receiving: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-owner drain of a TTO'd object on the account's UID. Generic over
 * `T: key + store` — works for NFTs, reward objects, or `Coin<X>` where `X` has no
 * registered deposit policy.
 *
 * **Policy-managed Coin<X> is rejected.** If `T == Coin<X>` and `X` has a deposit
 * policy registered, this aborts `EUseRequestDepositInstead` to keep policy-routed
 * inflow on the deposit-policy pipeline — bypassing via `receive` would skip the
 * conversion / authorization the policy is supposed to enforce. Use
 * `request_deposit_from_receivings<X>` or `request_deposit_from_funds<X>` for
 * inflow when X has a deposit policy.
 *
 * Auth: account owner or a `PERM_RECEIVE` delegate (kept separate from
 * `PERM_WITHDRAW` so reward-collection rights don't imply balance-drain rights).
 * Returns the received object to the caller's PTB.
 */
export function receive(options: ReceiveOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "receiving"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'receive',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawFromFundsArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    accumulatorRoot: RawTransactionArgument<string>;
}
export interface WithdrawFromFundsOptions {
    package?: string;
    arguments: WithdrawFromFundsArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        accumulatorRoot: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Drains every `Balance<T>` sitting at the account's UID-derived address in Sui's
 * native funds accumulator and returns it directly as a `Balance<T>`. Symmetric to
 * `request_deposit_from_funds<T>`, but explicitly for `T` that has **no**
 * registered deposit policy — policy-managed inflow must route through the
 * deposit-policy pipeline instead. The intent is to let owners (or `PERM_WITHDRAW`
 * delegates) pull policy-less inflow (reward tokens TTO'd via `send_funds`,
 * miscellaneous `Balance<T>` the SDK parked at the address) straight out.
 *
 * Auth: same as `request_withdraw<T>` — `PERM_WITHDRAW` or owner. Aborts
 * `EUseRequestDepositInstead` if `T` has a deposit policy registered. Pause-gated.
 * Returns `Balance::zero<T>()` when the address holds no T.
 */
export function withdrawFromFunds(options: WithdrawFromFundsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "accumulatorRoot"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_from_funds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TakeArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    Witness: RawTransactionArgument<P>;
}
export interface TakeOptions<P extends BcsType<any>> {
    package?: string;
    arguments: TakeArguments<P> | [
        registry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        Witness: RawTransactionArgument<P>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Splits `amount` of `Balance<T>` off `account_id` for protocol `P` to use. Three
 * gates compose:
 *
 * 1.  **Witness privacy.** Only the module that defines `P` can produce a value of
 *     `P`, so only that module can call `take<T, P>`.
 * 2.  **Protocol whitelist.** `P` must be in `protocol_whitelist` (admin-managed).
 *     Stops any deployed module that happens to own a `drop` witness from draining
 *     accounts.
 * 3.  **Per-account auth.** `sender_request.address()` must be the account's owner
 *     OR a non-expired delegate — even a legitimate whitelisted protocol cannot
 *     move funds out of an account that doesn't know the caller. This mirrors EOA
 *     semantics: the account never pays out without the owner (or a delegated key)
 *     signing. Per-action bit semantics on `protocol_permissions[P]` remain the
 *     protocol's responsibility on top of this.
 *
 * No deposit/withdraw policy is consulted — `take` / `put` are the
 * protocol↔account flow and orthogonal to the external deposit/withdraw path that
 * policies own.
 */
export function take<P extends BcsType<any>>(options: TakeOptions<P>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        'u64',
        `${options.typeArguments[1]}`,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "senderRequest", "accountId", "amount", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'take',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PutArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    bal: TransactionArgument;
    Witness: RawTransactionArgument<P>;
}
export interface PutOptions<P extends BcsType<any>> {
    package?: string;
    arguments: PutArguments<P> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        bal: TransactionArgument,
        Witness: RawTransactionArgument<P>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Joins `bal` into `account_id`'s stored `Balance<T>`. Symmetric to `take<T, P>`.
 * Zero-value balances are silently destroyed.
 */
export function put<P extends BcsType<any>>(options: PutOptions<P>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "bal", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'put',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
export function hasAccount(options: HasAccountOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_account',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsAccountAuthorizedArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    nowMs: RawTransactionArgument<number | bigint>;
}
export interface IsAccountAuthorizedOptions {
    package?: string;
    arguments: IsAccountAuthorizedArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        nowMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Returns `true` when `addr` is the account's owner or a non-expired delegate,
 * regardless of permission bits. The framework's "is this address known to the
 * account?" gate — per-action bit semantics are the protocol's responsibility on
 * top of this.
 */
export function isAccountAuthorized(options: IsAccountAuthorizedOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "nowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'is_account_authorized',
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
export function accountCount(options: AccountCountOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
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
export function accountIds(options: AccountIdsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "owner"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EffectivePermissionsArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    nowMs: RawTransactionArgument<number | bigint>;
}
export interface EffectivePermissionsOptions {
    package?: string;
    arguments: EffectivePermissionsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        nowMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Framework-level effective permissions (used by `request_withdraw`). Owner →
 * `PERM_ALL`. Delegate → its `permissions` bitmap unless expired. Stranger →
 * `PERM_NONE`.
 */
export function effectivePermissions(options: EffectivePermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "nowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'effective_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasPermissionArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    permission: RawTransactionArgument<number>;
    nowMs: RawTransactionArgument<number | bigint>;
}
export interface HasPermissionOptions {
    package?: string;
    arguments: HasPermissionArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        permission: RawTransactionArgument<number>,
        nowMs: RawTransactionArgument<number | bigint>
    ];
}
export function hasPermission(options: HasPermissionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u32',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "permission", "nowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_permission',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EffectiveProtocolPermissionsArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    nowMs: RawTransactionArgument<number | bigint>;
}
export interface EffectiveProtocolPermissionsOptions {
    package?: string;
    arguments: EffectiveProtocolPermissionsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        nowMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Per-protocol effective permissions (used by protocol modules). Owner →
 * `PERM_ALL` for any protocol. Delegate → the bitmap stored at
 * `protocol_permissions[TypeName(PROTOCOL)]`, or `PERM_NONE` if absent or expired.
 * Stranger → `PERM_NONE`.
 */
export function effectiveProtocolPermissions(options: EffectiveProtocolPermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "nowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'effective_protocol_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasProtocolPermissionArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
    permission: RawTransactionArgument<number>;
    nowMs: RawTransactionArgument<number | bigint>;
}
export interface HasProtocolPermissionOptions {
    package?: string;
    arguments: HasProtocolPermissionArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>,
        permission: RawTransactionArgument<number>,
        nowMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function hasProtocolPermission(options: HasProtocolPermissionOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'address',
        'u32',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "addr", "permission", "nowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_protocol_permission',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountBalanceArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountBalanceOptions {
    package?: string;
    arguments: AccountBalanceArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function accountBalance(options: AccountBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountBalancesArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface AccountBalancesOptions {
    package?: string;
    arguments: AccountBalancesArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
}
export function accountBalances(options: AccountBalancesOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_balances',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BalanceArguments {
    registry: RawTransactionArgument<string>;
}
export interface BalanceOptions {
    package?: string;
    arguments: BalanceArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Total `Balance<T>` currently held across all accounts. Counter; not derived from
 * iterating accounts. Excludes balance held by protocols (after `take`) and
 * balance sitting in hot-potato requests in flight.
 */
export function balance(options: BalanceOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AccountOwnerArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountOwnerOptions {
    package?: string;
    arguments: AccountOwnerArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountOwner(options: AccountOwnerOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_owner',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountAliasArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountAliasOptions {
    package?: string;
    arguments: AccountAliasArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountAlias(options: AccountAliasOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_alias',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountAddressArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountAddressOptions {
    package?: string;
    arguments: AccountAddressArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountAddress(options: AccountAddressOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_address',
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
export function accountDelegates(options: AccountDelegatesOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_delegates',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountBalancesFieldArguments {
    account: RawTransactionArgument<string>;
}
export interface AccountBalancesFieldOptions {
    package?: string;
    arguments: AccountBalancesFieldArguments | [
        account: RawTransactionArgument<string>
    ];
}
export function accountBalancesField(options: AccountBalancesFieldOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'account_balances_field',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateAddressArguments {
    delegate: TransactionArgument;
}
export interface DelegateAddressOptions {
    package?: string;
    arguments: DelegateAddressArguments | [
        delegate: TransactionArgument
    ];
}
export function delegateAddress(options: DelegateAddressOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delegate_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateAliasArguments {
    delegate: TransactionArgument;
}
export interface DelegateAliasOptions {
    package?: string;
    arguments: DelegateAliasArguments | [
        delegate: TransactionArgument
    ];
}
export function delegateAlias(options: DelegateAliasOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delegate_alias',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegatePermissionsArguments {
    delegate: TransactionArgument;
}
export interface DelegatePermissionsOptions {
    package?: string;
    arguments: DelegatePermissionsArguments | [
        delegate: TransactionArgument
    ];
}
export function delegatePermissions(options: DelegatePermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delegate_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateProtocolPermissionsArguments {
    delegate: TransactionArgument;
}
export interface DelegateProtocolPermissionsOptions {
    package?: string;
    arguments: DelegateProtocolPermissionsArguments | [
        delegate: TransactionArgument
    ];
}
export function delegateProtocolPermissions(options: DelegateProtocolPermissionsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delegate_protocol_permissions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DelegateExpiresAtMsArguments {
    delegate: TransactionArgument;
}
export interface DelegateExpiresAtMsOptions {
    package?: string;
    arguments: DelegateExpiresAtMsArguments | [
        delegate: TransactionArgument
    ];
}
export function delegateExpiresAtMs(options: DelegateExpiresAtMsOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["delegate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'delegate_expires_at_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DepositRequestAccountIdArguments {
    r: TransactionArgument;
}
export interface DepositRequestAccountIdOptions {
    package?: string;
    arguments: DepositRequestAccountIdArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function depositRequestAccountId(options: DepositRequestAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_request_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositRequestBalanceArguments {
    r: TransactionArgument;
}
export interface DepositRequestBalanceOptions {
    package?: string;
    arguments: DepositRequestBalanceArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function depositRequestBalance(options: DepositRequestBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_request_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositRequestAmountArguments {
    r: TransactionArgument;
}
export interface DepositRequestAmountOptions {
    package?: string;
    arguments: DepositRequestAmountArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function depositRequestAmount(options: DepositRequestAmountOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_request_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositRequestExtraDataArguments {
    r: TransactionArgument;
}
export interface DepositRequestExtraDataOptions {
    package?: string;
    arguments: DepositRequestExtraDataArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function depositRequestExtraData(options: DepositRequestExtraDataOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_request_extra_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawRequestAccountIdArguments {
    r: TransactionArgument;
}
export interface WithdrawRequestAccountIdOptions {
    package?: string;
    arguments: WithdrawRequestAccountIdArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function withdrawRequestAccountId(options: WithdrawRequestAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_request_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawRequestBalanceArguments {
    r: TransactionArgument;
}
export interface WithdrawRequestBalanceOptions {
    package?: string;
    arguments: WithdrawRequestBalanceArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function withdrawRequestBalance(options: WithdrawRequestBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_request_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawRequestAmountArguments {
    r: TransactionArgument;
}
export interface WithdrawRequestAmountOptions {
    package?: string;
    arguments: WithdrawRequestAmountArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function withdrawRequestAmount(options: WithdrawRequestAmountOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_request_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawRequestRecipientArguments {
    r: TransactionArgument;
}
export interface WithdrawRequestRecipientOptions {
    package?: string;
    arguments: WithdrawRequestRecipientArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function withdrawRequestRecipient(options: WithdrawRequestRecipientOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_request_recipient',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawRequestExtraDataArguments {
    r: TransactionArgument;
}
export interface WithdrawRequestExtraDataOptions {
    package?: string;
    arguments: WithdrawRequestExtraDataArguments | [
        r: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
export function withdrawRequestExtraData(options: WithdrawRequestExtraDataOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_request_extra_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NewDataArguments<PROTOCOL extends BcsType<any>, ProtocolData extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<PROTOCOL>;
    data: RawTransactionArgument<ProtocolData>;
}
export interface NewDataOptions<PROTOCOL extends BcsType<any>, ProtocolData extends BcsType<any>> {
    package?: string;
    arguments: NewDataArguments<PROTOCOL, ProtocolData> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<PROTOCOL>,
        data: RawTransactionArgument<ProtocolData>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function newData<PROTOCOL extends BcsType<any>, ProtocolData extends BcsType<any>>(options: NewDataOptions<PROTOCOL, ProtocolData>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        `${options.typeArguments[0]}`,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "Witness", "data"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'new_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowDataArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface BorrowDataOptions {
    package?: string;
    arguments: BorrowDataArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowData(options: BorrowDataOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'borrow_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowDataMutArguments<PROTOCOL extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<PROTOCOL>;
}
export interface BorrowDataMutOptions<PROTOCOL extends BcsType<any>> {
    package?: string;
    arguments: BorrowDataMutArguments<PROTOCOL> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<PROTOCOL>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function borrowDataMut<PROTOCOL extends BcsType<any>>(options: BorrowDataMutOptions<PROTOCOL>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'borrow_data_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasDataArguments {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
}
export interface HasDataOptions {
    package?: string;
    arguments: HasDataArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function hasData(options: HasDataOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'has_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveDataArguments<PROTOCOL extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<PROTOCOL>;
}
export interface RemoveDataOptions<PROTOCOL extends BcsType<any>> {
    package?: string;
    arguments: RemoveDataArguments<PROTOCOL> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<PROTOCOL>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function removeData<PROTOCOL extends BcsType<any>>(options: RemoveDataOptions<PROTOCOL>) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        `${options.typeArguments[0]}`
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "Witness"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'remove_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}