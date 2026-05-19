/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as balance from './deps/sui/balance.ts';
import * as linked_table from './deps/bucket_v2_framework/linked_table.ts';
import * as vec_set from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/withdrawal-queue::withdrawal_queue';
export const WithdrawQueue = new MoveStruct({ name: `${$moduleName}::WithdrawQueue`, fields: {
        dummy_field: bcs.bool()
    } });
export const WormholeRoute = new MoveStruct({ name: `${$moduleName}::WormholeRoute`, fields: {
        evm_destination_chain: bcs.u16(),
        evm_recipient: bcs.vector(bcs.u8()),
        evm_token: bcs.vector(bcs.u8())
    } });
export const NativeRoute = new MoveStruct({ name: `${$moduleName}::NativeRoute`, fields: {
        asset_type: type_name.TypeName
    } });
export const Entry = new MoveStruct({ name: `${$moduleName}::Entry<phantom CREDIT>`, fields: {
        balance: balance.Balance,
        /**
         * Originating wxa Account whose stored `Balance<CREDIT>` produced this entry.
         * Threaded into `vault.burn` / `bridge.burn_for_withdrawal` so the burner identity
         * on the credit registry's personal cap, the EVM-side withdrawal id, and the
         * partner-fee lookup all bind to the source account — not whoever calls
         * `execute_*` (audit finding #3).
         */
        account_id: bcs.Address,
        /**
         * Sui-side recipient from `WithdrawRequest`. Honored for Native payouts; ignored
         * for Wormhole (EVM recipient lives in extra_data).
         */
        recipient: bcs.Address,
        extra_data: bcs.vector(bcs.u8())
    } });
export const Queue = new MoveStruct({ name: `${$moduleName}::Queue<phantom CREDIT>`, fields: {
        id: bcs.Address,
        next_key: bcs.u64(),
        entries: linked_table.LinkedTable(bcs.u64()),
        /**
         * Admin-managed allowlist of addresses authorized to call `execute_wormhole` /
         * `execute_native`. Without this gate any caller could route any user's queue
         * entry through the burn path (audit finding #3).
         */
        executors: vec_set.VecSet(bcs.Address)
    } });
export const Enqueued = new MoveStruct({ name: `${$moduleName}::Enqueued<phantom CREDIT>`, fields: {
        key: bcs.u64(),
        account_id: bcs.Address,
        recipient: bcs.Address,
        amount: bcs.u64(),
        route_tag: bcs.u8()
    } });
export const ExecutedWormhole = new MoveStruct({ name: `${$moduleName}::ExecutedWormhole<phantom CREDIT>`, fields: {
        key: bcs.u64(),
        evm_destination_chain: bcs.u16(),
        amount: bcs.u64()
    } });
export const ExecutedNative = new MoveStruct({ name: `${$moduleName}::ExecutedNative<phantom CREDIT, phantom T>`, fields: {
        key: bcs.u64(),
        recipient: bcs.Address,
        amount: bcs.u64()
    } });
export const EntryCancelled = new MoveStruct({ name: `${$moduleName}::EntryCancelled<phantom CREDIT>`, fields: {
        key: bcs.u64(),
        account_id: bcs.Address,
        amount: bcs.u64(),
        route_tag: bcs.u8()
    } });
export const ExecutorUpdated = new MoveStruct({ name: `${$moduleName}::ExecutorUpdated<phantom CREDIT>`, fields: {
        executor: bcs.Address,
        added: bcs.bool()
    } });
