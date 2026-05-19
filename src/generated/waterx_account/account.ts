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
 * `Coin<USDC>` into `Balance<USDX>` and credits the account via `put<USDX, P>`).
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
import { type Transaction } from '@mysten/sui/transactions';
import * as table from './deps/sui/table.ts';
import * as table_1 from './deps/sui/table.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as type_name from './deps/std/type_name.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as type_name_2 from './deps/std/type_name.ts';
import * as vec_map_1 from './deps/sui/vec_map.ts';
import * as type_name_3 from './deps/std/type_name.ts';
import * as type_name_4 from './deps/std/type_name.ts';
import * as vec_map_2 from './deps/sui/vec_map.ts';
import * as type_name_5 from './deps/std/type_name.ts';
import * as vec_set_1 from './deps/sui/vec_set.ts';
import * as vec_set_2 from './deps/sui/vec_set.ts';
import * as vec_map_3 from './deps/sui/vec_map.ts';
import * as type_name_6 from './deps/std/type_name.ts';
import * as vec_map_4 from './deps/sui/vec_map.ts';
import * as type_name_7 from './deps/std/type_name.ts';
import * as balance_1 from './deps/sui/balance.ts';
import * as balance_2 from './deps/sui/balance.ts';
const $moduleName = '@waterx/account::account';
export const ACCOUNT = new MoveStruct({ name: `${$moduleName}::ACCOUNT`, fields: {
        dummy_field: bcs.bool()
    } });
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export const AccountRegistry = new MoveStruct({ name: `${$moduleName}::AccountRegistry`, fields: {
        id: bcs.Address,
        accounts: table.Table,
        owner_index: table_1.Table,
        /**
         * Admin-managed whitelist of protocol witness types allowed to move funds
         * (`take<T, P>` / `put<T, P>`) and mutate per-account protocol data
         * (`new_data<P, D>` / `borrow_data_mut<P, D>` / `remove_data<P, D>`).
         * Witness-construction privacy alone is not sufficient — any package can deploy
         * its own witness type, so without this whitelist any deployed module could drain
         * any account. Admin opts each protocol in once via
         * `whitelist_protocol<P>(&AdminCap, registry, clock)`.
         */
        protocol_whitelist: vec_set.VecSet(type_name.TypeName),
        /**
         * `T → registered DepositPolicy witness TypeName`. Presence means
         * `request_deposit<T>` / `request_deposit_from_receivings<T>` are permitted; only
         * the module that defines the registered witness type can call
         * `consume_deposit<T, P>` to unwrap the resulting `DepositRequest<T>`. Deposit
         * policy registration is independent of `protocol_whitelist` — a policy can be the
         * _consumer_ of a request without being allowed to `take`/`put`.
         */
        deposit_policies: vec_map.VecMap(type_name_1.TypeName, type_name_2.TypeName),
        /**
         * `T → registered WithdrawPolicy witness TypeName`. Symmetric to
         * `deposit_policies` for `request_withdraw<T>` / `consume_withdraw`.
         */
        withdraw_policies: vec_map_1.VecMap(type_name_3.TypeName, type_name_4.TypeName),
        /**
         * Per-T aggregate of `Balance<T>` currently held inside accounts. Incremented in
         * `put<T, P>`, decremented in `take<T, P>` and `request_withdraw<T>`. Does _not_
         * include balance held by protocols (after `take`) or sitting in flight inside a
         * `DepositRequest` / `WithdrawRequest` hot potato.
         */
        balances: vec_map_2.VecMap(type_name_5.TypeName, bcs.u64()),
        allowed_versions: vec_set_1.VecSet(bcs.u16()),
        managers: vec_set_2.VecSet(bcs.Address),
        paused: bcs.bool()
    } });
export const BalanceKey = new MoveTuple({ name: `${$moduleName}::BalanceKey<phantom T>`, fields: [bcs.bool()] });
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
        protocol_permissions: vec_map_3.VecMap(type_name_6.TypeName, bcs.u32()),
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
        balances: vec_map_4.VecMap(type_name_7.TypeName, bcs.u64())
    } });
