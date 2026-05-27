/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as emitter from './deps/wormhole_sdk/emitter.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as vec_map_1 from './deps/sui/vec_map.ts';
import * as consumed_vaas from './deps/wormhole_sdk/consumed_vaas.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as vec_set_1 from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/wormhole-bridge::wormhole_bridge';
export const WormholeBridge = new MoveStruct({ name: `${$moduleName}::WormholeBridge`, fields: {
        dummy_field: bcs.bool()
    } });
export const ChainTokenKey = new MoveStruct({ name: `${$moduleName}::ChainTokenKey`, fields: {
        chain_id: bcs.u16(),
        token: bcs.vector(bcs.u8())
    } });
export const Bridge = new MoveStruct({ name: `${$moduleName}::Bridge`, fields: {
        id: bcs.Address,
        emitter_cap: emitter.EmitterCap,
        trusted_emitters: vec_map.VecMap(bcs.u16(), bcs.vector(bcs.u8())),
        minted_per_token: vec_map_1.VecMap(ChainTokenKey, bcs.u64()),
        consumed_vaas: consumed_vaas.ConsumedVAAs,
        keepers: vec_set.VecSet(bcs.Address),
        hourly_mint_limit: bcs.u64(),
        hourly_minted: bcs.u64(),
        window_start_ms: bcs.u64(),
        max_mint_per_tx: bcs.u64(),
        hourly_burn_limit: bcs.u64(),
        hourly_burned: bcs.u64(),
        window_start_ms_burn: bcs.u64(),
        max_burn_per_tx: bcs.u64(),
        paused: bcs.bool(),
        burn_nonce: bcs.u64(),
        /**
         * Admin-managed package-version allowlist used by admin and keeper paths that
         * don't already thread `&CreditRegistry`. redeem_vaa / burn_for_withdrawal keep
         * the CreditRegistry-based `assert_valid_package` check; this set covers the
         * add_trusted_emitter / remove_trusted_emitter / add_supported_evm_token /
         * remove_supported_evm_token / set_rate_limits / set_paused / emergency_pause /
         * add_keeper / remove_keeper paths.
         */
        allowed_versions: vec_set_1.VecSet(bcs.u16())
    } });
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'package_version',
    });
}
export interface InitBridgeArguments {
    _: RawTransactionArgument<string>;
    wormholeState: RawTransactionArgument<string>;
    hourlyMintLimit: RawTransactionArgument<number | bigint>;
    maxMintPerTx: RawTransactionArgument<number | bigint>;
    hourlyBurnLimit: RawTransactionArgument<number | bigint>;
    maxBurnPerTx: RawTransactionArgument<number | bigint>;
}
export interface InitBridgeOptions {
    package?: string;
    arguments: InitBridgeArguments | [
        _: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        hourlyMintLimit: RawTransactionArgument<number | bigint>,
        maxMintPerTx: RawTransactionArgument<number | bigint>,
        hourlyBurnLimit: RawTransactionArgument<number | bigint>,
        maxBurnPerTx: RawTransactionArgument<number | bigint>
    ];
}
export function initBridge(options: InitBridgeOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "wormholeState", "hourlyMintLimit", "maxMintPerTx", "hourlyBurnLimit", "maxBurnPerTx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'init_bridge',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RedeemVaaArguments {
    bridge: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    wormholeState: RawTransactionArgument<string>;
    vaaBytes: RawTransactionArgument<number[]>;
}
export interface RedeemVaaOptions {
    package?: string;
    arguments: RedeemVaaArguments | [
        bridge: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        vaaBytes: RawTransactionArgument<number[]>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Parse + verify a Wormhole MINT VAA and produce a `DepositRequest<CREDIT>`
 * targeting the payload's `sui_recipient` as an account_id
 * (`object::id_from_address(sui_recipient)`). Returns the hot-potato request which
 * must be consumed in the same PTB by the deposit policy registered for `CREDIT`
 * on the `AccountRegistry`.
 */
export function redeemVaa(options: RedeemVaaOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "registry", "accountRegistry", "wormholeState", "vaaBytes"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'redeem_vaa',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BurnForWithdrawalArguments {
    bridge: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    wormholeState: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    wormholeFee: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    evmRecipient: RawTransactionArgument<number[]>;
    evmToken: RawTransactionArgument<number[]>;
}
export interface BurnForWithdrawalOptions {
    package?: string;
    arguments: BurnForWithdrawalArguments | [
        bridge: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        wormholeFee: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        evmRecipient: RawTransactionArgument<number[]>,
        evmToken: RawTransactionArgument<number[]>
    ];
    typeArguments: [
        string
    ];
}
/**
 * `account_id` identifies the wxa Account whose stored `Balance<CREDIT>` produced
 * this coin. Used as the `burner` identity that lands in `compute_withdrawal_id`,
 * the `WithdrawalInitiated.burner` event field, and the credit registry's
 * personal-burn-cap key — so the EVM-side withdrawal id and Sui-side cap
 * accounting both bind to the originating account, not whoever executes the queue
 * entry (fixes audit finding #3).
 */
export function burnForWithdrawal(options: BurnForWithdrawalOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        null,
        null,
        null,
        'u16',
        'vector<u8>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "registry", "accountId", "wormholeState", "coin", "wormholeFee", "evmDestinationChain", "evmRecipient", "evmToken"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'burn_for_withdrawal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddTrustedEmitterArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    evmBridgeAddress: RawTransactionArgument<number[]>;
}
export interface AddTrustedEmitterOptions {
    package?: string;
    arguments: AddTrustedEmitterArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        evmBridgeAddress: RawTransactionArgument<number[]>
    ];
}
export function addTrustedEmitter(options: AddTrustedEmitterOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "chainId", "evmBridgeAddress"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'add_trusted_emitter',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveTrustedEmitterArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
}
export interface RemoveTrustedEmitterOptions {
    package?: string;
    arguments: RemoveTrustedEmitterArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>
    ];
}
/**
 * Aborts `EOutstandingBacking` if any `minted_per_token` row under this chain
 * still has non-zero backing — symmetric with `remove_supported_evm_token`.
 * Without this guard, an admin pull would orphan EVM-side reserves for tokens
 * still in circulation (audit lead under finding #5).
 */
export function removeTrustedEmitter(options: RemoveTrustedEmitterOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "chainId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'remove_trusted_emitter',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddSupportedEvmTokenArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    token: RawTransactionArgument<number[]>;
}
export interface AddSupportedEvmTokenOptions {
    package?: string;
    arguments: AddSupportedEvmTokenArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<number[]>
    ];
}
export function addSupportedEvmToken(options: AddSupportedEvmTokenOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "chainId", "token"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'add_supported_evm_token',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveSupportedEvmTokenArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    token: RawTransactionArgument<number[]>;
}
export interface RemoveSupportedEvmTokenOptions {
    package?: string;
    arguments: RemoveSupportedEvmTokenArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<number[]>
    ];
}
export function removeSupportedEvmToken(options: RemoveSupportedEvmTokenOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "chainId", "token"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'remove_supported_evm_token',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetRateLimitsArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    newHourlyMint: RawTransactionArgument<number | bigint>;
    newMaxMintPerTx: RawTransactionArgument<number | bigint>;
    newHourlyBurn: RawTransactionArgument<number | bigint>;
    newMaxBurnPerTx: RawTransactionArgument<number | bigint>;
}
export interface SetRateLimitsOptions {
    package?: string;
    arguments: SetRateLimitsArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        newHourlyMint: RawTransactionArgument<number | bigint>,
        newMaxMintPerTx: RawTransactionArgument<number | bigint>,
        newHourlyBurn: RawTransactionArgument<number | bigint>,
        newMaxBurnPerTx: RawTransactionArgument<number | bigint>
    ];
}
export function setRateLimits(options: SetRateLimitsOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "newHourlyMint", "newMaxMintPerTx", "newHourlyBurn", "newMaxBurnPerTx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'set_rate_limits',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPausedArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    paused: RawTransactionArgument<boolean>;
}
export interface SetPausedOptions {
    package?: string;
    arguments: SetPausedArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        paused: RawTransactionArgument<boolean>
    ];
}
export function setPaused(options: SetPausedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "paused"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'set_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface EmergencyPauseArguments {
    bridge: RawTransactionArgument<string>;
    request: RawTransactionArgument<string>;
}
export interface EmergencyPauseOptions {
    package?: string;
    arguments: EmergencyPauseArguments | [
        bridge: RawTransactionArgument<string>,
        request: RawTransactionArgument<string>
    ];
}
export function emergencyPause(options: EmergencyPauseOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "request"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'emergency_pause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddKeeperArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface AddKeeperOptions {
    package?: string;
    arguments: AddKeeperArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
export function addKeeper(options: AddKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'add_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveKeeperArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface RemoveKeeperOptions {
    package?: string;
    arguments: RemoveKeeperArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
export function removeKeeper(options: RemoveKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "bridge", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'remove_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddVersionArguments {
    bridge: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddVersionOptions {
    package?: string;
    arguments: AddVersionArguments | [
        bridge: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
}
/**
 * Admin: whitelist a package version on this bridge. Skips the version check
 * itself so admin can recover from a stuck state.
 *
 * Struct-first param order to match `credit_registry::add_package_version` and
 * `custody_vault::add_version` — same-named cross-package admin API for deploy
 * scripts to template across all three.
 */
export function addVersion(options: AddVersionOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'add_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveVersionArguments {
    bridge: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemoveVersionOptions {
    package?: string;
    arguments: RemoveVersionArguments | [
        bridge: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
}
/**
 * Admin: remove a package version from this bridge's allowlist. Skips the version
 * check itself.
 */
export function removeVersion(options: RemoveVersionOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'remove_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PausedArguments {
    bridge: RawTransactionArgument<string>;
}
export interface PausedOptions {
    package?: string;
    arguments: PausedArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function paused(options: PausedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HourlyMintLimitArguments {
    bridge: RawTransactionArgument<string>;
}
export interface HourlyMintLimitOptions {
    package?: string;
    arguments: HourlyMintLimitArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function hourlyMintLimit(options: HourlyMintLimitOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'hourly_mint_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HourlyMintedArguments {
    bridge: RawTransactionArgument<string>;
}
export interface HourlyMintedOptions {
    package?: string;
    arguments: HourlyMintedArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function hourlyMinted(options: HourlyMintedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'hourly_minted',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxMintPerTxArguments {
    bridge: RawTransactionArgument<string>;
}
export interface MaxMintPerTxOptions {
    package?: string;
    arguments: MaxMintPerTxArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function maxMintPerTx(options: MaxMintPerTxOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'max_mint_per_tx',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HourlyBurnLimitArguments {
    bridge: RawTransactionArgument<string>;
}
export interface HourlyBurnLimitOptions {
    package?: string;
    arguments: HourlyBurnLimitArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function hourlyBurnLimit(options: HourlyBurnLimitOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'hourly_burn_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HourlyBurnedArguments {
    bridge: RawTransactionArgument<string>;
}
export interface HourlyBurnedOptions {
    package?: string;
    arguments: HourlyBurnedArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function hourlyBurned(options: HourlyBurnedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'hourly_burned',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxBurnPerTxArguments {
    bridge: RawTransactionArgument<string>;
}
export interface MaxBurnPerTxOptions {
    package?: string;
    arguments: MaxBurnPerTxArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function maxBurnPerTx(options: MaxBurnPerTxOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'max_burn_per_tx',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BurnNonceArguments {
    bridge: RawTransactionArgument<string>;
}
export interface BurnNonceOptions {
    package?: string;
    arguments: BurnNonceArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function burnNonce(options: BurnNonceOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'burn_nonce',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TrustedEmitterArguments {
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
}
export interface TrustedEmitterOptions {
    package?: string;
    arguments: TrustedEmitterArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>
    ];
}
export function trustedEmitter(options: TrustedEmitterOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "chainId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'trusted_emitter',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasTrustedEmitterArguments {
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
}
export interface HasTrustedEmitterOptions {
    package?: string;
    arguments: HasTrustedEmitterArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>
    ];
}
export function hasTrustedEmitter(options: HasTrustedEmitterOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "chainId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'has_trusted_emitter',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsKeeperArguments {
    bridge: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface IsKeeperOptions {
    package?: string;
    arguments: IsKeeperArguments | [
        bridge: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
export function isKeeper(options: IsKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'is_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsEvmTokenSupportedArguments {
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    token: RawTransactionArgument<number[]>;
}
export interface IsEvmTokenSupportedOptions {
    package?: string;
    arguments: IsEvmTokenSupportedArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<number[]>
    ];
}
export function isEvmTokenSupported(options: IsEvmTokenSupportedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'u16',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "chainId", "token"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'is_evm_token_supported',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MintedForArguments {
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    token: RawTransactionArgument<number[]>;
}
export interface MintedForOptions {
    package?: string;
    arguments: MintedForArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<number[]>
    ];
}
export function mintedFor(options: MintedForOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'u16',
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "chainId", "token"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'minted_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}