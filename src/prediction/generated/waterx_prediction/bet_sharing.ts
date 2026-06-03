/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * On-chain audit trail for `place_order_for`: payer (host) fronts funds while the
 * beneficiary `waterx_account` owns order / position indexing and payouts.
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@waterx/prediction::bet_sharing';
export const BetSharing: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::BetSharing`, fields: {
        id: bcs.Address,
        host_account_id: bcs.Address,
        beneficiary_account_id: bcs.Address,
        order_id: bcs.u64(),
        market_key: bcs.u64(),
        created_at_ms: bcs.u64()
    } });
export interface HostAccountIdArguments {
    bs: RawTransactionArgument<string>;
}
export interface HostAccountIdOptions {
    package?: string;
    arguments: HostAccountIdArguments | [
        bs: RawTransactionArgument<string>
    ];
}
export function hostAccountId(options: HostAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'bet_sharing',
        function: 'host_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface BeneficiaryAccountIdArguments {
    bs: RawTransactionArgument<string>;
}
export interface BeneficiaryAccountIdOptions {
    package?: string;
    arguments: BeneficiaryAccountIdArguments | [
        bs: RawTransactionArgument<string>
    ];
}
export function beneficiaryAccountId(options: BeneficiaryAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'bet_sharing',
        function: 'beneficiary_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderIdArguments {
    bs: RawTransactionArgument<string>;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        bs: RawTransactionArgument<string>
    ];
}
export function orderId(options: OrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'bet_sharing',
        function: 'order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketKeyArguments {
    bs: RawTransactionArgument<string>;
}
export interface MarketKeyOptions {
    package?: string;
    arguments: MarketKeyArguments | [
        bs: RawTransactionArgument<string>
    ];
}
export function marketKey(options: MarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'bet_sharing',
        function: 'market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatedAtMsArguments {
    bs: RawTransactionArgument<string>;
}
export interface CreatedAtMsOptions {
    package?: string;
    arguments: CreatedAtMsArguments | [
        bs: RawTransactionArgument<string>
    ];
}
export function createdAtMs(options: CreatedAtMsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["bs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'bet_sharing',
        function: 'created_at_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}