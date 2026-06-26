/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as balance from './deps/sui/balance.ts';
import * as linked_table from './deps/bucket_v2_framework/linked_table.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as vec_map from './deps/sui/vec_map.ts';
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
        asset_type: type_name.TypeName,
        /**
         * User-supplied minimum acceptable `Coin<T>` output (after the burn fee).
         * Snapshotted into `extra_data` at withdraw time and enforced in `execute_native`,
         * so an admin burn-fee change between enqueue and execute cannot silently reprice
         * an already-debited withdrawal (audit M15).
         */
        min_output: bcs.u64()
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
        executors: vec_set.VecSet(bcs.Address),
        /**
         * Admin-managed package-version allowlist. Every mutating public entry asserts
         * `PACKAGE_VERSION ∈ allowed_versions`; admin uses `add_version` /
         * `remove_version` to kill-switch a deprecated package after a contract upgrade.
         */
        allowed_versions: vec_set.VecSet(bcs.u16())
    } });
export const BridgeFeeKey = new MoveStruct({ name: `${$moduleName}::BridgeFeeKey`, fields: {
        dummy_field: bcs.bool()
    } });
export const BridgeFeeConfig = new MoveStruct({ name: `${$moduleName}::BridgeFeeConfig`, fields: {
        default_rate: float.Float,
        chain_rates: vec_map.VecMap(bcs.u16(), float.Float)
    } });
export const BridgeMinFeeKey = new MoveStruct({ name: `${$moduleName}::BridgeMinFeeKey`, fields: {
        dummy_field: bcs.bool()
    } });
export const BridgeMinFeeConfig = new MoveStruct({ name: `${$moduleName}::BridgeMinFeeConfig`, fields: {
        default_min_fee: bcs.u64(),
        chain_min_fees: vec_map.VecMap(bcs.u16(), bcs.u64())
    } });
export const BridgeFeeUpdated = new MoveStruct({ name: `${$moduleName}::BridgeFeeUpdated<phantom CREDIT>`, fields: {
        /** 1e9-scaled default fee rate now in effect. */
        fee_rate: bcs.u128()
    } });
export const ChainBridgeFeeUpdated = new MoveStruct({ name: `${$moduleName}::ChainBridgeFeeUpdated<phantom CREDIT>`, fields: {
        evm_destination_chain: bcs.u16(),
        fee_rate: bcs.u128(),
        removed: bcs.bool()
    } });
export const BridgeMinFeeUpdated = new MoveStruct({ name: `${$moduleName}::BridgeMinFeeUpdated<phantom CREDIT>`, fields: {
        min_fee: bcs.u64()
    } });
