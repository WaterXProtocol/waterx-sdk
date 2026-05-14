/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** MarketConfig: per-market configuration, state, and funding rate logic. */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as float_2 from './deps/bucket_v2_framework/float.ts';
import * as float_3 from './deps/bucket_v2_framework/float.ts';
import * as float_4 from './deps/bucket_v2_framework/float.ts';
import * as float_5 from './deps/bucket_v2_framework/float.ts';
import * as float_6 from './deps/bucket_v2_framework/float.ts';
import * as type_name from './deps/std/type_name.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as float_7 from './deps/bucket_v2_framework/float.ts';
import * as float_8 from './deps/bucket_v2_framework/float.ts';
import * as float_9 from './deps/bucket_v2_framework/float.ts';
import * as float_10 from './deps/bucket_v2_framework/float.ts';
import * as double from './deps/bucket_v2_framework/double.ts';
const $moduleName = '@waterx/perp::market_config';
export const MarketConfig = new MoveStruct({ name: `${$moduleName}::MarketConfig`, fields: {
        id: bcs.Address,
        /** Ticker symbol (e.g., `b"BTC_USD".to_string()`). Doubles as the oracle key. */
        symbol: bcs.string(),
        /** Whether this market is paused. When true, trading actions abort. */
        is_paused: bcs.bool(),
        /** Maximum leverage in bps (e.g., 100x = 1_000_000 bps). */
        max_leverage_bps: bcs.u64(),
        /** Minimum position collateral value in USD, scaled by 1e9. */
        min_coll_value: bcs.u64(),
        /** Base trading fee as Float rate (e.g. 0.0005 = 5 bps). */
        trading_fee: float.Float,
        /** Maximum additional impact fee as Float rate. */
        max_impact_fee: float_1.Float,
        /** Share of LP TVL allocated to net exposure before impact hits max, in bps. */
        allocated_lp_exposure_bps: bcs.u64(),
        /** Curvature exponent for the impact fee curve. */
        impact_fee_curvature: bcs.u64(),
        /** Scale divisor applied to the exposure ratio before curvature. */
        impact_fee_scale: bcs.u64(),
        /** Maintenance margin rate as Float (e.g. 0.015 = 150 bps). */
        maintenance_margin: float_2.Float,
        /** Maximum long open interest as Float (in base tokens). */
        max_long_oi: float_3.Float,
        /** Maximum short open interest as Float (in base tokens). */
        max_short_oi: float_4.Float,
        /** Cooldown between position updates in ms. */
        cooldown_ms: bcs.u64(),
        /** Bucket size for order book trigger price normalization. */
        order_price_tick: float_5.Float,
        /**
         * Maximum number of TP / SL pre-orders reservable against a single unfilled main
         * order. Defaults to `DEFAULT_MAX_PRE_ORDERS`; admin may tune via
         * `update_market_config`. Enforced at place / update / add pre-order paths.
         */
        max_pre_orders: bcs.u64(),
        /** Basic funding rate per interval (Float, typically ~0.01% = 1 bps). */
        basic_funding_rate: float_6.Float,
        /** Funding interval in milliseconds (default 3600000 = 1 hour). */
        funding_interval_ms: bcs.u64(),
        /** Required witness types before execution. */
        request_checklist: bcs.vector(type_name.TypeName),
        /** Prevents reentrancy: locked during the request→execute lifecycle. */
        position_locker: vec_set.VecSet(bcs.u64()),
        /** Current long open interest as Float. */
        long_oi: float_7.Float,
        /** Current short open interest as Float. */
        short_oi: float_8.Float,
        /** Aggregate long average entry price. */
        long_avg_entry_price: float_9.Float,
        /** Aggregate short average entry price. */
        short_avg_entry_price: float_10.Float,
        /** Next position ID counter. */
        next_position_id: bcs.u64(),
        /** Next order ID counter. */
        next_order_id: bcs.u64(),
        /** Last funding rate update timestamp. */
        last_funding_timestamp: bcs.u64(),
        /** Sign of cumulative funding rate index (true = longs pay). */
        cumulative_funding_sign: bcs.bool(),
        /** Cumulative funding index in USD per one base token (Double precision). */
        cumulative_funding_index: double.Double
    } });
