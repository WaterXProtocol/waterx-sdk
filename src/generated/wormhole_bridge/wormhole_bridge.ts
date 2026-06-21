/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as table from './deps/sui/table.ts';
import * as emitter from './deps/wormhole_sdk/emitter.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as consumed_vaas from './deps/wormhole_sdk/consumed_vaas.ts';
import * as vec_set from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/wormhole-bridge::wormhole_bridge';
export const WormholeBridge = new MoveStruct({ name: `${$moduleName}::WormholeBridge`, fields: {
        dummy_field: bcs.bool()
    } });
export const ChainTokenKey = new MoveStruct({ name: `${$moduleName}::ChainTokenKey`, fields: {
        chain_id: bcs.u16(),
        token: bcs.vector(bcs.u8())
    } });
export const BurnWindow = new MoveStruct({ name: `${$moduleName}::BurnWindow`, fields: {
        burned: bcs.u64(),
        window_start_ms: bcs.u64()
    } });
export const PersonalBurnCap = new MoveStruct({ name: `${$moduleName}::PersonalBurnCap`, fields: {
        cap_amount: bcs.u64(),
        window_ms: bcs.u64(),
        user_burns: table.Table
    } });
export const Bridge = new MoveStruct({ name: `${$moduleName}::Bridge`, fields: {
        id: bcs.Address,
        emitter_cap: emitter.EmitterCap,
        trusted_emitters: vec_map.VecMap(bcs.u16(), bcs.vector(bcs.u8())),
        minted_per_token: vec_map.VecMap(ChainTokenKey, bcs.u64()),
        consumed_vaas: consumed_vaas.ConsumedVAAs,
        keepers: vec_set.VecSet(bcs.Address),
        daily_mint_limit: bcs.u64(),
        /**
         * True sliding-window mint accounting: a ring of `RL_BUCKETS` one-hour buckets. On
         * each mint, buckets that rotated out of the trailing window are zeroed, then the
         * sum of the remaining buckets plus `amount` is checked against
         * `daily_mint_limit`. Because the ring always covers at least a full rolling day,
         * no rolling 24-hour interval can exceed the limit. `mint_last_bucket` is the
         * absolute index (now/RL_BUCKET_MS) of the most recent mint.
         */
        mint_buckets: bcs.vector(bcs.u64()),
        mint_last_bucket: bcs.u64(),
        max_mint_per_tx: bcs.u64(),
        daily_burn_limit: bcs.u64(),
        /** True sliding-window burn accounting — see `mint_buckets`. */
        burn_buckets: bcs.vector(bcs.u64()),
        burn_last_bucket: bcs.u64(),
        max_burn_per_tx: bcs.u64(),
        /**
         * Bridge-local per-account daily burn cap on `burn_for_withdrawal_authorized`.
         * Enforced _in addition to_ the CreditRegistry-side `personal_burn_cap` (which
         * covers all burn-authorizing modules), so the bridge can apply a stricter
         * per-account ceiling specifically for EVM-route exits.
         */
        personal_burn_cap: PersonalBurnCap,
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
        allowed_versions: vec_set.VecSet(bcs.u16())
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
    dailyMintLimit: RawTransactionArgument<number | bigint>;
    maxMintPerTx: RawTransactionArgument<number | bigint>;
    dailyBurnLimit: RawTransactionArgument<number | bigint>;
    maxBurnPerTx: RawTransactionArgument<number | bigint>;
    personalBurnCapAmount: RawTransactionArgument<number | bigint>;
    personalBurnCapWindowMs: RawTransactionArgument<number | bigint>;
}
export interface InitBridgeOptions {
    package?: string;
    arguments: InitBridgeArguments | [
        _: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        dailyMintLimit: RawTransactionArgument<number | bigint>,
        maxMintPerTx: RawTransactionArgument<number | bigint>,
        dailyBurnLimit: RawTransactionArgument<number | bigint>,
        maxBurnPerTx: RawTransactionArgument<number | bigint>,
        personalBurnCapAmount: RawTransactionArgument<number | bigint>,
        personalBurnCapWindowMs: RawTransactionArgument<number | bigint>
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
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "wormholeState", "dailyMintLimit", "maxMintPerTx", "dailyBurnLimit", "maxBurnPerTx", "personalBurnCapAmount", "personalBurnCapWindowMs"];
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
    vaaBytes: RawTransactionArgument<Array<number>>;
}
export interface RedeemVaaOptions {
    package?: string;
    arguments: RedeemVaaArguments | [
        bridge: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        vaaBytes: RawTransactionArgument<Array<number>>
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
export interface BurnForWithdrawalAuthorizedArguments<M extends BcsType<any>> {
    bridge: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<M>;
    version: RawTransactionArgument<number>;
    accountId: RawTransactionArgument<string>;
    wormholeState: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    wormholeFee: RawTransactionArgument<string>;
    evmDestinationChain: RawTransactionArgument<number>;
    evmRecipient: RawTransactionArgument<Array<number>>;
    evmToken: RawTransactionArgument<Array<number>>;
}
export interface BurnForWithdrawalAuthorizedOptions<M extends BcsType<any>> {
    package?: string;
    arguments: BurnForWithdrawalAuthorizedArguments<M> | [
        bridge: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<M>,
        version: RawTransactionArgument<number>,
        accountId: RawTransactionArgument<string>,
        wormholeState: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        wormholeFee: RawTransactionArgument<string>,
        evmDestinationChain: RawTransactionArgument<number>,
        evmRecipient: RawTransactionArgument<Array<number>>,
        evmToken: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Account-authorized cross-chain burn. Only callable by a
 * `CreditRegistry`-registered module witness `M` (production: `WithdrawQueue`, via
 * `withdrawal_queue::execute_wormhole`), which vouches that `account_id` is the
 * genuine originating wxa Account. `account_id` is the `burner` identity baked
 * into `compute_withdrawal_id`, the `WithdrawalInitiated.burner` event field, and
 * the credit registry's personal-burn-cap key — so the EVM-side withdrawal id and
 * Sui-side cap accounting both bind to the source account, not whoever executes
 * the queue entry (audit findings #3 / L03 / M14).
 *
 * There is intentionally no unauthenticated public burn: a raw `Coin<CREDIT>`
 * holder cannot burn against a spoofed `account_id`.
 */
export function burnForWithdrawalAuthorized<M extends BcsType<any>>(options: BurnForWithdrawalAuthorizedOptions<M>) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`,
        'u16',
        '0x2::object::ID',
        null,
        null,
        null,
        'u16',
        'vector<u8>',
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "registry", "Witness", "version", "accountId", "wormholeState", "coin", "wormholeFee", "evmDestinationChain", "evmRecipient", "evmToken"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'burn_for_withdrawal_authorized',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddTrustedEmitterArguments {
    _: RawTransactionArgument<string>;
    bridge: RawTransactionArgument<string>;
    chainId: RawTransactionArgument<number>;
    evmBridgeAddress: RawTransactionArgument<Array<number>>;
}
export interface AddTrustedEmitterOptions {
    package?: string;
    arguments: AddTrustedEmitterArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        evmBridgeAddress: RawTransactionArgument<Array<number>>
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
    token: RawTransactionArgument<Array<number>>;
}
export interface AddSupportedEvmTokenOptions {
    package?: string;
    arguments: AddSupportedEvmTokenArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<Array<number>>
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
    token: RawTransactionArgument<Array<number>>;
}
export interface RemoveSupportedEvmTokenOptions {
    package?: string;
    arguments: RemoveSupportedEvmTokenArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<Array<number>>
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
    newDailyMint: RawTransactionArgument<number | bigint>;
    newMaxMintPerTx: RawTransactionArgument<number | bigint>;
    newDailyBurn: RawTransactionArgument<number | bigint>;
    newMaxBurnPerTx: RawTransactionArgument<number | bigint>;
}
export interface SetRateLimitsOptions {
    package?: string;
    arguments: SetRateLimitsArguments | [
        _: RawTransactionArgument<string>,
        bridge: RawTransactionArgument<string>,
        newDailyMint: RawTransactionArgument<number | bigint>,
        newMaxMintPerTx: RawTransactionArgument<number | bigint>,
        newDailyBurn: RawTransactionArgument<number | bigint>,
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
    const parameterNames = ["_", "bridge", "newDailyMint", "newMaxMintPerTx", "newDailyBurn", "newMaxBurnPerTx"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'set_rate_limits',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPersonalBurnCapArguments {
    bridge: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    capAmount: RawTransactionArgument<number | bigint>;
    windowMs: RawTransactionArgument<number | bigint>;
}
export interface SetPersonalBurnCapOptions {
    package?: string;
    arguments: SetPersonalBurnCapArguments | [
        bridge: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        capAmount: RawTransactionArgument<number | bigint>,
        windowMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Admin: configure the bridge-local per-account daily burn cap. `cap_amount = 0`
 * disables (default). `window_ms` must be > 0 even when disabled — `window_ms = 0`
 * would reset the accumulator on every burn and silently degrade the cap to a
 * per-tx ceiling. Mirrors `credit_registry::set_personal_burn_cap` but acts on
 * this bridge only.
 */
export function setPersonalBurnCap(options: SetPersonalBurnCapOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "_", "capAmount", "windowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'set_personal_burn_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ResetPersonalBurnWindowArguments {
    bridge: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    user: RawTransactionArgument<string>;
}
export interface ResetPersonalBurnWindowOptions {
    package?: string;
    arguments: ResetPersonalBurnWindowArguments | [
        bridge: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        user: RawTransactionArgument<string>
    ];
}
/**
 * Admin: wipe a single user's bridge-local burn-window accumulator. Use to clear a
 * stale entry after a long inactivity period or to forgive the in-window balance
 * manually. Idempotent on absent users.
 */
export function resetPersonalBurnWindow(options: ResetPersonalBurnWindowOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "_", "user"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'reset_personal_burn_window',
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
    request: TransactionArgument;
}
export interface EmergencyPauseOptions {
    package?: string;
    arguments: EmergencyPauseArguments | [
        bridge: RawTransactionArgument<string>,
        request: TransactionArgument
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
export interface DailyMintLimitArguments {
    bridge: RawTransactionArgument<string>;
}
export interface DailyMintLimitOptions {
    package?: string;
    arguments: DailyMintLimitArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function dailyMintLimit(options: DailyMintLimitOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'daily_mint_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DailyMintedArguments {
    bridge: RawTransactionArgument<string>;
}
export interface DailyMintedOptions {
    package?: string;
    arguments: DailyMintedArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
/**
 * Tracked mint usage in the current sliding window (sum of all buckets). Stale
 * buckets are evicted lazily on the next mint, so this can include
 * not-yet-rotated-out buckets until the next `check_rate_limit`.
 */
export function dailyMinted(options: DailyMintedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'daily_minted',
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
export interface DailyBurnLimitArguments {
    bridge: RawTransactionArgument<string>;
}
export interface DailyBurnLimitOptions {
    package?: string;
    arguments: DailyBurnLimitArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function dailyBurnLimit(options: DailyBurnLimitOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'daily_burn_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DailyBurnedArguments {
    bridge: RawTransactionArgument<string>;
}
export interface DailyBurnedOptions {
    package?: string;
    arguments: DailyBurnedArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
/** Tracked burn usage in the current sliding window — see `daily_minted`. */
export function dailyBurned(options: DailyBurnedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'daily_burned',
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
export interface PersonalBurnCapAmountArguments {
    bridge: RawTransactionArgument<string>;
}
export interface PersonalBurnCapAmountOptions {
    package?: string;
    arguments: PersonalBurnCapAmountArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function personalBurnCapAmount(options: PersonalBurnCapAmountOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'personal_burn_cap_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PersonalBurnCapWindowMsArguments {
    bridge: RawTransactionArgument<string>;
}
export interface PersonalBurnCapWindowMsOptions {
    package?: string;
    arguments: PersonalBurnCapWindowMsArguments | [
        bridge: RawTransactionArgument<string>
    ];
}
export function personalBurnCapWindowMs(options: PersonalBurnCapWindowMsOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bridge"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'personal_burn_cap_window_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PersonalBurnedArguments {
    bridge: RawTransactionArgument<string>;
    user: RawTransactionArgument<string>;
}
export interface PersonalBurnedOptions {
    package?: string;
    arguments: PersonalBurnedArguments | [
        bridge: RawTransactionArgument<string>,
        user: RawTransactionArgument<string>
    ];
}
/**
 * Burn already counted in the user's current window. Returns 0 for unknown users,
 * for users whose window has not been touched yet, AND for users whose stored
 * window has expired (lazily — the on-burn path resets it; this view computes the
 * same answer without mutating).
 */
export function personalBurned(options: PersonalBurnedOptions) {
    const packageAddress = options.package ?? '@waterx/wormhole-bridge';
    const argumentsTypes = [
        null,
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["bridge", "user"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wormhole_bridge',
        function: 'personal_burned',
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
    token: RawTransactionArgument<Array<number>>;
}
export interface IsEvmTokenSupportedOptions {
    package?: string;
    arguments: IsEvmTokenSupportedArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<Array<number>>
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
    token: RawTransactionArgument<Array<number>>;
}
export interface MintedForOptions {
    package?: string;
    arguments: MintedForArguments | [
        bridge: RawTransactionArgument<string>,
        chainId: RawTransactionArgument<number>,
        token: RawTransactionArgument<Array<number>>
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