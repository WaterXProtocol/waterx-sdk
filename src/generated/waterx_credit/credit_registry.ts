/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveTuple, MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
import * as limited_supply from './limited_supply.ts';
import * as table from './deps/sui/table.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
const $moduleName = '@waterx/credit::credit_registry';
export const CapKey = new MoveTuple({ name: `${$moduleName}::CapKey`, fields: [bcs.bool()] });
export const Mint = new MoveStruct({ name: `${$moduleName}::Mint<phantom CREDIT, phantom M>`, fields: {
        amount: bcs.u64(),
        module_supply: bcs.u64(),
        total_supply: bcs.u64()
    } });
export const Burn = new MoveStruct({ name: `${$moduleName}::Burn<phantom CREDIT, phantom M>`, fields: {
        amount: bcs.u64(),
        module_supply: bcs.u64(),
        total_supply: bcs.u64()
    } });
export const ProtocolCapBasisRefreshed = new MoveStruct({ name: `${$moduleName}::ProtocolCapBasisRefreshed<phantom CREDIT>`, fields: {
        cap_basis_supply: bcs.u64(),
        last_refresh_ms: bcs.u64()
    } });
export const CollectFee = new MoveStruct({ name: `${$moduleName}::CollectFee<phantom CREDIT, phantom M>`, fields: {
        memo: bcs.string(),
        coin_type: bcs.string(),
        amount: bcs.u64()
    } });
export const ClaimFee = new MoveStruct({ name: `${$moduleName}::ClaimFee<phantom CREDIT, phantom M>`, fields: {
        coin_type: bcs.string(),
        amount: bcs.u64()
    } });