export interface RouteWormholeArguments {
    evmDestinationChain: RawTransactionArgument<number>;
    evmRecipient: RawTransactionArgument<number[]>;
    evmToken: RawTransactionArgument<number[]>;
}
export interface RouteWormholeOptions {
    package?: string;
    arguments: RouteWormholeArguments | [
        evmDestinationChain: RawTransactionArgument<number>,
        evmRecipient: RawTransactionArgument<number[]>,
        evmToken: RawTransactionArgument<number[]>
    ];
}
/** User helper: encode a Wormhole-bound route as `extra_data` bytes. */
export function routeWormhole(options: RouteWormholeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        'u16',
        'vector<u8>',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["evmDestinationChain", "evmRecipient", "evmToken"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'route_wormhole',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RouteNativeOptions {
    package?: string;
    arguments?: [
    ];
    typeArguments: [
        string
    ];
}
/**
 * User helper: encode a Native-bound route as `extra_data` bytes. `T` is the
 * backing asset of the destination `SingleVault<T>`.
 */
export function routeNative(options: RouteNativeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'route_native',
        typeArguments: options.typeArguments
    });
}
export interface CreateQueueArguments {
    _: RawTransactionArgument<string>;
}
export interface CreateQueueOptions {
    package?: string;
    arguments: CreateQueueArguments | [
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Create + share a `Queue<CREDIT>`. Call once per credit type. */
export function createQueue(options: CreateQueueOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'create_queue',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddExecutorArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    executor: RawTransactionArgument<string>;
}
export interface AddExecutorOptions {
    package?: string;
    arguments: AddExecutorArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        executor: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function addExecutor(options: AddExecutorOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "executor"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'add_executor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveExecutorArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    executor: RawTransactionArgument<string>;
}
export interface RemoveExecutorOptions {
    package?: string;
    arguments: RemoveExecutorArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        executor: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function removeExecutor(options: RemoveExecutorOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "executor"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'remove_executor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsExecutorArguments {
    queue: RawTransactionArgument<string>;
    executor: RawTransactionArgument<string>;
}
export interface IsExecutorOptions {
    package?: string;
    arguments: IsExecutorArguments | [
        queue: RawTransactionArgument<string>,
        executor: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isExecutor(options: IsExecutorOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "executor"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'is_executor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelEntryArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    key: RawTransactionArgument<number | bigint>;
}
export interface CancelEntryOptions {
    package?: string;
    arguments: CancelEntryArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin escape hatch (audit finding #5): refund a parked entry's `Balance<CREDIT>`
 * to a recipient address when the entry can no longer be executed — e.g. the
 * `extra_data` body is malformed (handcrafted by the caller instead of via
 * `route_*`), or admin has since `remove_trusted_emitter`'d the destination chain
 * or `set_asset_deprecated`'d the native asset. Without this, such entries
 * permanently lock both the balance and the queue slot. Recipient is
 * `Entry.recipient` (the address the original `request_withdraw` named).
 */
export function cancelEntry(options: CancelEntryOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'cancel_entry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EnqueueArguments {
    queue: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
}
export interface EnqueueOptions {
    package?: string;
    arguments: EnqueueArguments | [
        queue: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Consume a `WithdrawRequest<CREDIT>` registered to `WithdrawQueue` and park its
 * balance + extra_data. Returns the assigned key. Aborts with `EUnknownRoute` if
 * `extra_data`'s leading tag byte is not a known route.
 */
export function enqueue(options: EnqueueOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "registry", "req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'enqueue',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteWormholeArguments {
    queue: RawTransactionArgument<string>;
    key: RawTransactionArgument<number | bigint>;
    request: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    creditRegistry: RawTransactionArgument<string>;
    wormholeState: RawTransactionArgument<string>;
    wormholeFee: RawTransactionArgument<string>;
}
export interface ExecuteWormholeOptions {
    package?: string;
    arguments: ExecuteWormholeArguments | [
        queue: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>,
        request: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        creditRegistry: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        wormholeFee: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Execute a queued entry via `wormhole_bridge::burn_for_withdrawal`. Peels the
 * Wormhole route fields out of `extra_data`. Aborts with `ERouteMismatch` if the
 * entry was not Wormhole-routed. `request.address()` must be on the queue's
 * executor allowlist (audit finding #3); the originating `Entry.account_id` is
 * what the burn path uses for cap accounting / withdrawal id.
 */
export function executeWormhole(options: ExecuteWormholeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u64',
        null,
        null,
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "key", "request", "bridge", "creditRegistry", "wormholeState", "wormholeFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'execute_wormhole',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ExecuteNativeArguments {
    queue: RawTransactionArgument<string>;
    key: RawTransactionArgument<number | bigint>;
    request: RawTransactionArgument<string>;
    vault: RawTransactionArgument<string>;
    creditRegistry: RawTransactionArgument<string>;
}
export interface ExecuteNativeOptions {
    package?: string;
    arguments: ExecuteNativeArguments | [
        queue: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>,
        request: RawTransactionArgument<string>,
        vault: RawTransactionArgument<string>,
        creditRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Execute a queued entry via `native_custody::custody_vault::burn<T>`. Verifies
 * that `extra_data` byte-equals `route_native<T>()` — if `T` was not the
 * asset_type the user specified, aborts with `ERouteMismatch`.
 */
export function executeNative(options: ExecuteNativeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u64',
        null,
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "key", "request", "vault", "creditRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'execute_native',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LengthArguments {
    queue: RawTransactionArgument<string>;
}
export interface LengthOptions {
    package?: string;
    arguments: LengthArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function length(options: LengthOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'length',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsEmptyArguments {
    queue: RawTransactionArgument<string>;
}
export interface IsEmptyOptions {
    package?: string;
    arguments: IsEmptyArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function isEmpty(options: IsEmptyOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'is_empty',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FrontArguments {
    queue: RawTransactionArgument<string>;
}
export interface FrontOptions {
    package?: string;
    arguments: FrontArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function front(options: FrontOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ContainsArguments {
    queue: RawTransactionArgument<string>;
    key: RawTransactionArgument<number | bigint>;
}
export interface ContainsOptions {
    package?: string;
    arguments: ContainsArguments | [
        queue: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function contains(options: ContainsOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'contains',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntryArguments {
    queue: RawTransactionArgument<string>;
    key: RawTransactionArgument<number | bigint>;
}
export interface EntryOptions {
    package?: string;
    arguments: EntryArguments | [
        queue: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function entry(options: EntryOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "key"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'entry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntryAmountArguments {
    entry: RawTransactionArgument<string>;
}
export interface EntryAmountOptions {
    package?: string;
    arguments: EntryAmountArguments | [
        entry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function entryAmount(options: EntryAmountOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["entry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'entry_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntryAccountIdArguments {
    entry: RawTransactionArgument<string>;
}
export interface EntryAccountIdOptions {
    package?: string;
    arguments: EntryAccountIdArguments | [
        entry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function entryAccountId(options: EntryAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["entry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'entry_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntryRecipientArguments {
    entry: RawTransactionArgument<string>;
}
export interface EntryRecipientOptions {
    package?: string;
    arguments: EntryRecipientArguments | [
        entry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function entryRecipient(options: EntryRecipientOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["entry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'entry_recipient',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntryExtraDataArguments {
    entry: RawTransactionArgument<string>;
}
export interface EntryExtraDataOptions {
    package?: string;
    arguments: EntryExtraDataArguments | [
        entry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function entryExtraData(options: EntryExtraDataOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["entry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'entry_extra_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RouteTagArguments {
    extraData: RawTransactionArgument<number[]>;
}
export interface RouteTagOptions {
    package?: string;
    arguments: RouteTagArguments | [
        extraData: RawTransactionArgument<number[]>
    ];
}
/**
 * Returns the leading route tag byte; aborts if `extra_data` is empty or carries
 * an unknown tag.
 */
export function routeTag(options: RouteTagOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'route_tag',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}