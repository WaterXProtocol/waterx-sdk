/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Global protocol configuration for WaterX Perp. AdminCap-gated operations for
 * protocol settings.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as vec_set from './deps/sui/vec_set.ts';
import * as vec_set_1 from './deps/sui/vec_set.ts';
import * as vec_set_2 from './deps/sui/vec_set.ts';
import * as sheet from './deps/bucket_v2_framework/sheet.ts';
import * as balance from './deps/sui/balance.ts';
const $moduleName = '@waterx/perp::global_config';
export const GlobalConfig = new MoveStruct({ name: `${$moduleName}::GlobalConfig`, fields: {
        id: bcs.Address,
        /** Allowed protocol versions (admin-managed). */
        allowed_versions: vec_set.VecSet(bcs.u16()),
        /** Authorized keeper addresses. */
        keepers: vec_set_1.VecSet(bcs.Address),
        /** Authorized risk manager addresses (can force-close positions). */
        risk_managers: vec_set_2.VecSet(bcs.Address),
        /** Protocol fee recipient. */
        fee_address: bcs.Address,
        /** Protocol fee share in bps (of total trading fees). */
        protocol_fee_share_bps: bcs.u64(),
        /** Insurance fund recipient. */
        insurance_address: bcs.Address,
        /** Optional keeper reward fee in bps of position notional. */
        liquidator_fee_bps: bcs.u64(),
        /** Insurance fund fee in bps of position notional. */
        insurance_fee_bps: bcs.u64(),
        /** Maximum orders per price level. */
        max_orders_per_price: bcs.u64(),
        /** OI cap as bps of pool TVL (0 = no cap). */
        oi_cap_bps: bcs.u64(),
        /** Maximum allowed age for WLP token price refreshes in ms. */
        price_refresh_threshold_ms: bcs.u64()
    } });
export const GlobalVault = new MoveStruct({ name: `${$moduleName}::GlobalVault<phantom C_TOKEN>`, fields: {
        sheet: sheet.Sheet,
        balance: balance.Balance
    } });