export const ChainBridgeMinFeeUpdated = new MoveStruct({ name: `${$moduleName}::ChainBridgeMinFeeUpdated<phantom CREDIT>`, fields: {
        evm_destination_chain: bcs.u16(),
        min_fee: bcs.u64(),
        removed: bcs.bool()
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
export const BridgeFeeCharged = new MoveStruct({ name: `${$moduleName}::BridgeFeeCharged<phantom CREDIT>`, fields: {
        key: bcs.u64(),
        evm_destination_chain: bcs.u16(),
        amount: bcs.u64(),
        fee_amount: bcs.u64()
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
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'package_version',
    });
}
export interface RouteWormholeArguments {
    evmDestinationChain: RawTransactionArgument<number>;
    evmRecipient: RawTransactionArgument<Array<number>>;
    evmToken: RawTransactionArgument<Array<number>>;
}
export interface RouteWormholeOptions {
    package?: string;
    arguments: RouteWormholeArguments | [
        evmDestinationChain: RawTransactionArgument<number>,
        evmRecipient: RawTransactionArgument<Array<number>>,
        evmToken: RawTransactionArgument<Array<number>>
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
export interface RouteNativeArguments {
    minOutput: RawTransactionArgument<number | bigint>;
}
export interface RouteNativeOptions {
    package?: string;
    arguments: RouteNativeArguments | [
        minOutput: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * User helper: encode a Native-bound route as `extra_data` bytes. `T` is the
 * backing asset of the destination `SingleVault<T>`. `min_output` is the minimum
 * `Coin<T>` the user will accept after the native burn fee; `execute_native`
 * aborts `EOutputBelowMin` if a later fee change would deliver less (audit M15).
 * Pass 0 to opt out.
 */
export function routeNative(options: RouteNativeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["minOutput"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'route_native',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
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
export interface AddVersionArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddVersionOptions {
    package?: string;
    arguments: AddVersionArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: whitelist a package version. New deployments add their own version here
 * before the upgrade so in-flight calls don't abort during the rollover window.
 * Skips the version check itself so admin can recover from a stuck state.
 */
export function addVersion(options: AddVersionOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'add_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveVersionArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemoveVersionOptions {
    package?: string;
    arguments: RemoveVersionArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: remove a package version from the allowlist. Kill-switches the prior
 * version after an upgrade. Skips the version check itself so admin can recover
 * from a stuck state.
 */
export function removeVersion(options: RemoveVersionOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'remove_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetBridgeFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    feeRate: RawTransactionArgument<number | bigint>;
}
export interface SetBridgeFeeOptions {
    package?: string;
    arguments: SetBridgeFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        feeRate: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: set the **default** bridge-withdrawal fee charged on the
 * `execute_wormhole` exit for every destination chain that has no explicit
 * per-chain override. `fee_rate` is the 1e9-scaled `Float` value (`0` disables;
 * capped at 10% = `MAX_BRIDGE_FEE_RATE_SCALED`, rejected with `EFeeRateAboveCap`
 * above that — audit L4). Stored in a dynamic field on `Queue.id` so it could be
 * introduced as a package upgrade without touching the published `Queue<CREDIT>`
 * layout. Idempotent. Mirrors the `Float`-as-`u128` public-ABI convention used by
 * `native_custody::custody_vault::set_fee_config`.
 */
export function setBridgeFee(options: SetBridgeFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "feeRate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'set_bridge_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetChainBridgeFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    feeRate: RawTransactionArgument<number | bigint>;
}
export interface SetChainBridgeFeeOptions {
    package?: string;
    arguments: SetChainBridgeFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        feeRate: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: set (or overwrite) a per-chain bridge-fee override for
 * `evm_destination_chain`. Takes precedence over `default_rate` for wormhole exits
 * to that chain. Same `Float`-as-`u128` rate convention and 10% `EFeeRateAboveCap`
 * ceiling as `set_bridge_fee`. To make a chain fee-free while the default is
 * non-zero, set its override to `0` (an override of `0` is distinct from "no
 * override" — the latter falls back to the default). Use `unset_chain_bridge_fee`
 * to drop back to default.
 */
export function setChainBridgeFee(options: SetChainBridgeFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16',
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "evmDestinationChain", "feeRate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'set_chain_bridge_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnsetChainBridgeFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface UnsetChainBridgeFeeOptions {
    package?: string;
    arguments: UnsetChainBridgeFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: drop a per-chain override so `evm_destination_chain` falls back to
 * `default_rate`. Always emits `ChainBridgeFeeUpdated` (audit L3) with `removed`
 * reflecting whether an override was actually present and `fee_rate` set to the
 * resulting **effective** rate for the chain (audit L2) — i.e. the default after a
 * real removal, so indexers don't have to cross-reference
 * `bridge_default_fee_rate`. Functionally a no-op when no override existed.
 */
export function unsetChainBridgeFee(options: UnsetChainBridgeFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'unset_chain_bridge_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetBridgeMinFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    minFee: RawTransactionArgument<number | bigint>;
}
export interface SetBridgeMinFeeOptions {
    package?: string;
    arguments: SetBridgeMinFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        minFee: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: set the **default** minimum-fee floor (absolute CREDIT units) charged on
 * the `execute_wormhole` exit for every destination chain that has no explicit
 * per-chain min-fee override. The charged fee is
 * `max(ceil(rate * amount), min_fee)`, so a non-zero floor with a zero rate is a
 * flat per-exit fee. `0` disables the floor. **No cap** (unlike the rate's 10%
 * `MAX_BRIDGE_FEE_RATE_SCALED`): the floor is an absolute amount, so on small
 * withdrawals it can exceed 10% of the amount by design — and if it meets/exceeds
 * the entry amount, `execute_wormhole`'s net-zero guard aborts
 * `EFeeConsumesEntireAmount` (recoverable via `cancel_entry`). Idempotent.
 */
export function setBridgeMinFee(options: SetBridgeMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "minFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'set_bridge_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetChainBridgeMinFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    minFee: RawTransactionArgument<number | bigint>;
}
export interface SetChainBridgeMinFeeOptions {
    package?: string;
    arguments: SetChainBridgeMinFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        minFee: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: set (or overwrite) a per-chain minimum-fee-floor override for
 * `evm_destination_chain`. Takes precedence over `default_min_fee` for wormhole
 * exits to that chain — on an axis independent of the rate override. Set its
 * override to `0` to exempt a chain from the floor while `default_min_fee` still
 * floors others (distinct from "no override", which falls back to the default).
 * Use `unset_chain_bridge_min_fee` to drop back to the default. Same no-cap
 * semantics as `set_bridge_min_fee`.
 */
export function setChainBridgeMinFee(options: SetChainBridgeMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "evmDestinationChain", "minFee"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'set_chain_bridge_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnsetChainBridgeMinFeeArguments {
    queue: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface UnsetChainBridgeMinFeeOptions {
    package?: string;
    arguments: UnsetChainBridgeMinFeeArguments | [
        queue: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: drop a per-chain min-fee override so `evm_destination_chain` falls back
 * to `default_min_fee`. Always emits `ChainBridgeMinFeeUpdated` with `removed`
 * reflecting whether an override was actually present and `min_fee` set to the
 * resulting **effective** floor for the chain (the default after a real removal).
 * Functionally a no-op when no override existed.
 */
export function unsetChainBridgeMinFee(options: UnsetChainBridgeMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "_", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'unset_chain_bridge_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelEntryArguments {
    queue: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    request: TransactionArgument;
    key: RawTransactionArgument<number | bigint>;
}
export interface CancelEntryOptions {
    package?: string;
    arguments: CancelEntryArguments | [
        queue: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        request: TransactionArgument,
        key: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Refund a parked entry's `Balance<CREDIT>` back to the **originating wxa
 * account** when the entry can no longer be executed — e.g. the `extra_data` body
 * is malformed (handcrafted by the caller instead of via `route_*`), or admin has
 * since `remove_trusted_emitter`'d the destination chain or
 * `set_asset_deprecated`'d the native asset. Without this, such entries
 * permanently lock both the balance and the queue slot (audit finding #5).
 *
 * Auth: either a registered queue keeper (`request.address() ∈  queue.executors`)
 * OR an address authorized on the originating wxa account
 * (`account_registry.is_account_authorized(entry.account_id,  caller, now)` —
 * owner or non-expired delegate). The user can self-cancel without waiting for the
 * keeper, and the keeper can clean up stale entries proactively.
 *
 * The refund goes to `Entry.account_id` (the originating wxa account), not
 * `Entry.recipient` (the external destination the user picked) —
 * `request_withdraw<CREDIT>` debited the user's account on enqueue, so the
 * symmetric cancel re-credits that same account. The user can re-issue
 * `request_withdraw` from the restored stored balance once the route is fixed.
 */
export function cancelEntry(options: CancelEntryOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "accountRegistry", "request", "key"];
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
    req: TransactionArgument;
}
export interface EnqueueOptions {
    package?: string;
    arguments: EnqueueArguments | [
        queue: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        req: TransactionArgument
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
    request: TransactionArgument;
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
        request: TransactionArgument,
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
    request: TransactionArgument;
    vault: RawTransactionArgument<string>;
    creditRegistry: RawTransactionArgument<string>;
}
export interface ExecuteNativeOptions {
    package?: string;
    arguments: ExecuteNativeArguments | [
        queue: RawTransactionArgument<string>,
        key: RawTransactionArgument<number | bigint>,
        request: TransactionArgument,
        vault: RawTransactionArgument<string>,
        creditRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Execute a queued entry via `native_custody::custody_vault::burn<T>`. Decodes the
 * native route, verifying its `asset_type` matches `T` — if `T` was not the
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
    entry: TransactionArgument;
}
export interface EntryAmountOptions {
    package?: string;
    arguments: EntryAmountArguments | [
        entry: TransactionArgument
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
    entry: TransactionArgument;
}
export interface EntryAccountIdOptions {
    package?: string;
    arguments: EntryAccountIdArguments | [
        entry: TransactionArgument
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
    entry: TransactionArgument;
}
export interface EntryRecipientOptions {
    package?: string;
    arguments: EntryRecipientArguments | [
        entry: TransactionArgument
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
    entry: TransactionArgument;
}
export interface EntryExtraDataOptions {
    package?: string;
    arguments: EntryExtraDataArguments | [
        entry: TransactionArgument
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
    extraData: RawTransactionArgument<Array<number>>;
}
export interface RouteTagOptions {
    package?: string;
    arguments: RouteTagArguments | [
        extraData: RawTransactionArgument<Array<number>>
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
export interface BridgeFeeRateArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface BridgeFeeRateOptions {
    package?: string;
    arguments: BridgeFeeRateArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * The **effective** bridge-fee rate for `evm_destination_chain` as a 1e9-scaled
 * `u128`: the per-chain override if one is set, else the default rate, else `0`
 * when no fee config exists. Mirrors the `Float`-as-`u128` ABI convention.
 */
export function bridgeFeeRate(options: BridgeFeeRateOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_fee_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeDefaultFeeRateArguments {
    queue: RawTransactionArgument<string>;
}
export interface BridgeDefaultFeeRateOptions {
    package?: string;
    arguments: BridgeDefaultFeeRateArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * The configured **default** rate (all-chains-without-override) as a 1e9-scaled
 * `u128`; `0` when no fee config exists.
 */
export function bridgeDefaultFeeRate(options: BridgeDefaultFeeRateOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_default_fee_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasChainBridgeFeeArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface HasChainBridgeFeeOptions {
    package?: string;
    arguments: HasChainBridgeFeeArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Whether `evm_destination_chain` has an explicit per-chain override (distinct
 * from falling back to the default).
 */
export function hasChainBridgeFee(options: HasChainBridgeFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'has_chain_bridge_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeFeeAmountArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface BridgeFeeAmountOptions {
    package?: string;
    arguments: BridgeFeeAmountArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * The bridge fee that would be charged on a wormhole exit of `amount` CREDIT to
 * `evm_destination_chain` —
 * `max(ceil(effective_rate * amount),  effective_min_fee)`, or `0` when both the
 * effective rate and floor are zero (and always `0` on `amount == 0`). NOTE: this
 * is the _raw_ fee; it can equal or exceed `amount` (`ceil` rounding on a 1-unit
 * dust entry, or a min-fee floor larger than the entry), in which case
 * `execute_wormhole` would abort the net-zero guard. SDKs surfacing an "estimated
 * fee" should gate on `would_execute_wormhole` (audit L1).
 */
export function bridgeFeeAmount(options: BridgeFeeAmountOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_fee_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WouldExecuteWormholeArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WouldExecuteWormholeOptions {
    package?: string;
    arguments: WouldExecuteWormholeArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Whether `execute_wormhole` would clear the net-zero guard for an exit of
 * `amount` to `evm_destination_chain` — i.e. a strictly positive amount remains
 * after the fee. `false` ⇒ `execute_wormhole` would abort
 * `EFeeConsumesEntireAmount` (and `amount == 0` is also `false`). SDKs should gate
 * "estimated fee" UI on this rather than `bridge_fee_amount` alone (audit L1).
 */
export function wouldExecuteWormhole(options: WouldExecuteWormholeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'would_execute_wormhole',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeChainRatesArguments {
    queue: RawTransactionArgument<string>;
}
export interface BridgeChainRatesOptions {
    package?: string;
    arguments: BridgeChainRatesArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Enumerate the per-chain overrides as parallel vectors of
 * `(evm_destination_chain, 1e9-scaled rate)`, in insertion order. Empty when no
 * overrides are set (or no fee config exists). The default rate is separate — see
 * `bridge_default_fee_rate` (audit N1). Lets off-chain config tooling discover
 * which chains carry overrides without probing every chain id.
 */
export function bridgeChainRates(options: BridgeChainRatesOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_chain_rates',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeMinFeeArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface BridgeMinFeeOptions {
    package?: string;
    arguments: BridgeMinFeeArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * The **effective** minimum-fee floor (absolute CREDIT units) for
 * `evm_destination_chain`: the per-chain override if one is set, else the default
 * floor, else `0` when no fee config exists.
 */
export function bridgeMinFee(options: BridgeMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeDefaultMinFeeArguments {
    queue: RawTransactionArgument<string>;
}
export interface BridgeDefaultMinFeeOptions {
    package?: string;
    arguments: BridgeDefaultMinFeeArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * The configured **default** minimum-fee floor (all-chains-without-override) in
 * CREDIT units; `0` when no fee config exists.
 */
export function bridgeDefaultMinFee(options: BridgeDefaultMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_default_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasChainBridgeMinFeeArguments {
    queue: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
}
export interface HasChainBridgeMinFeeOptions {
    package?: string;
    arguments: HasChainBridgeMinFeeArguments | [
        queue: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Whether `evm_destination_chain` has an explicit per-chain min-fee override
 * (distinct from falling back to the default floor).
 */
export function hasChainBridgeMinFee(options: HasChainBridgeMinFeeOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["queue", "evmDestinationChain"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'has_chain_bridge_min_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BridgeChainMinFeesArguments {
    queue: RawTransactionArgument<string>;
}
export interface BridgeChainMinFeesOptions {
    package?: string;
    arguments: BridgeChainMinFeesArguments | [
        queue: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Enumerate the per-chain min-fee overrides as parallel vectors of
 * `(evm_destination_chain, min_fee)`, in insertion order. Empty when none are set
 * (or no fee config exists). The default floor is separate — see
 * `bridge_default_min_fee`. Lets off-chain config tooling discover which chains
 * carry min-fee overrides without probing every chain id.
 */
export function bridgeChainMinFees(options: BridgeChainMinFeesOptions) {
    const packageAddress = options.package ?? '@waterx/withdrawal-queue';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["queue"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'withdrawal_queue',
        function: 'bridge_chain_min_fees',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}