export const DepositRequest = new MoveStruct({ name: `${$moduleName}::DepositRequest<phantom T>`, fields: {
        account_id: bcs.Address,
        balance: balance_1.Balance,
        extra_data: bcs.vector(bcs.u8())
    } });
export const WithdrawRequest = new MoveStruct({ name: `${$moduleName}::WithdrawRequest<phantom T>`, fields: {
        account_id: bcs.Address,
        balance: balance_2.Balance,
        recipient: bcs.Address,
        extra_data: bcs.vector(bcs.u8())
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
    managerRequest: RawTransactionArgument<string>;
}
export interface PauseOptions {
    package?: string;
    arguments: PauseArguments | [
        registry: RawTransactionArgument<string>,
        managerRequest: RawTransactionArgument<string>
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
 * Admin: add witness type `P` to the protocol whitelist. Only modules whose
 * witness type is whitelisted can call `take` / `put` and the witness-gated
 * data-slot helpers. Strict — aborts if `P` is already listed.
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
 * Admin: remove witness type `P` from the protocol whitelist. After this, every
 * `take<T, P>` / `put<T, P>` and witness-gated data-slot call aborts. Existing
 * data slots and protocol-held balances are untouched — only future calls are
 * blocked, so admin can pause a misbehaving protocol without stranding state on
 * accounts.
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
export interface DepositPolicyArguments {
    registry: RawTransactionArgument<string>;
}
export interface DepositPolicyOptions {
    package?: string;
    arguments: DepositPolicyArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function depositPolicy(options: DepositPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'deposit_policy',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawPolicyArguments {
    registry: RawTransactionArgument<string>;
}
export interface WithdrawPolicyOptions {
    package?: string;
    arguments: WithdrawPolicyArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function withdrawPolicy(options: WithdrawPolicyOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'account',
        function: 'withdraw_policy',
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
 * Admin: register witness type `P` as the deposit policy for `T`. Only the module
 * that defines `P` can construct one, so this binds `T`'s deposit flow exclusively
 * to that module. Aborts if `T` is already registered — admin must
 * `unregister_deposit_policy<T>` first to swap.
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
        string
    ];
}
/**
 * Admin: remove the deposit policy for `T`. Existing `Balance<T>` on accounts is
 * unaffected; only new `request_deposit<T>` is blocked.
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
    senderRequest: RawTransactionArgument<string>;
    alias: RawTransactionArgument<string>;
}
export interface CreateAccountOptions {
    package?: string;
    arguments: CreateAccountArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
export interface SetAliasArguments {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    alias: RawTransactionArgument<string>;
}
export interface SetAliasOptions {
    package?: string;
    arguments: SetAliasArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
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
        senderRequest: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
}
export interface RemoveDelegateOptions {
    package?: string;
    arguments: RemoveDelegateArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
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
        senderRequest: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
    permissions: RawTransactionArgument<number>;
}
export interface SetDelegateProtocolPermissionOptions {
    package?: string;
    arguments: SetDelegateProtocolPermissionArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    delegateAddress: RawTransactionArgument<string>;
}
export interface UnsetDelegateProtocolPermissionOptions {
    package?: string;
    arguments: UnsetDelegateProtocolPermissionArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
    extraData: RawTransactionArgument<number[]>;
}
export interface RequestDepositOptions {
    package?: string;
    arguments: RequestDepositArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<number[]>
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
    receivings: RawTransactionArgument<string[]>;
    extraData: RawTransactionArgument<number[]>;
}
export interface RequestDepositFromReceivingsOptions {
    package?: string;
    arguments: RequestDepositFromReceivingsArguments | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        receivings: RawTransactionArgument<string[]>,
        extraData: RawTransactionArgument<number[]>
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
export interface ConsumeDepositArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<P>;
}
export interface ConsumeDepositOptions<P extends BcsType<any>> {
    package?: string;
    arguments: ConsumeDepositArguments<P> | [
        registry: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    recipient: RawTransactionArgument<string>;
    extraData: RawTransactionArgument<number[]>;
}
export interface RequestWithdrawOptions {
    package?: string;
    arguments: RequestWithdrawArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        recipient: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<number[]>
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
    req: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<P>;
}
export interface ConsumeWithdrawOptions<P extends BcsType<any>> {
    package?: string;
    arguments: ConsumeWithdrawArguments<P> | [
        registry: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>,
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
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    receiving: RawTransactionArgument<string>;
}
export interface ReceiveOptions {
    package?: string;
    arguments: ReceiveArguments | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        receiving: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-owner drain of a TTO'd object on the account's UID. Generic over
 * `T: key + store` — works for `Coin<X>`, NFTs, or any other transferable object
 * externally transferred to the account address. Auth: account owner or a
 * `PERM_RECEIVE` delegate (kept separate from `PERM_WITHDRAW` so reward-collection
 * rights don't imply balance-drain rights). Returns the received object to the
 * caller's PTB. Bypasses the deposit-policy flow — use this for tokens / objects
 * that have no registered deposit policy (e.g. reward coins TTO'd via
 * `transfer_coin` from a protocol's claim path).
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
export interface TakeArguments<P extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    Witness: RawTransactionArgument<P>;
}
export interface TakeOptions<P extends BcsType<any>> {
    package?: string;
    arguments: TakeArguments<P> | [
        registry: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
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
    bal: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<P>;
}
export interface PutOptions<P extends BcsType<any>> {
    package?: string;
    arguments: PutArguments<P> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        bal: RawTransactionArgument<string>,
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
    delegate: RawTransactionArgument<string>;
}
export interface DelegateAddressOptions {
    package?: string;
    arguments: DelegateAddressArguments | [
        delegate: RawTransactionArgument<string>
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
    delegate: RawTransactionArgument<string>;
}
export interface DelegateAliasOptions {
    package?: string;
    arguments: DelegateAliasArguments | [
        delegate: RawTransactionArgument<string>
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
    delegate: RawTransactionArgument<string>;
}
export interface DelegatePermissionsOptions {
    package?: string;
    arguments: DelegatePermissionsArguments | [
        delegate: RawTransactionArgument<string>
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
    delegate: RawTransactionArgument<string>;
}
export interface DelegateProtocolPermissionsOptions {
    package?: string;
    arguments: DelegateProtocolPermissionsArguments | [
        delegate: RawTransactionArgument<string>
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
    delegate: RawTransactionArgument<string>;
}
export interface DelegateExpiresAtMsOptions {
    package?: string;
    arguments: DelegateExpiresAtMsArguments | [
        delegate: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface DepositRequestAccountIdOptions {
    package?: string;
    arguments: DepositRequestAccountIdArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface DepositRequestBalanceOptions {
    package?: string;
    arguments: DepositRequestBalanceArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface DepositRequestAmountOptions {
    package?: string;
    arguments: DepositRequestAmountArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface DepositRequestExtraDataOptions {
    package?: string;
    arguments: DepositRequestExtraDataArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface WithdrawRequestAccountIdOptions {
    package?: string;
    arguments: WithdrawRequestAccountIdArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface WithdrawRequestBalanceOptions {
    package?: string;
    arguments: WithdrawRequestBalanceArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface WithdrawRequestAmountOptions {
    package?: string;
    arguments: WithdrawRequestAmountArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface WithdrawRequestRecipientOptions {
    package?: string;
    arguments: WithdrawRequestRecipientArguments | [
        r: RawTransactionArgument<string>
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
    r: RawTransactionArgument<string>;
}
export interface WithdrawRequestExtraDataOptions {
    package?: string;
    arguments: WithdrawRequestExtraDataArguments | [
        r: RawTransactionArgument<string>
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