export interface InitOptions {
    package?: string;
    arguments?: [
    ];
}
export function init(options: InitOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'init',
    });
}
export interface AssertVersionArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowVersionArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetLiquidatorFeeBpsArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetLiquidatorFeeBpsOptions {
    package?: string;
    arguments: SetLiquidatorFeeBpsArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setLiquidatorFeeBps(options: SetLiquidatorFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_liquidator_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetInsuranceFeeBpsArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetInsuranceFeeBpsOptions {
    package?: string;
    arguments: SetInsuranceFeeBpsArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setInsuranceFeeBps(options: SetInsuranceFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_insurance_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetMaxOrdersPerPriceArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetMaxOrdersPerPriceOptions {
    package?: string;
    arguments: SetMaxOrdersPerPriceArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setMaxOrdersPerPrice(options: SetMaxOrdersPerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_max_orders_per_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetOiCapBpsArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetOiCapBpsOptions {
    package?: string;
    arguments: SetOiCapBpsArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setOiCapBps(options: SetOiCapBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_oi_cap_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPriceRefreshThresholdMsArguments {
    _: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetPriceRefreshThresholdMsOptions {
    package?: string;
    arguments: SetPriceRefreshThresholdMsArguments | [
        _: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setPriceRefreshThresholdMs(options: SetPriceRefreshThresholdMsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "globalConfig", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_price_refresh_threshold_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LiquidatorFeeBpsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface LiquidatorFeeBpsOptions {
    package?: string;
    arguments: LiquidatorFeeBpsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function liquidatorFeeBps(options: LiquidatorFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'liquidator_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InsuranceFeeBpsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface InsuranceFeeBpsOptions {
    package?: string;
    arguments: InsuranceFeeBpsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function insuranceFeeBps(options: InsuranceFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'insurance_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxOrdersPerPriceArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface MaxOrdersPerPriceOptions {
    package?: string;
    arguments: MaxOrdersPerPriceArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function maxOrdersPerPrice(options: MaxOrdersPerPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'max_orders_per_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OiCapBpsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface OiCapBpsOptions {
    package?: string;
    arguments: OiCapBpsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function oiCapBps(options: OiCapBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'oi_cap_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PriceRefreshThresholdMsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface PriceRefreshThresholdMsOptions {
    package?: string;
    arguments: PriceRefreshThresholdMsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function priceRefreshThresholdMs(options: PriceRefreshThresholdMsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'price_refresh_threshold_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeeAddressArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface FeeAddressOptions {
    package?: string;
    arguments: FeeAddressArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function feeAddress(options: FeeAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'fee_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InsuranceAddressArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface InsuranceAddressOptions {
    package?: string;
    arguments: InsuranceAddressArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function insuranceAddress(options: InsuranceAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'insurance_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ProtocolFeeShareBpsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface ProtocolFeeShareBpsOptions {
    package?: string;
    arguments: ProtocolFeeShareBpsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function protocolFeeShareBps(options: ProtocolFeeShareBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'protocol_fee_share_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KeeperCountArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface KeeperCountOptions {
    package?: string;
    arguments: KeeperCountArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function keeperCount(options: KeeperCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'keeper_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KeeperAddressesArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface KeeperAddressesOptions {
    package?: string;
    arguments: KeeperAddressesArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function keeperAddresses(options: KeeperAddressesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'keeper_addresses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RiskManagerAddressesArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface RiskManagerAddressesOptions {
    package?: string;
    arguments: RiskManagerAddressesArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function riskManagerAddresses(options: RiskManagerAddressesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'risk_manager_addresses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AllowedVersionsArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AllowedVersionsOptions {
    package?: string;
    arguments: AllowedVersionsArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function allowedVersions(options: AllowedVersionsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'allowed_versions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddKeeperArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface AddKeeperOptions {
    package?: string;
    arguments: AddKeeperArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
/** Adds a keeper address. */
export function addKeeper(options: AddKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveKeeperArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface RemoveKeeperOptions {
    package?: string;
    arguments: RemoveKeeperArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
/** Removes a keeper address. */
export function removeKeeper(options: RemoveKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddRiskManagerArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    riskManager: RawTransactionArgument<string>;
}
export interface AddRiskManagerOptions {
    package?: string;
    arguments: AddRiskManagerArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        riskManager: RawTransactionArgument<string>
    ];
}
/** Adds a risk manager address. */
export function addRiskManager(options: AddRiskManagerOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "riskManager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_risk_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveRiskManagerArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    riskManager: RawTransactionArgument<string>;
}
export interface RemoveRiskManagerOptions {
    package?: string;
    arguments: RemoveRiskManagerArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        riskManager: RawTransactionArgument<string>
    ];
}
/** Removes a risk manager address. */
export function removeRiskManager(options: RemoveRiskManagerOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "riskManager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_risk_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetProtocolFeeShareArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    feeShareBps: RawTransactionArgument<number | bigint>;
}
export interface SetProtocolFeeShareOptions {
    package?: string;
    arguments: SetProtocolFeeShareArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        feeShareBps: RawTransactionArgument<number | bigint>
    ];
}
/** Sets protocol fee share. */
export function setProtocolFeeShare(options: SetProtocolFeeShareOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "feeShareBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_protocol_fee_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetFeeAddressArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface SetFeeAddressOptions {
    package?: string;
    arguments: SetFeeAddressArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Sets the fee recipient address. */
export function setFeeAddress(options: SetFeeAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_fee_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetInsuranceAddressArguments {
    Cap: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface SetInsuranceAddressOptions {
    package?: string;
    arguments: SetInsuranceAddressArguments | [
        Cap: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Sets the insurance fund address. */
export function setInsuranceAddress(options: SetInsuranceAddressOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "globalConfig", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_insurance_address',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface IsKeeperOptions {
    package?: string;
    arguments: IsKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Returns true if the address is a registered keeper. */
export function isKeeper(options: IsKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'is_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifyKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface VerifyKeeperOptions {
    package?: string;
    arguments: VerifyKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeper: RawTransactionArgument<string>
    ];
}
/** Verifies the caller is a keeper. */
export function verifyKeeper(options: VerifyKeeperOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'verify_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VerifyRiskManagerArguments {
    globalConfig: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface VerifyRiskManagerOptions {
    package?: string;
    arguments: VerifyRiskManagerArguments | [
        globalConfig: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Verifies the caller is a risk manager. */
export function verifyRiskManager(options: VerifyRiskManagerOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'verify_risk_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GlobalConfigUidArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface GlobalConfigUidOptions {
    package?: string;
    arguments: GlobalConfigUidArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
/** Gets the global_config UID for sub-account storage. */
export function globalConfigUid(options: GlobalConfigUidOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'global_config_uid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface GlobalConfigUidMutArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface GlobalConfigUidMutOptions {
    package?: string;
    arguments: GlobalConfigUidMutArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
/** Gets the mutable global_config UID for sub-account storage. */
export function globalConfigUidMut(options: GlobalConfigUidMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'global_config_uid_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface VaultBalanceArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface VaultBalanceOptions {
    package?: string;
    arguments: VaultBalanceArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets the current vault balance for a given collateral type (read-only). */
export function vaultBalance(options: VaultBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'vault_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceMutArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface BalanceMutOptions {
    package?: string;
    arguments: BalanceMutArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets the mutable balance of collateral */
export function balanceMut(options: BalanceMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'balance_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}