export interface NewMarketConfigArguments {
    symbol: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint>;
    minCollValue: RawTransactionArgument<number | bigint>;
    tradingFee: RawTransactionArgument<number | bigint>;
    maintenanceMargin: RawTransactionArgument<number | bigint>;
    maxLongOi: RawTransactionArgument<string>;
    maxShortOi: RawTransactionArgument<string>;
    cooldownMs: RawTransactionArgument<number | bigint>;
    basicFundingRate: RawTransactionArgument<number | bigint>;
    fundingIntervalMs: RawTransactionArgument<number | bigint>;
}
export interface NewMarketConfigOptions {
    package?: string;
    arguments: NewMarketConfigArguments | [
        symbol: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint>,
        minCollValue: RawTransactionArgument<number | bigint>,
        tradingFee: RawTransactionArgument<number | bigint>,
        maintenanceMargin: RawTransactionArgument<number | bigint>,
        maxLongOi: RawTransactionArgument<string>,
        maxShortOi: RawTransactionArgument<string>,
        cooldownMs: RawTransactionArgument<number | bigint>,
        basicFundingRate: RawTransactionArgument<number | bigint>,
        fundingIntervalMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Creates a new MarketConfig (called by trading::create_market). `trading_fee`,
 * `maintenance_margin`, and `basic_funding_rate` are scaled Float values (1e9
 * scale). For example, a 5 bps fee = `500_000`.
 */
export function newMarketConfig(options: NewMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x1::string::String',
        'u64',
        'u64',
        'u128',
        'u128',
        null,
        null,
        'u64',
        'u128',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["symbol", "maxLeverageBps", "minCollValue", "tradingFee", "maintenanceMargin", "maxLongOi", "maxShortOi", "cooldownMs", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'new_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateMarketConfigArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint | null>;
    minCollValue: RawTransactionArgument<number | bigint | null>;
    tradingFee: RawTransactionArgument<number | bigint | null>;
    maxImpactFee: RawTransactionArgument<number | bigint | null>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>;
    impactFeeCurvature: RawTransactionArgument<number | bigint | null>;
    impactFeeScale: RawTransactionArgument<number | bigint | null>;
    maintenanceMargin: RawTransactionArgument<number | bigint | null>;
    maxLongOi: RawTransactionArgument<number | bigint | null>;
    maxShortOi: RawTransactionArgument<number | bigint | null>;
    cooldownMs: RawTransactionArgument<number | bigint | null>;
    orderPriceTick: RawTransactionArgument<string | null>;
    maxPreOrders: RawTransactionArgument<number | bigint | null>;
    basicFundingRate: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateMarketConfigOptions {
    package?: string;
    arguments: UpdateMarketConfigArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint | null>,
        minCollValue: RawTransactionArgument<number | bigint | null>,
        tradingFee: RawTransactionArgument<number | bigint | null>,
        maxImpactFee: RawTransactionArgument<number | bigint | null>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>,
        impactFeeCurvature: RawTransactionArgument<number | bigint | null>,
        impactFeeScale: RawTransactionArgument<number | bigint | null>,
        maintenanceMargin: RawTransactionArgument<number | bigint | null>,
        maxLongOi: RawTransactionArgument<number | bigint | null>,
        maxShortOi: RawTransactionArgument<number | bigint | null>,
        cooldownMs: RawTransactionArgument<number | bigint | null>,
        orderPriceTick: RawTransactionArgument<string | null>,
        maxPreOrders: RawTransactionArgument<number | bigint | null>,
        basicFundingRate: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
}
/**
 * Updates MarketConfig fields. `trading_fee`, `max_impact_fee`, and
 * `maintenance_margin` are scaled Float values (1e9 scale).
 */
export function updateMarketConfig(options: UpdateMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<null>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap", "maxLeverageBps", "minCollValue", "tradingFee", "maxImpactFee", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale", "maintenanceMargin", "maxLongOi", "maxShortOi", "cooldownMs", "orderPriceTick", "maxPreOrders", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'update_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateFundingConfigArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    basicFundingRate: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateFundingConfigOptions {
    package?: string;
    arguments: UpdateFundingConfigArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        basicFundingRate: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
}
export function updateFundingConfig(options: UpdateFundingConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap", "basicFundingRate", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'update_funding_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PauseMarketArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface PauseMarketOptions {
    package?: string;
    arguments: PauseMarketArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
}
/** Pauses a market config (blocks trading actions). */
export function pauseMarket(options: PauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'pause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnpauseMarketArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface UnpauseMarketOptions {
    package?: string;
    arguments: UnpauseMarketArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
}
/** Resumes a paused market. */
export function unpauseMarket(options: UnpauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'unpause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AddRequestRuleArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface AddRequestRuleOptions {
    package?: string;
    arguments: AddRequestRuleArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Adds a witness type to the request checklist. */
export function addRequestRule(options: AddRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'add_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveRequestRuleArguments {
    marketConfig: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
}
export interface RemoveRequestRuleOptions {
    package?: string;
    arguments: RemoveRequestRuleArguments | [
        marketConfig: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Removes a witness type from the request checklist. */
export function removeRequestRule(options: RemoveRequestRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketConfig", "Cap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'remove_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LockPositionArguments {
    m: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface LockPositionOptions {
    package?: string;
    arguments: LockPositionArguments | [
        m: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
/** Locks a position by ID (prevents reentrancy). */
export function lockPosition(options: LockPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["m", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'lock_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnlockPositionArguments {
    m: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface UnlockPositionOptions {
    package?: string;
    arguments: UnlockPositionArguments | [
        m: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
}
/** Unlocks a position at the tail of `execute`. */
export function unlockPosition(options: UnlockPositionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["m", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'unlock_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RequestChecklistArguments {
    m: RawTransactionArgument<string>;
}
export interface RequestChecklistOptions {
    package?: string;
    arguments: RequestChecklistArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function requestChecklist(options: RequestChecklistOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'request_checklist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigSymbolArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigSymbolOptions {
    package?: string;
    arguments: MarketConfigSymbolArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigSymbol(options: MarketConfigSymbolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_symbol',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigIsPausedArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigIsPausedOptions {
    package?: string;
    arguments: MarketConfigIsPausedArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigIsPaused(options: MarketConfigIsPausedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_is_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaxLeverageBpsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxLeverageBpsOptions {
    package?: string;
    arguments: MarketConfigMaxLeverageBpsArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaxLeverageBps(options: MarketConfigMaxLeverageBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_leverage_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMinCollValueArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMinCollValueOptions {
    package?: string;
    arguments: MarketConfigMinCollValueArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMinCollValue(options: MarketConfigMinCollValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_min_coll_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigTradingFeeArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigTradingFeeOptions {
    package?: string;
    arguments: MarketConfigTradingFeeArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigTradingFee(options: MarketConfigTradingFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_trading_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaxImpactFeeArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxImpactFeeOptions {
    package?: string;
    arguments: MarketConfigMaxImpactFeeArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaxImpactFee(options: MarketConfigMaxImpactFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_impact_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigAllocatedLpExposureBpsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigAllocatedLpExposureBpsOptions {
    package?: string;
    arguments: MarketConfigAllocatedLpExposureBpsArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigAllocatedLpExposureBps(options: MarketConfigAllocatedLpExposureBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_allocated_lp_exposure_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigImpactFeeCurvatureArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigImpactFeeCurvatureOptions {
    package?: string;
    arguments: MarketConfigImpactFeeCurvatureArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigImpactFeeCurvature(options: MarketConfigImpactFeeCurvatureOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_impact_fee_curvature',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigImpactFeeScaleArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigImpactFeeScaleOptions {
    package?: string;
    arguments: MarketConfigImpactFeeScaleArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigImpactFeeScale(options: MarketConfigImpactFeeScaleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_impact_fee_scale',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaintenanceMarginArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaintenanceMarginOptions {
    package?: string;
    arguments: MarketConfigMaintenanceMarginArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaintenanceMargin(options: MarketConfigMaintenanceMarginOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_maintenance_margin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaxLongOiArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxLongOiOptions {
    package?: string;
    arguments: MarketConfigMaxLongOiArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaxLongOi(options: MarketConfigMaxLongOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_long_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaxShortOiArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxShortOiOptions {
    package?: string;
    arguments: MarketConfigMaxShortOiArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaxShortOi(options: MarketConfigMaxShortOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_short_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigCooldownMsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigCooldownMsOptions {
    package?: string;
    arguments: MarketConfigCooldownMsArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigCooldownMs(options: MarketConfigCooldownMsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_cooldown_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigOrderPriceTickArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigOrderPriceTickOptions {
    package?: string;
    arguments: MarketConfigOrderPriceTickArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigOrderPriceTick(options: MarketConfigOrderPriceTickOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_order_price_tick',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigMaxPreOrdersArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxPreOrdersOptions {
    package?: string;
    arguments: MarketConfigMaxPreOrdersArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigMaxPreOrders(options: MarketConfigMaxPreOrdersOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_pre_orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigBasicFundingRateArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigBasicFundingRateOptions {
    package?: string;
    arguments: MarketConfigBasicFundingRateArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigBasicFundingRate(options: MarketConfigBasicFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_basic_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigFundingIntervalMsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigFundingIntervalMsOptions {
    package?: string;
    arguments: MarketConfigFundingIntervalMsArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigFundingIntervalMs(options: MarketConfigFundingIntervalMsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_funding_interval_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigLongOiArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigLongOiOptions {
    package?: string;
    arguments: MarketConfigLongOiArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigLongOi(options: MarketConfigLongOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_long_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigShortOiArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigShortOiOptions {
    package?: string;
    arguments: MarketConfigShortOiArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigShortOi(options: MarketConfigShortOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_short_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigLongAvgEntryPriceArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigLongAvgEntryPriceOptions {
    package?: string;
    arguments: MarketConfigLongAvgEntryPriceArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigLongAvgEntryPrice(options: MarketConfigLongAvgEntryPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_long_avg_entry_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigShortAvgEntryPriceArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigShortAvgEntryPriceOptions {
    package?: string;
    arguments: MarketConfigShortAvgEntryPriceArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigShortAvgEntryPrice(options: MarketConfigShortAvgEntryPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_short_avg_entry_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigNextPositionIdArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigNextPositionIdOptions {
    package?: string;
    arguments: MarketConfigNextPositionIdArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigNextPositionId(options: MarketConfigNextPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_next_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigNextOrderIdArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigNextOrderIdOptions {
    package?: string;
    arguments: MarketConfigNextOrderIdArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigNextOrderId(options: MarketConfigNextOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_next_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigCumulativeFundingSignArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigCumulativeFundingSignOptions {
    package?: string;
    arguments: MarketConfigCumulativeFundingSignArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigCumulativeFundingSign(options: MarketConfigCumulativeFundingSignOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_cumulative_funding_sign',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigCumulativeFundingIndexArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigCumulativeFundingIndexOptions {
    package?: string;
    arguments: MarketConfigCumulativeFundingIndexArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigCumulativeFundingIndex(options: MarketConfigCumulativeFundingIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_cumulative_funding_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketConfigLastFundingTimestampArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigLastFundingTimestampOptions {
    package?: string;
    arguments: MarketConfigLastFundingTimestampArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function marketConfigLastFundingTimestamp(options: MarketConfigLastFundingTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_last_funding_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IncrementNextPositionIdArguments {
    m: RawTransactionArgument<string>;
}
export interface IncrementNextPositionIdOptions {
    package?: string;
    arguments: IncrementNextPositionIdArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function incrementNextPositionId(options: IncrementNextPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'increment_next_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IncrementNextOrderIdArguments {
    m: RawTransactionArgument<string>;
}
export interface IncrementNextOrderIdOptions {
    package?: string;
    arguments: IncrementNextOrderIdArguments | [
        m: RawTransactionArgument<string>
    ];
}
export function incrementNextOrderId(options: IncrementNextOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'increment_next_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IncreaseOiArguments {
    m: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    amount: RawTransactionArgument<string>;
    entryPrice: RawTransactionArgument<string>;
}
export interface IncreaseOiOptions {
    package?: string;
    arguments: IncreaseOiArguments | [
        m: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        amount: RawTransactionArgument<string>,
        entryPrice: RawTransactionArgument<string>
    ];
}
export function increaseOi(options: IncreaseOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'bool',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m", "isLong", "amount", "entryPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'increase_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DecreaseOiArguments {
    m: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    amount: RawTransactionArgument<string>;
}
export interface DecreaseOiOptions {
    package?: string;
    arguments: DecreaseOiArguments | [
        m: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        amount: RawTransactionArgument<string>
    ];
}
export function decreaseOi(options: DecreaseOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m", "isLong", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'decrease_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UnrealizedTraderPnlArguments {
    m: RawTransactionArgument<string>;
    currentPrice: RawTransactionArgument<string>;
}
export interface UnrealizedTraderPnlOptions {
    package?: string;
    arguments: UnrealizedTraderPnlArguments | [
        m: RawTransactionArgument<string>,
        currentPrice: RawTransactionArgument<string>
    ];
}
export function unrealizedTraderPnl(options: UnrealizedTraderPnlOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m", "currentPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'unrealized_trader_pnl',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface LpEquityUsdArguments {
    m: RawTransactionArgument<string>;
    poolTvlUsd: RawTransactionArgument<string>;
    currentPrice: RawTransactionArgument<string>;
}
export interface LpEquityUsdOptions {
    package?: string;
    arguments: LpEquityUsdArguments | [
        m: RawTransactionArgument<string>,
        poolTvlUsd: RawTransactionArgument<string>,
        currentPrice: RawTransactionArgument<string>
    ];
}
export function lpEquityUsd(options: LpEquityUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m", "poolTvlUsd", "currentPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'lp_equity_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateFundingStateArguments {
    m: RawTransactionArgument<string>;
    sign: RawTransactionArgument<boolean>;
    index: RawTransactionArgument<string>;
    timestamp: RawTransactionArgument<number | bigint>;
}
export interface UpdateFundingStateOptions {
    package?: string;
    arguments: UpdateFundingStateArguments | [
        m: RawTransactionArgument<string>,
        sign: RawTransactionArgument<boolean>,
        index: RawTransactionArgument<string>,
        timestamp: RawTransactionArgument<number | bigint>
    ];
}
export function updateFundingState(options: UpdateFundingStateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'bool',
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["m", "sign", "index", "timestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'update_funding_state',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UpdateFundingRateArguments {
    market: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<string>;
    nowMs: RawTransactionArgument<number | bigint>;
    basePrice: RawTransactionArgument<string>;
    tvlUsd: RawTransactionArgument<string>;
}
export interface UpdateFundingRateOptions {
    package?: string;
    arguments: UpdateFundingRateArguments | [
        market: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<string>,
        nowMs: RawTransactionArgument<number | bigint>,
        basePrice: RawTransactionArgument<string>,
        tvlUsd: RawTransactionArgument<string>
    ];
}
/**
 * Updates the funding rate for a market. Called by keeper at regular intervals
 * (default 1 hour). Returns true if the funding rate was updated.
 */
export function updateFundingRate(options: UpdateFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::object::ID',
        'u64',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["market", "marketId", "nowMs", "basePrice", "tvlUsd"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'update_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateFundingRateArguments {
    longOiUsd: RawTransactionArgument<string>;
    shortOiUsd: RawTransactionArgument<string>;
    basicRate: RawTransactionArgument<string>;
    tvlUsd: RawTransactionArgument<string>;
}
export interface CalculateFundingRateOptions {
    package?: string;
    arguments: CalculateFundingRateArguments | [
        longOiUsd: RawTransactionArgument<string>,
        shortOiUsd: RawTransactionArgument<string>,
        basicRate: RawTransactionArgument<string>,
        tvlUsd: RawTransactionArgument<string>
    ];
}
/**
 * Calculates the funding rate based on LP exposure relative to TVL. OI values
 * should be in USD (caller converts via base_price). Returns (sign, rate) where
 * sign=true means longs pay.
 */
export function calculateFundingRate(options: CalculateFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["longOiUsd", "shortOiUsd", "basicRate", "tvlUsd"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'calculate_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertValidImpactFeeConfigArguments {
    maxImpactFee: RawTransactionArgument<string>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint>;
    impactFeeCurvature: RawTransactionArgument<number | bigint>;
    impactFeeScale: RawTransactionArgument<number | bigint>;
}
export interface AssertValidImpactFeeConfigOptions {
    package?: string;
    arguments: AssertValidImpactFeeConfigArguments | [
        maxImpactFee: RawTransactionArgument<string>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint>,
        impactFeeCurvature: RawTransactionArgument<number | bigint>,
        impactFeeScale: RawTransactionArgument<number | bigint>
    ];
}
export function assertValidImpactFeeConfig(options: AssertValidImpactFeeConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["maxImpactFee", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'assert_valid_impact_fee_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface WeightedAveragePriceArguments {
    currentSize: RawTransactionArgument<string>;
    currentAveragePrice: RawTransactionArgument<string>;
    addSize: RawTransactionArgument<string>;
    addPrice: RawTransactionArgument<string>;
}
export interface WeightedAveragePriceOptions {
    package?: string;
    arguments: WeightedAveragePriceArguments | [
        currentSize: RawTransactionArgument<string>,
        currentAveragePrice: RawTransactionArgument<string>,
        addSize: RawTransactionArgument<string>,
        addPrice: RawTransactionArgument<string>
    ];
}
export function weightedAveragePrice(options: WeightedAveragePriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["currentSize", "currentAveragePrice", "addSize", "addPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'weighted_average_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}