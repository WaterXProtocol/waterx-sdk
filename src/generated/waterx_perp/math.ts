/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Math utilities for WaterX Perp using bucket_v2_framework::float. All price/rate
 * calculations use Float (1e9) or Double (1e18).
 */

import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import { normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
export interface AmountToUsdArguments {
    amount: RawTransactionArgument<number | bigint>;
    tokenDecimal: RawTransactionArgument<number>;
    price: TransactionArgument;
}
export interface AmountToUsdOptions {
    package?: string;
    arguments: AmountToUsdArguments | [
        amount: RawTransactionArgument<number | bigint>,
        tokenDecimal: RawTransactionArgument<number>,
        price: TransactionArgument
    ];
}
/**
 * Converts a token amount to USD value as Float. amount: raw token amount (e.g.,
 * 1_000_000 for 1 USDC) token_decimal: number of decimals the token uses price:
 * Float price (USD per token)
 */
export function amountToUsd(options: AmountToUsdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["amount", "tokenDecimal", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'math',
        function: 'amount_to_usd',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface UsdToAmountArguments {
    usd: TransactionArgument;
    tokenDecimal: RawTransactionArgument<number>;
    price: TransactionArgument;
}
export interface UsdToAmountOptions {
    package?: string;
    arguments: UsdToAmountArguments | [
        usd: TransactionArgument,
        tokenDecimal: RawTransactionArgument<number>,
        price: TransactionArgument
    ];
}
/** Converts a USD value (Float) to a token amount. Returns u64 raw amount. */
export function usdToAmount(options: UsdToAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null,
        'u8',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["usd", "tokenDecimal", "price"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'math',
        function: 'usd_to_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BpScaleOptions {
    package?: string;
    arguments?: [
    ];
}
/** Returns basis points scale. */
export function bpScale(options: BpScaleOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'math',
        function: 'bp_scale',
    });
}
export interface SaturatingSubArguments {
    a: RawTransactionArgument<number | bigint>;
    b: RawTransactionArgument<number | bigint>;
}
export interface SaturatingSubOptions {
    package?: string;
    arguments: SaturatingSubArguments | [
        a: RawTransactionArgument<number | bigint>,
        b: RawTransactionArgument<number | bigint>
    ];
}
/** Safe subtraction (saturates at 0). */
export function saturatingSub(options: SaturatingSubOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["a", "b"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'math',
        function: 'saturating_sub',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}