export const ModuleConfig = new MoveStruct({ name: `${$moduleName}::ModuleConfig`, fields: {
        valid_versions: vec_set.VecSet(bcs.u16()),
        limited_supply: limited_supply.LimitedSupply
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
export const ProtocolBurnCap = new MoveStruct({ name: `${$moduleName}::ProtocolBurnCap`, fields: {
        cap_basis_supply: bcs.u64(),
        cap_bps: bcs.u64(),
        refresh_interval_ms: bcs.u64(),
        last_refresh_ms: bcs.u64(),
        burned_in_window: bcs.u64()
    } });
export const CreditRegistry = new MoveStruct({ name: `${$moduleName}::CreditRegistry<phantom CREDIT>`, fields: {
        id: bcs.Address,
        module_config_map: vec_map.VecMap(type_name.TypeName, ModuleConfig),
        beneficiary_address: bcs.Address,
        offset_supply: bcs.u64(),
        personal_burn_cap: PersonalBurnCap,
        protocol_burn_cap: ProtocolBurnCap,
        /**
         * Admin-managed package-version allowlist for the registry's own upgrade
         * lifecycle. Distinct from `ModuleConfig.valid_versions` which tracks per-module
         * witness versions. Every mutating public entry asserts
         * `PACKAGE_VERSION ∈ allowed_versions`; admin uses `add_package_version` /
         * `remove_package_version` to kill-switch a deprecated package after upgrade.
         */
        allowed_versions: vec_set.VecSet(bcs.u16())
    } });
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/credit';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'package_version',
    });
}
export interface CreateCreditRegistryArguments {
    _: RawTransactionArgument<string>;
    treasuryCap: RawTransactionArgument<string>;
}
export interface CreateCreditRegistryOptions {
    package?: string;
    arguments: CreateCreditRegistryArguments | [
        _: RawTransactionArgument<string>,
        treasuryCap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Wrap an existing `TreasuryCap<CREDIT>` into a shared `CreditRegistry<CREDIT>`.
 * Caps default to disabled (cap_amount = 0, cap_bps = 0); admin opts in via
 * `set_personal_burn_cap` / `set_protocol_burn_cap`.
 */
export function createCreditRegistry(options: CreateCreditRegistryOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["_", "treasuryCap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'create_credit_registry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetBeneficiaryAddressArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface SetBeneficiaryAddressOptions {
    package?: string;
    arguments: SetBeneficiaryAddressArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** === Admin === */
export function setBeneficiaryAddress(options: SetBeneficiaryAddressOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'set_beneficiary_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddPackageVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddPackageVersionOptions {
    package?: string;
    arguments: AddPackageVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: whitelist a package version on this registry. Skips the version check
 * itself so admin can recover from a stuck state.
 */
export function addPackageVersion(options: AddPackageVersionOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'add_package_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemovePackageVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemovePackageVersionOptions {
    package?: string;
    arguments: RemovePackageVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: remove a package version from this registry's allowlist. Skips the
 * version check itself.
 */
export function removePackageVersion(options: RemovePackageVersionOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'remove_package_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetPersonalBurnCapArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    capAmount: RawTransactionArgument<number | bigint>;
    windowMs: RawTransactionArgument<number | bigint>;
}
export interface SetPersonalBurnCapOptions {
    package?: string;
    arguments: SetPersonalBurnCapArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        capAmount: RawTransactionArgument<number | bigint>,
        windowMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Personal cap = max amount of `CREDIT` a single sender can burn within
 * `window_ms`. `cap_amount = 0` disables (default). `window_ms` must be > 0 even
 * when disabled — `window_ms = 0` would reset the accumulator every burn and
 * silently degrade the cap to per-tx only.
 */
export function setPersonalBurnCap(options: SetPersonalBurnCapOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "capAmount", "windowMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'set_personal_burn_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetProtocolBurnCapArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    capBps: RawTransactionArgument<number | bigint>;
    refreshIntervalMs: RawTransactionArgument<number | bigint>;
}
export interface SetProtocolBurnCapOptions {
    package?: string;
    arguments: SetProtocolBurnCapArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        capBps: RawTransactionArgument<number | bigint>,
        refreshIntervalMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Protocol cap = `cap_basis_supply * cap_bps / 10_000`. `cap_basis_supply` is
 * refreshed lazily on burn after `refresh_interval_ms` has elapsed, so a sudden
 * supply spike does not immediately raise the gate. `cap_bps = 0` disables
 * (default).
 *
 * `cap_bps` must be ≤ `BPS_DENOMINATOR` (≤100%); larger values would make the gate
 * computation wrap silently on the final `as u64` cast. `refresh_interval_ms` must
 * be > 0; otherwise the burned-in-window accumulator resets on every burn and the
 * rolling cap collapses to a per-tx ceiling.
 */
export function setProtocolBurnCap(options: SetProtocolBurnCapOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "capBps", "refreshIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'set_protocol_burn_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RefreshProtocolCapBasisArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface RefreshProtocolCapBasisOptions {
    package?: string;
    arguments: RefreshProtocolCapBasisArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Force-reset the protocol cap basis to current supply. Use sparingly (e.g. after
 * legitimate large mint / burn events).
 */
export function refreshProtocolCapBasis(options: RefreshProtocolCapBasisOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'refresh_protocol_cap_basis',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResetPersonalBurnWindowArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    user: RawTransactionArgument<string>;
}
export interface ResetPersonalBurnWindowOptions {
    package?: string;
    arguments: ResetPersonalBurnWindowArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        user: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Clear a single user's burn window (e.g. after manual review approves extra
 * withdrawal).
 */
export function resetPersonalBurnWindow(options: ResetPersonalBurnWindowOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "user"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'reset_personal_burn_window',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetSupplyLimitArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    supplyLimit: RawTransactionArgument<number | bigint>;
}
export interface SetSupplyLimitOptions {
    package?: string;
    arguments: SetSupplyLimitArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        supplyLimit: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function setSupplyLimit(options: SetSupplyLimitOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "supplyLimit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'set_supply_limit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddVersionOptions {
    package?: string;
    arguments: AddVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function addVersion(options: AddVersionOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'add_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveVersionArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemoveVersionOptions {
    package?: string;
    arguments: RemoveVersionArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function removeVersion(options: RemoveVersionOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'remove_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveModuleArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface RemoveModuleOptions {
    package?: string;
    arguments: RemoveModuleArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function removeModule(options: RemoveModuleOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'remove_module',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintArguments<M extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<M>;
    version: RawTransactionArgument<number>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface MintOptions<M extends BcsType<any>> {
    package?: string;
    arguments: MintArguments<M> | [
        registry: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<M>,
        version: RawTransactionArgument<number>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * === Mint / Burn === Mint `amount` of `CREDIT` on behalf of module `M`. `M` must
 * be a registered owned module of this registry (via `add_version`) and `version`
 * must be a whitelisted version of `M`. The `M: drop` witness proves the call site
 * is inside `M`.
 */
export function mint<M extends BcsType<any>>(options: MintOptions<M>) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        `${options.typeArguments[1]}`,
        'u16',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Witness", "version", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'mint',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BurnArguments<M extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    witness: RawTransactionArgument<M>;
    version: RawTransactionArgument<number>;
    coin: RawTransactionArgument<string>;
}
export interface BurnOptions<M extends BcsType<any>> {
    package?: string;
    arguments: BurnArguments<M> | [
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        witness: RawTransactionArgument<M>,
        version: RawTransactionArgument<number>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Burn `coin` against module `M`'s supply limit. The personal burn cap is keyed by
 * `account_id.to_address()` — the wxa Account whose stored `Balance<CREDIT>`
 * produced this coin via the withdraw-policy flow. The deposit-before-withdraw
 * property of the wxa custody layer means an attacker can't sidestep the
 * per-account cap by minting fresh bucket-framework accounts at burn time (audit
 * finding #2): to spread CREDIT across N accounts they'd need to deposit into
 * each, and CREDIT can only enter an account through a mint that targets a
 * specific `account_id` or a (capped) account-to-account withdraw + deposit round
 * trip.
 */
export function burn<M extends BcsType<any>>(options: BurnOptions<M>) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        `${options.typeArguments[1]}`,
        'u16',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "accountId", "witness", "version", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'burn',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CollectArguments<M extends BcsType<any>> {
    registry: RawTransactionArgument<string>;
    Witness: RawTransactionArgument<M>;
    version: RawTransactionArgument<number>;
    memo: RawTransactionArgument<string>;
    balance: TransactionArgument;
}
export interface CollectOptions<M extends BcsType<any>> {
    package?: string;
    arguments: CollectArguments<M> | [
        registry: RawTransactionArgument<string>,
        Witness: RawTransactionArgument<M>,
        version: RawTransactionArgument<number>,
        memo: RawTransactionArgument<string>,
        balance: TransactionArgument
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/** === Fee collect / claim === */
export function collect<M extends BcsType<any>>(options: CollectOptions<M>) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        `${options.typeArguments[2]}`,
        'u16',
        '0x1::string::String',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "Witness", "version", "memo", "balance"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'collect',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimArguments {
    registry: RawTransactionArgument<string>;
    request: TransactionArgument;
}
export interface ClaimOptions {
    package?: string;
    arguments: ClaimArguments | [
        registry: RawTransactionArgument<string>,
        request: TransactionArgument
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
/**
 * Drain the per-module `M` fee bucket for `T`. Gated by an `AccountRequest` whose
 * address matches `registry.beneficiary_address` — so the beneficiary can claim
 * their own fees without holding an `AdminCap`. Admin rotates the beneficiary via
 * `set_beneficiary_address`.
 */
export function claim(options: ClaimOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "request"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'claim',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TotalSupplyArguments {
    registry: RawTransactionArgument<string>;
}
export interface TotalSupplyOptions {
    package?: string;
    arguments: TotalSupplyArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** === Views === */
export function totalSupply(options: TotalSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'total_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ModuleConfigMapArguments {
    registry: RawTransactionArgument<string>;
}
export interface ModuleConfigMapOptions {
    package?: string;
    arguments: ModuleConfigMapArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function moduleConfigMap(options: ModuleConfigMapOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'module_config_map',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LimitedSupplyArguments {
    config: TransactionArgument;
}
export interface LimitedSupplyOptions {
    package?: string;
    arguments: LimitedSupplyArguments | [
        config: TransactionArgument
    ];
}
export function limitedSupply(options: LimitedSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'limited_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ValidVersionsArguments {
    config: TransactionArgument;
}
export interface ValidVersionsOptions {
    package?: string;
    arguments: ValidVersionsArguments | [
        config: TransactionArgument
    ];
}
export function validVersions(options: ValidVersionsOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["config"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'valid_versions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BeneficiaryAddressArguments {
    registry: RawTransactionArgument<string>;
}
export interface BeneficiaryAddressOptions {
    package?: string;
    arguments: BeneficiaryAddressArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function beneficiaryAddress(options: BeneficiaryAddressOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'beneficiary_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OffsetSupplyArguments {
    registry: RawTransactionArgument<string>;
}
export interface OffsetSupplyOptions {
    package?: string;
    arguments: OffsetSupplyArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function offsetSupply(options: OffsetSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'offset_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PersonalBurnCapAmountArguments {
    registry: RawTransactionArgument<string>;
}
export interface PersonalBurnCapAmountOptions {
    package?: string;
    arguments: PersonalBurnCapAmountArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function personalBurnCapAmount(options: PersonalBurnCapAmountOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'personal_burn_cap_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PersonalBurnCapWindowMsArguments {
    registry: RawTransactionArgument<string>;
}
export interface PersonalBurnCapWindowMsOptions {
    package?: string;
    arguments: PersonalBurnCapWindowMsArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function personalBurnCapWindowMs(options: PersonalBurnCapWindowMsOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'personal_burn_cap_window_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PersonalBurnedArguments {
    registry: RawTransactionArgument<string>;
    user: RawTransactionArgument<string>;
}
export interface PersonalBurnedOptions {
    package?: string;
    arguments: PersonalBurnedArguments | [
        registry: RawTransactionArgument<string>,
        user: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function personalBurned(options: PersonalBurnedOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "user"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'personal_burned',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PersonalBurnWindowCountArguments {
    registry: RawTransactionArgument<string>;
}
export interface PersonalBurnWindowCountOptions {
    package?: string;
    arguments: PersonalBurnWindowCountArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function personalBurnWindowCount(options: PersonalBurnWindowCountOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'personal_burn_window_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolCapBasisSupplyArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolCapBasisSupplyOptions {
    package?: string;
    arguments: ProtocolCapBasisSupplyArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function protocolCapBasisSupply(options: ProtocolCapBasisSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'protocol_cap_basis_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolCapBpsArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolCapBpsOptions {
    package?: string;
    arguments: ProtocolCapBpsArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function protocolCapBps(options: ProtocolCapBpsOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'protocol_cap_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolCapRefreshIntervalMsArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolCapRefreshIntervalMsOptions {
    package?: string;
    arguments: ProtocolCapRefreshIntervalMsArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function protocolCapRefreshIntervalMs(options: ProtocolCapRefreshIntervalMsOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'protocol_cap_refresh_interval_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolCapLastRefreshMsArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolCapLastRefreshMsOptions {
    package?: string;
    arguments: ProtocolCapLastRefreshMsArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function protocolCapLastRefreshMs(options: ProtocolCapLastRefreshMsOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'protocol_cap_last_refresh_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolCapBurnedInWindowArguments {
    registry: RawTransactionArgument<string>;
}
export interface ProtocolCapBurnedInWindowOptions {
    package?: string;
    arguments: ProtocolCapBurnedInWindowArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function protocolCapBurnedInWindow(options: ProtocolCapBurnedInWindowOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'protocol_cap_burned_in_window',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsClaimableMapExistsTypeArguments {
    registry: RawTransactionArgument<string>;
}
export interface IsClaimableMapExistsTypeOptions {
    package?: string;
    arguments: IsClaimableMapExistsTypeArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function isClaimableMapExistsType(options: IsClaimableMapExistsTypeOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'is_claimable_map_exists_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimableMapArguments {
    registry: RawTransactionArgument<string>;
}
export interface ClaimableMapOptions {
    package?: string;
    arguments: ClaimableMapArguments | [
        registry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function claimableMap(options: ClaimableMapOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'claimable_map',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertValidModuleVersionArguments {
    registry: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AssertValidModuleVersionOptions {
    package?: string;
    arguments: AssertValidModuleVersionArguments | [
        registry: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function assertValidModuleVersion(options: AssertValidModuleVersionOptions) {
    const packageAddress = options.package ?? '@waterx/credit';
    const argumentsTypes = [
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'credit_registry',
        function: 'assert_valid_module_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}