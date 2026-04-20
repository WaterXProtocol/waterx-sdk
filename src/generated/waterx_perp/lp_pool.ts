/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * WLP (WaterX Liquidity Pool) — counterparty to all traders. Manages liquidity
 * pools, token pools, minting/burning WLP, and borrowing. Mint is instant; redeem
 * is T+1.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as coin from './deps/sui/coin.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as keyed_big_vector from './keyed_big_vector.ts';
import * as balance from './deps/sui/balance.ts';
import * as type_name_2 from './deps/std/type_name.ts';
const $moduleName = '@waterx/perp::lp_pool';
export const TokenPoolInfo = new MoveStruct({ name: `${$moduleName}::TokenPoolInfo`, fields: {
        /** Token type. */
        token_type: type_name.TypeName,
        /** Token decimal. */
        token_decimal: bcs.u8(),
        /** Target weight in bps (e.g., 5000 = 50%). */
        target_weight_bps: bcs.u64(),
        /** Mint fee in bps. */
        mint_fee_bps: bcs.u64(),
        /** Burn fee in bps. */
        burn_fee_bps: bcs.u64(),
        /** Max capacity. */
        max_capacity: bcs.u64(),
        /** Min deposit. */
        min_deposit: bcs.u64(),
        basic_borrow_rate_0: bcs.u64(),
        basic_borrow_rate_1: bcs.u64(),
        basic_borrow_rate_2: bcs.u64(),
        utilization_threshold_0_bps: bcs.u64(),
        utilization_threshold_1_bps: bcs.u64(),
        borrow_interval_ms: bcs.u64(),
        max_reserve_ratio_bps: bcs.u64(),
        /** Liquidity amount in token units. */
        liquidity_amount: bcs.u64(),
        /** Value in USD. */
        value_usd: float.Float,
        /** Reserved amount for open positions. */
        reserved_amount: bcs.u64(),
        /** Last borrow rate update timestamp. */
        last_borrow_timestamp: bcs.u64(),
        /** Cumulative borrow rate. */
        cumulative_borrow_rate: bcs.u64(),
        /** Last timestamp when this token price was refreshed via oracle. */
        last_price_refresh_timestamp: bcs.u64()
    } });
export const WlpPool = new MoveStruct({ name: `${$moduleName}::WlpPool<phantom LP_TOKEN>`, fields: {
        id: bcs.Address,
        /** Whether this pool is active. */
        is_active: bcs.bool(),
        /** Allowed protocol versions (admin-managed). */
        allowed_versions: vec_set.VecSet(bcs.u16()),
        /** LP token treasury cap. */
        lp_treasury_cap: coin.TreasuryCap,
        /** LP token decimal. */
        lp_decimal: bcs.u8(),
        /** Supported token types. */
        token_types: bcs.vector(type_name_1.TypeName),
        /** Token pool configs and states. */
        token_pools: bcs.vector(TokenPoolInfo),
        /** Total value locked in USD (Float). */
        tvl_usd: float_1.Float,
        /** Redeem requests. */
        redeem_requests: keyed_big_vector.KeyedBigVector,
        /** Next redeem request ID. */
        next_redeem_id: bcs.u64()
    } });
export const RedeemRequest = new MoveStruct({ name: `${$moduleName}::RedeemRequest<phantom LP_TOKEN>`, fields: {
        /** Recipient address. */
        recipient: bcs.Address,
        /** LP balance held pending settlement. */
        lp_balance: balance.Balance,
        /** Requested token type to receive. */
        token_type: type_name_2.TypeName,
        /** Request timestamp. */
        request_timestamp: bcs.u64()
    } });
