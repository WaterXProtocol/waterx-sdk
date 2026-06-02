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
import * as vec_set_3 from './deps/sui/vec_set.ts';
import * as vec_set_4 from './deps/sui/vec_set.ts';
import * as sheet from './deps/bucket_v2_framework/sheet.ts';
import * as balance from './deps/sui/balance.ts';
import * as balance_1 from './deps/sui/balance.ts';
import * as balance_2 from './deps/sui/balance.ts';
const $moduleName = '@waterx/perp::global_config';
export const GlobalConfig = new MoveStruct({ name: `${$moduleName}::GlobalConfig`, fields: {
        id: bcs.Address,
        /** Allowed protocol versions (admin-managed). */
        allowed_versions: vec_set.VecSet(bcs.u16()),
        /**
         * Protocol-wide pause. When true, every trading and WLP action aborts. Triggered
         * by any pauser; only AdminCap can unpause.
         */
        is_paused: bcs.bool(),
        /** Authorized addresses that can trigger the global pause (but not unpause). */
        pausers: vec_set_1.VecSet(bcs.Address),
        /** Authorized keeper addresses. */
        keepers: vec_set_2.VecSet(bcs.Address),
        /** Authorized WLP redeem operators (can settle/reject redeem requests). */
        redeem_operators: vec_set_3.VecSet(bcs.Address),
        /** Authorized risk manager addresses (can force-close positions). */
        risk_managers: vec_set_4.VecSet(bcs.Address),
        /**
         * Protocol fee share in bps (of total trading fees). The protocol's cut of every
         * realized trading fee accumulates on `GlobalVault.protocol_fee_balance` and is
         * drained via `claim_protocol_fee` (admin-gated).
         */
        protocol_fee_share_bps: bcs.u64(),
        /** Optional keeper reward fee in bps of position notional. */
        liquidator_fee_bps: bcs.u64(),
        /**
         * Insurance fund fee in bps of position notional. The insurance cut of every
         * liquidation accumulates on `GlobalVault.insurance_fee_balance` and is drained
         * via `claim_insurance_fee` (admin-gated).
         */
        insurance_fee_bps: bcs.u64(),
        /** Maximum stale/invalid orders a keeper match call may skip or cancel. */
        max_skipped_orders_per_match: bcs.u64(),
        /** OI cap as bps of pool TVL (0 = no cap). */
        oi_cap_bps: bcs.u64(),
        /** Maximum allowed age for WLP token price refreshes in ms. */
        price_refresh_threshold_ms: bcs.u64()
    } });
