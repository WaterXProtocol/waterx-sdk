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
import * as type_name from './deps/std/type_name.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as float_4 from './deps/bucket_v2_framework/float.ts';
import * as float_5 from './deps/bucket_v2_framework/float.ts';
import * as double from './deps/bucket_v2_framework/double.ts';
const $moduleName = '@waterx/perp::market_config';
export const MarketConfig = new MoveStruct({ name: `${$moduleName}::MarketConfig<phantom BASE_TOKEN>`, fields: {
        id: bcs.Address,
        /** Whether this market is active. */
        is_active: bcs.bool(),
        /** Maximum leverage in bps (e.g., 100x = 1_000_000 bps). */
        max_leverage_bps: bcs.u64(),
        /** Minimum position collateral value in USD, scaled by 1e9. */
        min_coll_value: bcs.u64(),
        /** Base trading fee in bps. */
        trading_fee_bps: bcs.u64(),
        /** Maximum additional impact fee in bps. */
        max_impact_fee_bps: bcs.u64(),
        /** Share of LP TVL allocated to net exposure before impact hits max, in bps. */
        allocated_lp_exposure_bps: bcs.u64(),
        /** Curvature exponent for the impact fee curve. */
        impact_fee_curvature: bcs.u64(),
        /** Scale divisor applied to the exposure ratio before curvature. */
        impact_fee_scale: bcs.u64(),
        /** Maintenance margin rate in bps (default 150). */
        maintenance_margin_bps: bcs.u64(),
        /** Maximum long open interest as Float (in base tokens). */
        max_long_oi: float.Float,
        /** Maximum short open interest as Float (in base tokens). */
        max_short_oi: float_1.Float,
        /** Cooldown between position updates in ms. */
        cooldown_ms: bcs.u64(),
        /** Bucket size for order book trigger price normalization. */
        order_price_tick: float_2.Float,
        /** Basic funding rate per interval (Float, typically ~0.01% = 1 bps). */
        basic_funding_rate: float_3.Float,
        /** Funding interval in milliseconds (default 3600000 = 1 hour). */
        funding_interval_ms: bcs.u64(),
        /** Required witness types before execution. */
        request_checklist: bcs.vector(type_name.TypeName),
        /** Required witness types before response destruction. */
        response_checklist: bcs.vector(type_name_1.TypeName),
        /** Prevents reentrancy: locked during request→response lifecycle. */
        position_locker: vec_set.VecSet(bcs.u64()),
        /** Current long open interest as Float. */
        long_oi: float_4.Float,
        /** Current short open interest as Float. */
        short_oi: float_5.Float,
        /** Next position ID counter. */
        next_position_id: bcs.u64(),
        /** Next order ID counter. */
        next_order_id: bcs.u64(),
        /** Last funding rate update timestamp. */
        last_funding_timestamp: bcs.u64(),
        /** Sign of cumulative funding rate index (true = longs pay). */
        cumulative_funding_sign: bcs.bool(),
        /** Cumulative funding rate index (Double precision). */
        cumulative_funding_index: double.Double
    } });