export interface CreatePoolArguments {
    Cap: RawTransactionArgument<string>;
    lpTreasuryCap: RawTransactionArgument<string>;
    lpDecimal: RawTransactionArgument<number>;
}
export interface CreatePoolOptions {
    package?: string;
    arguments: CreatePoolArguments | [
        Cap: RawTransactionArgument<string>,
        lpTreasuryCap: RawTransactionArgument<string>,
        lpDecimal: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
/** Creates a new WLP pool (AdminCap-gated). */
export function createPool(options: CreatePoolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u8'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "lpTreasuryCap", "lpDecimal"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'create_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertVersionArguments {
    wlpPool: RawTransactionArgument<string>;
}
export interface AssertVersionOptions {
    package?: string;
    arguments: AssertVersionArguments | [
        wlpPool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertVersion(options: AssertVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["wlpPool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'assert_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AllowVersionArguments {
    _: RawTransactionArgument<string>;
    wlpPool: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface AllowVersionOptions {
    package?: string;
    arguments: AllowVersionArguments | [
        _: RawTransactionArgument<string>,
        wlpPool: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function allowVersion(options: AllowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "wlpPool", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'allow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DisallowVersionArguments {
    _: RawTransactionArgument<string>;
    wlpPool: RawTransactionArgument<string>;
    v: RawTransactionArgument<number>;
}
export interface DisallowVersionOptions {
    package?: string;
    arguments: DisallowVersionArguments | [
        _: RawTransactionArgument<string>,
        wlpPool: RawTransactionArgument<string>,
        v: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function disallowVersion(options: DisallowVersionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "wlpPool", "v"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'disallow_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddTokenArguments {
    Cap: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    tokenDecimal: RawTransactionArgument<number>;
    targetWeightBps: RawTransactionArgument<number | bigint>;
    mintFeeBps: RawTransactionArgument<number | bigint>;
    burnFeeBps: RawTransactionArgument<number | bigint>;
    maxCapacity: RawTransactionArgument<number | bigint>;
    minDeposit: RawTransactionArgument<number | bigint>;
    basicBorrowRate_0: RawTransactionArgument<number | bigint>;
    basicBorrowRate_1: RawTransactionArgument<number | bigint>;
    basicBorrowRate_2: RawTransactionArgument<number | bigint>;
    utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>;
    utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>;
    borrowIntervalMs: RawTransactionArgument<number | bigint>;
    maxReserveRatioBps: RawTransactionArgument<number | bigint>;
}
export interface AddTokenOptions {
    package?: string;
    arguments: AddTokenArguments | [
        Cap: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        tokenDecimal: RawTransactionArgument<number>,
        targetWeightBps: RawTransactionArgument<number | bigint>,
        mintFeeBps: RawTransactionArgument<number | bigint>,
        burnFeeBps: RawTransactionArgument<number | bigint>,
        maxCapacity: RawTransactionArgument<number | bigint>,
        minDeposit: RawTransactionArgument<number | bigint>,
        basicBorrowRate_0: RawTransactionArgument<number | bigint>,
        basicBorrowRate_1: RawTransactionArgument<number | bigint>,
        basicBorrowRate_2: RawTransactionArgument<number | bigint>,
        utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>,
        utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>,
        borrowIntervalMs: RawTransactionArgument<number | bigint>,
        maxReserveRatioBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Adds a supported token to the pool. */
export function addToken(options: AddTokenOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u8',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "pool", "tokenDecimal", "targetWeightBps", "mintFeeBps", "burnFeeBps", "maxCapacity", "minDeposit", "basicBorrowRate_0", "basicBorrowRate_1", "basicBorrowRate_2", "utilizationThreshold_0Bps", "utilizationThreshold_1Bps", "borrowIntervalMs", "maxReserveRatioBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'add_token',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateTokenPoolConfigArguments {
    Cap: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
    targetWeightBps: RawTransactionArgument<number | bigint>;
    mintFeeBps: RawTransactionArgument<number | bigint>;
    burnFeeBps: RawTransactionArgument<number | bigint>;
    maxCapacity: RawTransactionArgument<number | bigint>;
    minDeposit: RawTransactionArgument<number | bigint>;
    basicBorrowRate_0: RawTransactionArgument<number | bigint>;
    basicBorrowRate_1: RawTransactionArgument<number | bigint>;
    basicBorrowRate_2: RawTransactionArgument<number | bigint>;
    utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>;
    utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>;
    borrowIntervalMs: RawTransactionArgument<number | bigint>;
    maxReserveRatioBps: RawTransactionArgument<number | bigint>;
}
export interface UpdateTokenPoolConfigOptions {
    package?: string;
    arguments: UpdateTokenPoolConfigArguments | [
        Cap: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>,
        targetWeightBps: RawTransactionArgument<number | bigint>,
        mintFeeBps: RawTransactionArgument<number | bigint>,
        burnFeeBps: RawTransactionArgument<number | bigint>,
        maxCapacity: RawTransactionArgument<number | bigint>,
        minDeposit: RawTransactionArgument<number | bigint>,
        basicBorrowRate_0: RawTransactionArgument<number | bigint>,
        basicBorrowRate_1: RawTransactionArgument<number | bigint>,
        basicBorrowRate_2: RawTransactionArgument<number | bigint>,
        utilizationThreshold_0Bps: RawTransactionArgument<number | bigint>,
        utilizationThreshold_1Bps: RawTransactionArgument<number | bigint>,
        borrowIntervalMs: RawTransactionArgument<number | bigint>,
        maxReserveRatioBps: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Updates configuration for an existing token pool (AdminCap-gated). Does not
 * modify state fields (liquidity, value, reserved, borrow state).
 */
export function updateTokenPoolConfig(options: UpdateTokenPoolConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "pool", "targetWeightBps", "mintFeeBps", "burnFeeBps", "maxCapacity", "minDeposit", "basicBorrowRate_0", "basicBorrowRate_1", "basicBorrowRate_2", "utilizationThreshold_0Bps", "utilizationThreshold_1Bps", "borrowIntervalMs", "maxReserveRatioBps"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'update_token_pool_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintWlpArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    deposit: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    minLpAmount: RawTransactionArgument<number | bigint>;
}
export interface MintWlpOptions {
    package?: string;
    arguments: MintWlpArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        deposit: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        minLpAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Mints WLP tokens by depositing a token. Instant. */
export function mintWlp(options: MintWlpOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "deposit", "priceResult", "minLpAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'mint_wlp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintWlpToArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    deposit: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
    minLpAmount: RawTransactionArgument<number | bigint>;
    recipient: RawTransactionArgument<string>;
}
export interface MintWlpToOptions {
    package?: string;
    arguments: MintWlpToArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        deposit: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>,
        minLpAmount: RawTransactionArgument<number | bigint>,
        recipient: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Mints WLP tokens and transfers them to `recipient`. Convenience wrapper. */
export function mintWlpTo(options: MintWlpToOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "deposit", "priceResult", "minLpAmount", "recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'mint_wlp_to',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestRedeemArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    lpCoin: RawTransactionArgument<string>;
    recipient: RawTransactionArgument<string>;
}
export interface RequestRedeemOptions {
    package?: string;
    arguments: RequestRedeemArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        lpCoin: RawTransactionArgument<string>,
        recipient: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Requests a WLP redeem (T+1 settlement). */
export function requestRedeem(options: RequestRedeemOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::clock::Clock',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "lpCoin", "recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'request_redeem',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelRedeemArguments {
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
}
export interface CancelRedeemOptions {
    package?: string;
    arguments: CancelRedeemArguments | [
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Cancels a pending WLP redeem request. Caller must be the original requester.
 * Re-mints the LP tokens back to the user.
 */
export function cancelRedeem(options: CancelRedeemOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "senderRequest", "requestId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'cancel_redeem',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelRedeemAndTransferArguments {
    pool: RawTransactionArgument<string>;
    senderRequest: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
}
export interface CancelRedeemAndTransferOptions {
    package?: string;
    arguments: CancelRedeemAndTransferArguments | [
        pool: RawTransactionArgument<string>,
        senderRequest: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Cancels a redeem request and transfers the LP tokens to the caller directly. */
export function cancelRedeemAndTransfer(options: CancelRedeemAndTransferOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "senderRequest", "requestId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'cancel_redeem_and_transfer',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SettleRedeemArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    requestId: RawTransactionArgument<number | bigint>;
    priceResult: RawTransactionArgument<string>;
}
export interface SettleRedeemOptions {
    package?: string;
    arguments: SettleRedeemArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        requestId: RawTransactionArgument<number | bigint>,
        priceResult: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Settles a WLP redeem request */
export function settleRedeem(options: SettleRedeemOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "requestId", "priceResult"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'settle_redeem',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateBorrowRatesArguments {
    pool: RawTransactionArgument<string>;
}
export interface UpdateBorrowRatesOptions {
    package?: string;
    arguments: UpdateBorrowRatesArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Updates borrow rates for all token pools. */
export function updateBorrowRates(options: UpdateBorrowRatesOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'update_borrow_rates',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateTokenValueArguments {
    pool: RawTransactionArgument<string>;
    priceResult: RawTransactionArgument<string>;
}
export interface UpdateTokenValueOptions {
    package?: string;
    arguments: UpdateTokenValueArguments | [
        pool: RawTransactionArgument<string>,
        priceResult: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function updateTokenValue(options: UpdateTokenValueOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "priceResult"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'update_token_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CumulativeBorrowRateArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface CumulativeBorrowRateOptions {
    package?: string;
    arguments: CumulativeBorrowRateArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets cumulative borrow rate for a token. */
export function cumulativeBorrowRate(options: CumulativeBorrowRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'cumulative_borrow_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TvlUsdArguments {
    pool: RawTransactionArgument<string>;
}
export interface TvlUsdOptions {
    package?: string;
    arguments: TvlUsdArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets TVL in USD. */
export function tvlUsd(options: TvlUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tvl_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CheckOiCapArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    totalOiUsd: RawTransactionArgument<string>;
}
export interface CheckOiCapOptions {
    package?: string;
    arguments: CheckOiCapArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        totalOiUsd: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Checks if OI is within cap (reads from global_config.oi_cap_bps; 0 = no cap). */
export function checkOiCap(options: CheckOiCapOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "totalOiUsd"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'check_oi_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CheckReserveValidArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    additionalReserve: RawTransactionArgument<number | bigint>;
}
export interface CheckReserveValidOptions {
    package?: string;
    arguments: CheckReserveValidArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        additionalReserve: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Checks if reserve is within max ratio. */
export function checkReserveValid(options: CheckReserveValidOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType", "additionalReserve"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'check_reserve_valid',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IncreaseReserveArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface IncreaseReserveOptions {
    package?: string;
    arguments: IncreaseReserveArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Increases reserved amount. */
export function increaseReserve(options: IncreaseReserveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'increase_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DecreaseReserveArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface DecreaseReserveOptions {
    package?: string;
    arguments: DecreaseReserveArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Decreases reserved amount. */
export function decreaseReserve(options: DecreaseReserveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'decrease_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PutCollateralArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    collateral: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
}
export interface PutCollateralOptions {
    package?: string;
    arguments: PutCollateralArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        collateral: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Puts collateral back into the pool (from fees/losses). */
export function putCollateral(options: PutCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "collateral", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'put_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestCollateralArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    price: RawTransactionArgument<string>;
}
export interface RequestCollateralOptions {
    package?: string;
    arguments: RequestCollateralArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        price: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Requests collateral from the pool (for profit payout). */
export function requestCollateral(options: RequestCollateralOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig", "amount", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'request_collateral',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TokenPoolInfoArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface TokenPoolInfoOptions {
    package?: string;
    arguments: TokenPoolInfoArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets token pool info (copy). */
export function tokenPoolInfo(options: TokenPoolInfoOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'token_pool_info',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TokenDecimalArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface TokenDecimalOptions {
    package?: string;
    arguments: TokenDecimalArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Gets token decimal. */
export function tokenDecimal(options: TokenDecimalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'token_decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SuspendPoolArguments {
    Cap: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface SuspendPoolOptions {
    package?: string;
    arguments: SuspendPoolArguments | [
        Cap: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Suspend/resume pool. */
export function suspendPool(options: SuspendPoolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'suspend_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResumePoolArguments {
    Cap: RawTransactionArgument<string>;
    pool: RawTransactionArgument<string>;
}
export interface ResumePoolOptions {
    package?: string;
    arguments: ResumePoolArguments | [
        Cap: RawTransactionArgument<string>,
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resumePool(options: ResumePoolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["Cap", "pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'resume_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsActiveArguments {
    pool: RawTransactionArgument<string>;
}
export interface IsActiveOptions {
    package?: string;
    arguments: IsActiveArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Whether the pool is active. */
export function isActive(options: IsActiveOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'is_active',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LpDecimalArguments {
    pool: RawTransactionArgument<string>;
}
export interface LpDecimalOptions {
    package?: string;
    arguments: LpDecimalArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** LP token decimal. */
export function lpDecimal(options: LpDecimalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'lp_decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TotalLpSupplyArguments {
    pool: RawTransactionArgument<string>;
}
export interface TotalLpSupplyOptions {
    package?: string;
    arguments: TotalLpSupplyArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Total LP supply (derived from treasury cap). */
export function totalLpSupply(options: TotalLpSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'total_lp_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowRedeemRequestsArguments {
    pool: RawTransactionArgument<string>;
}
export interface BorrowRedeemRequestsOptions {
    package?: string;
    arguments: BorrowRedeemRequestsArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function borrowRedeemRequests(options: BorrowRedeemRequestsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'borrow_redeem_requests',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PoolTvlUsdArguments {
    pool: RawTransactionArgument<string>;
}
export interface PoolTvlUsdOptions {
    package?: string;
    arguments: PoolTvlUsdArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** TVL in USD as Float. */
export function poolTvlUsd(options: PoolTvlUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'pool_tvl_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TokenCountArguments {
    pool: RawTransactionArgument<string>;
}
export interface TokenCountOptions {
    package?: string;
    arguments: TokenCountArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Number of supported tokens. */
export function tokenCount(options: TokenCountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'token_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowTokenPoolByIndexArguments {
    pool: RawTransactionArgument<string>;
    index: RawTransactionArgument<number | bigint>;
}
export interface BorrowTokenPoolByIndexOptions {
    package?: string;
    arguments: BorrowTokenPoolByIndexArguments | [
        pool: RawTransactionArgument<string>,
        index: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Borrows a TokenPoolInfo by index. */
export function borrowTokenPoolByIndex(options: BorrowTokenPoolByIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "index"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'borrow_token_pool_by_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TpiTokenTypeArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiTokenTypeOptions {
    package?: string;
    arguments: TpiTokenTypeArguments | [
        tp: RawTransactionArgument<string>
    ];
}
/** TokenPoolInfo field accessors. */
export function tpiTokenType(options: TpiTokenTypeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_token_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiTokenDecimalArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiTokenDecimalOptions {
    package?: string;
    arguments: TpiTokenDecimalArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiTokenDecimal(options: TpiTokenDecimalOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_token_decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiLiquidityAmountArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiLiquidityAmountOptions {
    package?: string;
    arguments: TpiLiquidityAmountArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiLiquidityAmount(options: TpiLiquidityAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_liquidity_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiReservedAmountArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiReservedAmountOptions {
    package?: string;
    arguments: TpiReservedAmountArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiReservedAmount(options: TpiReservedAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_reserved_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiValueUsdArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiValueUsdOptions {
    package?: string;
    arguments: TpiValueUsdArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiValueUsd(options: TpiValueUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_value_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiTargetWeightBpsArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiTargetWeightBpsOptions {
    package?: string;
    arguments: TpiTargetWeightBpsArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiTargetWeightBps(options: TpiTargetWeightBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_target_weight_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiMintFeeBpsArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiMintFeeBpsOptions {
    package?: string;
    arguments: TpiMintFeeBpsArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiMintFeeBps(options: TpiMintFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_mint_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiBurnFeeBpsArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiBurnFeeBpsOptions {
    package?: string;
    arguments: TpiBurnFeeBpsArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiBurnFeeBps(options: TpiBurnFeeBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_burn_fee_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiCumulativeBorrowRateArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiCumulativeBorrowRateOptions {
    package?: string;
    arguments: TpiCumulativeBorrowRateArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiCumulativeBorrowRate(options: TpiCumulativeBorrowRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_cumulative_borrow_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface TpiLastPriceRefreshTimestampArguments {
    tp: RawTransactionArgument<string>;
}
export interface TpiLastPriceRefreshTimestampOptions {
    package?: string;
    arguments: TpiLastPriceRefreshTimestampArguments | [
        tp: RawTransactionArgument<string>
    ];
}
export function tpiLastPriceRefreshTimestamp(options: TpiLastPriceRefreshTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["tp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'tpi_last_price_refresh_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface RedeemRecipientArguments {
    r: RawTransactionArgument<string>;
}
export interface RedeemRecipientOptions {
    package?: string;
    arguments: RedeemRecipientArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function redeemRecipient(options: RedeemRecipientOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'redeem_recipient',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RedeemLpAmountArguments {
    r: RawTransactionArgument<string>;
}
export interface RedeemLpAmountOptions {
    package?: string;
    arguments: RedeemLpAmountArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function redeemLpAmount(options: RedeemLpAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'redeem_lp_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RedeemTokenTypeArguments {
    r: RawTransactionArgument<string>;
}
export interface RedeemTokenTypeOptions {
    package?: string;
    arguments: RedeemTokenTypeArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function redeemTokenType(options: RedeemTokenTypeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'redeem_token_type',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RedeemRequestTimestampArguments {
    r: RawTransactionArgument<string>;
}
export interface RedeemRequestTimestampOptions {
    package?: string;
    arguments: RedeemRequestTimestampArguments | [
        r: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function redeemRequestTimestamp(options: RedeemRequestTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["r"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'redeem_request_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FindTokenPoolIndexArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface FindTokenPoolIndexOptions {
    package?: string;
    arguments: FindTokenPoolIndexArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function findTokenPoolIndex(options: FindTokenPoolIndexOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'find_token_pool_index',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowTokenPoolArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface BorrowTokenPoolOptions {
    package?: string;
    arguments: BorrowTokenPoolArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function borrowTokenPool(options: BorrowTokenPoolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'borrow_token_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BorrowMutTokenPoolArguments {
    pool: RawTransactionArgument<string>;
    tokenType: RawTransactionArgument<string>;
}
export interface BorrowMutTokenPoolOptions {
    package?: string;
    arguments: BorrowMutTokenPoolArguments | [
        pool: RawTransactionArgument<string>,
        tokenType: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function borrowMutTokenPool(options: BorrowMutTokenPoolOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "tokenType"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'borrow_mut_token_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RefreshTokenValueWithPriceArguments {
    pool: RawTransactionArgument<string>;
    price: RawTransactionArgument<string>;
    refreshTimestamp: RawTransactionArgument<number | bigint>;
}
export interface RefreshTokenValueWithPriceOptions {
    package?: string;
    arguments: RefreshTokenValueWithPriceArguments | [
        pool: RawTransactionArgument<string>,
        price: RawTransactionArgument<string>,
        refreshTimestamp: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function refreshTokenValueWithPrice(options: RefreshTokenValueWithPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "price", "refreshTimestamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'refresh_token_value_with_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertPricesFreshArguments {
    pool: RawTransactionArgument<string>;
    globalConfig: RawTransactionArgument<string>;
}
export interface AssertPricesFreshOptions {
    package?: string;
    arguments: AssertPricesFreshArguments | [
        pool: RawTransactionArgument<string>,
        globalConfig: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertPricesFresh(options: AssertPricesFreshOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["pool", "globalConfig"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'assert_prices_fresh',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AssertRedeemAllowedArguments {
    pool: RawTransactionArgument<string>;
}
export interface AssertRedeemAllowedOptions {
    package?: string;
    arguments: AssertRedeemAllowedArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function assertRedeemAllowed(options: AssertRedeemAllowedOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'assert_redeem_allowed',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateTotalWlpUtilizationBpsArguments {
    pool: RawTransactionArgument<string>;
}
export interface CalculateTotalWlpUtilizationBpsOptions {
    package?: string;
    arguments: CalculateTotalWlpUtilizationBpsArguments | [
        pool: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function calculateTotalWlpUtilizationBps(options: CalculateTotalWlpUtilizationBpsOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["pool"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'calculate_total_wlp_utilization_bps',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CalculateDynamicFeeArguments {
    tokenValueUsd: RawTransactionArgument<string>;
    tvlUsd: RawTransactionArgument<string>;
    operationValueUsd: RawTransactionArgument<string>;
    targetWeightBps: RawTransactionArgument<number | bigint>;
    baseFeeBps: RawTransactionArgument<number | bigint>;
    isDeposit: RawTransactionArgument<boolean>;
}
export interface CalculateDynamicFeeOptions {
    package?: string;
    arguments: CalculateDynamicFeeArguments | [
        tokenValueUsd: RawTransactionArgument<string>,
        tvlUsd: RawTransactionArgument<string>,
        operationValueUsd: RawTransactionArgument<string>,
        targetWeightBps: RawTransactionArgument<number | bigint>,
        baseFeeBps: RawTransactionArgument<number | bigint>,
        isDeposit: RawTransactionArgument<boolean>
    ];
}
/** Calculates dynamic fee based on weight deviation. */
export function calculateDynamicFee(options: CalculateDynamicFeeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64',
        'u64',
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["tokenValueUsd", "tvlUsd", "operationValueUsd", "targetWeightBps", "baseFeeBps", "isDeposit"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'calculate_dynamic_fee',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AssertValidBorrowConfigArguments {
    rate_0: RawTransactionArgument<number | bigint>;
    rate_1: RawTransactionArgument<number | bigint>;
    rate_2: RawTransactionArgument<number | bigint>;
    intervalMs: RawTransactionArgument<number | bigint>;
}
export interface AssertValidBorrowConfigOptions {
    package?: string;
    arguments: AssertValidBorrowConfigArguments | [
        rate_0: RawTransactionArgument<number | bigint>,
        rate_1: RawTransactionArgument<number | bigint>,
        rate_2: RawTransactionArgument<number | bigint>,
        intervalMs: RawTransactionArgument<number | bigint>
    ];
}
export function assertValidBorrowConfig(options: AssertValidBorrowConfigOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["rate_0", "rate_1", "rate_2", "intervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'assert_valid_borrow_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateBorrowRateArguments {
    utilizationBps: RawTransactionArgument<number | bigint>;
    rate_0: RawTransactionArgument<number | bigint>;
    rate_1: RawTransactionArgument<number | bigint>;
    rate_2: RawTransactionArgument<number | bigint>;
    threshold_0: RawTransactionArgument<number | bigint>;
    threshold_1: RawTransactionArgument<number | bigint>;
}
export interface CalculateBorrowRateOptions {
    package?: string;
    arguments: CalculateBorrowRateArguments | [
        utilizationBps: RawTransactionArgument<number | bigint>,
        rate_0: RawTransactionArgument<number | bigint>,
        rate_1: RawTransactionArgument<number | bigint>,
        rate_2: RawTransactionArgument<number | bigint>,
        threshold_0: RawTransactionArgument<number | bigint>,
        threshold_1: RawTransactionArgument<number | bigint>
    ];
}
/** Calculates borrow rate using 3-slope utilization curve. */
export function calculateBorrowRate(options: CalculateBorrowRateOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64',
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["utilizationBps", "rate_0", "rate_1", "rate_2", "threshold_0", "threshold_1"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'calculate_borrow_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CalculateBorrowRateAccrualArguments {
    borrowRate: RawTransactionArgument<number | bigint>;
    elapsedMs: RawTransactionArgument<number | bigint>;
    intervalMs: RawTransactionArgument<number | bigint>;
}
export interface CalculateBorrowRateAccrualOptions {
    package?: string;
    arguments: CalculateBorrowRateAccrualArguments | [
        borrowRate: RawTransactionArgument<number | bigint>,
        elapsedMs: RawTransactionArgument<number | bigint>,
        intervalMs: RawTransactionArgument<number | bigint>
    ];
}
/**
 * Converts the instantaneous borrow rate into a cumulative index delta using the
 * configured interval as the time basis.
 */
export function calculateBorrowRateAccrual(options: CalculateBorrowRateAccrualOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["borrowRate", "elapsedMs", "intervalMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'lp_pool',
        function: 'calculate_borrow_rate_accrual',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}