export const GlobalVault = new MoveStruct({ name: `${$moduleName}::GlobalVault<phantom C_TOKEN>`, fields: {
        sheet: sheet.Sheet,
        /**
         * Trader collateral + LP liquidity — drained / topped up by every trading and WLP
         * action.
         */
        balance: balance.Balance,
        /**
         * Accumulated protocol-fee share. Routed here by `execute_*` / `match_orders` /
         * `mint_wlp` / `settle_redeem` instead of being transferred to a configured
         * `fee_address`. Drained by `claim_protocol_fee` (admin-gated).
         */
        protocol_fee_balance: balance_1.Balance,
        /**
         * Accumulated insurance fee from liquidations. Routed here by `execute_liquidate`
         * instead of being transferred to a configured `insurance_address`. Drained by
         * `claim_insurance_fee` (admin-gated).
         */
        insurance_fee_balance: balance_2.Balance
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
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DisallowVersionArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetLiquidatorFeeBpsArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetLiquidatorFeeBpsOptions {
    package?: string;
    arguments: SetLiquidatorFeeBpsArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_liquidator_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetInsuranceFeeBpsArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetInsuranceFeeBpsOptions {
    package?: string;
    arguments: SetInsuranceFeeBpsArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_insurance_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetMaxSkippedOrdersPerMatchArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetMaxSkippedOrdersPerMatchOptions {
    package?: string;
    arguments: SetMaxSkippedOrdersPerMatchArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        v: RawTransactionArgument<number | bigint>
    ];
}
export function setMaxSkippedOrdersPerMatch(options: SetMaxSkippedOrdersPerMatchOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_max_skipped_orders_per_match',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetOiCapBpsArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetOiCapBpsOptions {
    package?: string;
    arguments: SetOiCapBpsArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_oi_cap_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetPriceRefreshThresholdMsArguments {
    globalConfig: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    v: RawTransactionArgument<number | bigint>;
}
export interface SetPriceRefreshThresholdMsOptions {
    package?: string;
    arguments: SetPriceRefreshThresholdMsArguments | [
        globalConfig: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "_", "v"];
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
export interface MaxSkippedOrdersPerMatchArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface MaxSkippedOrdersPerMatchOptions {
    package?: string;
    arguments: MaxSkippedOrdersPerMatchArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function maxSkippedOrdersPerMatch(options: MaxSkippedOrdersPerMatchOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'max_skipped_orders_per_match',
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
export interface RedeemOperatorCountArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface RedeemOperatorCountOptions {
    package?: string;
    arguments: RedeemOperatorCountArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function redeemOperatorCount(options: RedeemOperatorCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'redeem_operator_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RedeemOperatorAddressesArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface RedeemOperatorAddressesOptions {
    package?: string;
    arguments: RedeemOperatorAddressesArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function redeemOperatorAddresses(options: RedeemOperatorAddressesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'redeem_operator_addresses',
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
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface AddKeeperOptions {
    package?: string;
    arguments: AddKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "Cap", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveKeeperArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    keeper: RawTransactionArgument<string>;
}
export interface RemoveKeeperOptions {
    package?: string;
    arguments: RemoveKeeperArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "Cap", "keeper"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_keeper',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddRedeemOperatorArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    redeemOperator: RawTransactionArgument<string>;
}
export interface AddRedeemOperatorOptions {
    package?: string;
    arguments: AddRedeemOperatorArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        redeemOperator: RawTransactionArgument<string>
    ];
}
/** Adds a WLP redeem operator address. */
export function addRedeemOperator(options: AddRedeemOperatorOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap", "redeemOperator"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_redeem_operator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveRedeemOperatorArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    redeemOperator: RawTransactionArgument<string>;
}
export interface RemoveRedeemOperatorOptions {
    package?: string;
    arguments: RemoveRedeemOperatorArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        redeemOperator: RawTransactionArgument<string>
    ];
}
/** Removes a WLP redeem operator address. */
export function removeRedeemOperator(options: RemoveRedeemOperatorOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap", "redeemOperator"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_redeem_operator',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddRiskManagerArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    riskManager: RawTransactionArgument<string>;
}
export interface AddRiskManagerOptions {
    package?: string;
    arguments: AddRiskManagerArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "Cap", "riskManager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_risk_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemoveRiskManagerArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    riskManager: RawTransactionArgument<string>;
}
export interface RemoveRiskManagerOptions {
    package?: string;
    arguments: RemoveRiskManagerArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "Cap", "riskManager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_risk_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SetProtocolFeeShareArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    feeShareBps: RawTransactionArgument<number | bigint>;
}
export interface SetProtocolFeeShareOptions {
    package?: string;
    arguments: SetProtocolFeeShareArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
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
    const parameterNames = ["globalConfig", "Cap", "feeShareBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'set_protocol_fee_share',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertNotPausedArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AssertNotPausedOptions {
    package?: string;
    arguments: AssertNotPausedArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
/** Aborts if the protocol is globally paused. */
export function assertNotPaused(options: AssertNotPausedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'assert_not_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertActiveArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface AssertActiveOptions {
    package?: string;
    arguments: AssertActiveArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
/**
 * Combined pre-flight check used by every public entrypoint: protocol must not be
 * paused AND the on-chain package must be on an allowed version. Folded into one
 * helper so call sites can `gc.assert_active()` instead of pairing the two checks
 * each time.
 */
export function assertActive(options: AssertActiveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'assert_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsPausedArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface IsPausedOptions {
    package?: string;
    arguments: IsPausedArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function isPaused(options: IsPausedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PauserCountArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface PauserCountOptions {
    package?: string;
    arguments: PauserCountArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function pauserCount(options: PauserCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'pauser_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PauserAddressesArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface PauserAddressesOptions {
    package?: string;
    arguments: PauserAddressesArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
}
export function pauserAddresses(options: PauserAddressesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'pauser_addresses',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddPauserArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    pauser: RawTransactionArgument<string>;
}
export interface AddPauserOptions {
    package?: string;
    arguments: AddPauserArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        pauser: RawTransactionArgument<string>
    ];
}
/** Adds an authorized pauser. Admin-gated. */
export function addPauser(options: AddPauserOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap", "pauser"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'add_pauser',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RemovePauserArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    pauser: RawTransactionArgument<string>;
}
export interface RemovePauserOptions {
    package?: string;
    arguments: RemovePauserArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        pauser: RawTransactionArgument<string>
    ];
}
/** Removes an authorized pauser. Admin-gated. */
export function removePauser(options: RemovePauserOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap", "pauser"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'remove_pauser',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PauseArguments {
    globalConfig: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
}
export interface PauseOptions {
    package?: string;
    arguments: PauseArguments | [
        globalConfig: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>
    ];
}
/**
 * Triggers the global pause. Callable by any registered pauser. Unpause requires
 * `AdminCap` (see `unpause`).
 */
export function pause(options: PauseOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "senderRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'pause',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnpauseArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface UnpauseOptions {
    package?: string;
    arguments: UnpauseArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
}
/** Lifts the global pause. Admin-only. */
export function unpause(options: UnpauseOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'unpause',
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
export interface VerifyRedeemOperatorArguments {
    globalConfig: RawTransactionArgument<string>;
    addr: RawTransactionArgument<string>;
}
export interface VerifyRedeemOperatorOptions {
    package?: string;
    arguments: VerifyRedeemOperatorArguments | [
        globalConfig: RawTransactionArgument<string>,
        addr: RawTransactionArgument<string>
    ];
}
/** Verifies the caller is a WLP redeem operator. */
export function verifyRedeemOperator(options: VerifyRedeemOperatorOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "addr"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'verify_redeem_operator',
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
export interface ProtocolFeeBalanceMutArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface ProtocolFeeBalanceMutOptions {
    package?: string;
    arguments: ProtocolFeeBalanceMutArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Mutable accessor for the protocol-fee accumulator. */
export function protocolFeeBalanceMut(options: ProtocolFeeBalanceMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'protocol_fee_balance_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface InsuranceFeeBalanceMutArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface InsuranceFeeBalanceMutOptions {
    package?: string;
    arguments: InsuranceFeeBalanceMutArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Mutable accessor for the insurance-fee accumulator. */
export function insuranceFeeBalanceMut(options: InsuranceFeeBalanceMutOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'insurance_fee_balance_mut',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ProtocolFeeValueArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface ProtocolFeeValueOptions {
    package?: string;
    arguments: ProtocolFeeValueArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Read-only accumulator views. */
export function protocolFeeValue(options: ProtocolFeeValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'protocol_fee_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface InsuranceFeeValueArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface InsuranceFeeValueOptions {
    package?: string;
    arguments: InsuranceFeeValueArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function insuranceFeeValue(options: InsuranceFeeValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'insurance_fee_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimProtocolFeeArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface ClaimProtocolFeeOptions {
    package?: string;
    arguments: ClaimProtocolFeeArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin: drain the protocol-fee accumulator for `C_TOKEN` and return the full
 * balance as a `Coin<C_TOKEN>` the admin can route wherever (typically into a
 * multisig treasury). No-op when the vault hasn't been opened yet; returns a zero
 * coin if there's nothing to claim.
 */
export function claimProtocolFee(options: ClaimProtocolFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'claim_protocol_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimInsuranceFeeArguments {
    globalConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface ClaimInsuranceFeeOptions {
    package?: string;
    arguments: ClaimInsuranceFeeArguments | [
        globalConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Admin: drain the insurance-fee accumulator for `C_TOKEN`. */
export function claimInsuranceFee(options: ClaimInsuranceFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'claim_insurance_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EnsureVaultArguments {
    globalConfig: RawTransactionArgument<string>;
}
export interface EnsureVaultOptions {
    package?: string;
    arguments: EnsureVaultArguments | [
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function ensureVault(options: EnsureVaultOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'global_config',
        function: 'ensure_vault',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}