export interface NewMarketConfigArguments {
    maxLeverageBps: RawTransactionArgument<number | bigint>;
    minCollValue: RawTransactionArgument<number | bigint>;
    tradingFeeBps: RawTransactionArgument<number | bigint>;
    maintenanceMarginBps: RawTransactionArgument<number | bigint>;
    maxLongOi: RawTransactionArgument<string>;
    maxShortOi: RawTransactionArgument<string>;
    cooldownMs: RawTransactionArgument<number | bigint>;
    basicFundingRateBps: RawTransactionArgument<number | bigint>;
    fundingIntervalMs: RawTransactionArgument<number | bigint>;
}
export interface NewMarketConfigOptions {
    package?: string;
    arguments: NewMarketConfigArguments | [
        maxLeverageBps: RawTransactionArgument<number | bigint>,
        minCollValue: RawTransactionArgument<number | bigint>,
        tradingFeeBps: RawTransactionArgument<number | bigint>,
        maintenanceMarginBps: RawTransactionArgument<number | bigint>,
        maxLongOi: RawTransactionArgument<string>,
        maxShortOi: RawTransactionArgument<string>,
        cooldownMs: RawTransactionArgument<number | bigint>,
        basicFundingRateBps: RawTransactionArgument<number | bigint>,
        fundingIntervalMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Creates a new MarketConfig (called by trading::create_market). */
export function newMarketConfig(options: NewMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64',
        null,
        null,
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["maxLeverageBps", "minCollValue", "tradingFeeBps", "maintenanceMarginBps", "maxLongOi", "maxShortOi", "cooldownMs", "basicFundingRateBps", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'new_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateMarketConfigArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
    maxLeverageBps: RawTransactionArgument<number | bigint | null>;
    minCollValue: RawTransactionArgument<number | bigint | null>;
    tradingFeeBps: RawTransactionArgument<number | bigint | null>;
    maxImpactFeeBps: RawTransactionArgument<number | bigint | null>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>;
    impactFeeCurvature: RawTransactionArgument<number | bigint | null>;
    impactFeeScale: RawTransactionArgument<number | bigint | null>;
    maintenanceMarginBps: RawTransactionArgument<number | bigint | null>;
    maxLongOi: RawTransactionArgument<number | bigint | null>;
    maxShortOi: RawTransactionArgument<number | bigint | null>;
    cooldownMs: RawTransactionArgument<number | bigint | null>;
    orderPriceTick: RawTransactionArgument<string | null>;
    basicFundingRateBps: RawTransactionArgument<number | bigint | null>;
    fundingIntervalMs: RawTransactionArgument<number | bigint | null>;
}
export interface UpdateMarketConfigOptions {
    package?: string;
    arguments: UpdateMarketConfigArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>,
        maxLeverageBps: RawTransactionArgument<number | bigint | null>,
        minCollValue: RawTransactionArgument<number | bigint | null>,
        tradingFeeBps: RawTransactionArgument<number | bigint | null>,
        maxImpactFeeBps: RawTransactionArgument<number | bigint | null>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint | null>,
        impactFeeCurvature: RawTransactionArgument<number | bigint | null>,
        impactFeeScale: RawTransactionArgument<number | bigint | null>,
        maintenanceMarginBps: RawTransactionArgument<number | bigint | null>,
        maxLongOi: RawTransactionArgument<number | bigint | null>,
        maxShortOi: RawTransactionArgument<number | bigint | null>,
        cooldownMs: RawTransactionArgument<number | bigint | null>,
        orderPriceTick: RawTransactionArgument<string | null>,
        basicFundingRateBps: RawTransactionArgument<number | bigint | null>,
        fundingIntervalMs: RawTransactionArgument<number | bigint | null>
    ];
    typeArguments: [
        string
    ];
}
/** Updates MarketConfig fields. */
export function updateMarketConfig(options: UpdateMarketConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u128>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<null>',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "marketConfig", "maxLeverageBps", "minCollValue", "tradingFeeBps", "maxImpactFeeBps", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale", "maintenanceMarginBps", "maxLongOi", "maxShortOi", "cooldownMs", "orderPriceTick", "basicFundingRateBps", "fundingIntervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'update_market_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SuspendMarketArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface SuspendMarketOptions {
    package?: string;
    arguments: SuspendMarketArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Suspends a market config. */
export function suspendMarket(options: SuspendMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'suspend_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumeMarketArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface ResumeMarketOptions {
    package?: string;
    arguments: ResumeMarketArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Resumes a market config. */
export function resumeMarket(options: ResumeMarketOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'resume_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddRequestRuleArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface AddRequestRuleOptions {
    package?: string;
    arguments: AddRequestRuleArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
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
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'add_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveRequestRuleArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface RemoveRequestRuleOptions {
    package?: string;
    arguments: RemoveRequestRuleArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
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
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'remove_request_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddResponseRuleArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface AddResponseRuleOptions {
    package?: string;
    arguments: AddResponseRuleArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Adds a witness type to the response checklist. */
export function addResponseRule(options: AddResponseRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'add_response_rule',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveResponseRuleArguments {
    Cap: RawTransactionArgument<string>;
    marketConfig: RawTransactionArgument<string>;
}
export interface RemoveResponseRuleOptions {
    package?: string;
    arguments: RemoveResponseRuleArguments | [
        Cap: RawTransactionArgument<string>,
        marketConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Removes a witness type from the response checklist. */
export function removeResponseRule(options: RemoveResponseRuleOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "marketConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'remove_response_rule',
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
    ];
}
/** Unlocks a position after response destruction. */
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
    });
}
export interface ResponseChecklistArguments {
    m: RawTransactionArgument<string>;
}
export interface ResponseChecklistOptions {
    package?: string;
    arguments: ResponseChecklistArguments | [
        m: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function responseChecklist(options: ResponseChecklistOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'response_checklist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketConfigIsActiveArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigIsActiveOptions {
    package?: string;
    arguments: MarketConfigIsActiveArguments | [
        m: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketConfigIsActive(options: MarketConfigIsActiveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
    });
}
export interface MarketConfigTradingFeeBpsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigTradingFeeBpsOptions {
    package?: string;
    arguments: MarketConfigTradingFeeBpsArguments | [
        m: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketConfigTradingFeeBps(options: MarketConfigTradingFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_trading_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketConfigMaxImpactFeeBpsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaxImpactFeeBpsOptions {
    package?: string;
    arguments: MarketConfigMaxImpactFeeBpsArguments | [
        m: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketConfigMaxImpactFeeBps(options: MarketConfigMaxImpactFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_max_impact_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
    });
}
export interface MarketConfigMaintenanceMarginBpsArguments {
    m: RawTransactionArgument<string>;
}
export interface MarketConfigMaintenanceMarginBpsOptions {
    package?: string;
    arguments: MarketConfigMaintenanceMarginBpsArguments | [
        m: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketConfigMaintenanceMarginBps(options: MarketConfigMaintenanceMarginBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'market_config_maintenance_margin_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
    });
}
export interface AdjustOiArguments {
    m: RawTransactionArgument<string>;
    isLong: RawTransactionArgument<boolean>;
    increase: RawTransactionArgument<boolean>;
    amount: RawTransactionArgument<string>;
}
export interface AdjustOiOptions {
    package?: string;
    arguments: AdjustOiArguments | [
        m: RawTransactionArgument<string>,
        isLong: RawTransactionArgument<boolean>,
        increase: RawTransactionArgument<boolean>,
        amount: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function adjustOi(options: AdjustOiOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'bool',
        'bool',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["m", "isLong", "increase", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'adjust_oi',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
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
    typeArguments: [
        string
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
        typeArguments: options.typeArguments
    });
}
export interface CalculateFundingRateArguments {
    longOi: RawTransactionArgument<string>;
    shortOi: RawTransactionArgument<string>;
    basicRate: RawTransactionArgument<string>;
}
export interface CalculateFundingRateOptions {
    package?: string;
    arguments: CalculateFundingRateArguments | [
        longOi: RawTransactionArgument<string>,
        shortOi: RawTransactionArgument<string>,
        basicRate: RawTransactionArgument<string>
    ];
}
/**
 * @deprecated Use `calculate_funding_rate_v2` instead. Uses OI-ratio formula: rate
 * = basic_rate \* |long - short| / max(long, short).
 */
export function calculateFundingRate(options: CalculateFundingRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["longOi", "shortOi", "basicRate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'calculate_funding_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateFundingRateV2Arguments {
    longOiUsd: RawTransactionArgument<string>;
    shortOiUsd: RawTransactionArgument<string>;
    basicRate: RawTransactionArgument<string>;
    tvlUsd: RawTransactionArgument<string>;
}
export interface CalculateFundingRateV2Options {
    package?: string;
    arguments: CalculateFundingRateV2Arguments | [
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
export function calculateFundingRateV2(options: CalculateFundingRateV2Options) {
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
        function: 'calculate_funding_rate_v2',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertValidImpactFeeConfigArguments {
    maxImpactFeeBps: RawTransactionArgument<number | bigint>;
    allocatedLpExposureBps: RawTransactionArgument<number | bigint>;
    impactFeeCurvature: RawTransactionArgument<number | bigint>;
    impactFeeScale: RawTransactionArgument<number | bigint>;
}
export interface AssertValidImpactFeeConfigOptions {
    package?: string;
    arguments: AssertValidImpactFeeConfigArguments | [
        maxImpactFeeBps: RawTransactionArgument<number | bigint>,
        allocatedLpExposureBps: RawTransactionArgument<number | bigint>,
        impactFeeCurvature: RawTransactionArgument<number | bigint>,
        impactFeeScale: RawTransactionArgument<number | bigint>
    ];
}
export function assertValidImpactFeeConfig(options: AssertValidImpactFeeConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["maxImpactFeeBps", "allocatedLpExposureBps", "impactFeeCurvature", "impactFeeScale"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'market_config',
        function: 'assert_valid_impact_fee_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}