/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Default identity (passthrough) deposit / withdraw policy.
 * 
 * Folds `Coin<T>` directly into the account's stored `Balance<T>` on deposit, and
 * pays `Coin<T>` straight to the request's recipient on withdraw — no swap, no
 * conversion. This is the "no-op" policy that most CoinTypes will use; PSM-style
 * policies (T_IN → T_OUT) are still authored per-protocol.
 * 
 * Deploy setup (one-time):
 * 
 * ```move
 * // Once at deploy:
 * registry.whitelist_protocol<DirectRule>(&admin_cap);
 * // Per CoinType T that should flow direct:
 * registry.register_deposit_policy<T, DirectRule>(&admin_cap);
 * registry.register_withdraw_policy<T, DirectRule>(&admin_cap);
 * ```
 * 
 * User flow inside a single PTB:
 * 
 * ```move
 * let req = registry.request_deposit<T>(account_id, coin, extra_data);
 * direct_rule::consume_deposit_direct<T>(&mut registry, req);
 * // ...later:
 * let wreq = registry.request_withdraw<T>(&sender_req, account_id, amount, recipient, extra_data, &clock);
 * direct_rule::consume_withdraw_direct<T>(&mut registry, wreq, ctx);
 * ```
 */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@waterx/account::direct_rule';
export const DirectRule = new MoveStruct({ name: `${$moduleName}::DirectRule`, fields: {
        dummy_field: bcs.bool()
    } });
export interface ConsumeDepositDirectArguments {
    registry: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
}
export interface ConsumeDepositDirectOptions {
    package?: string;
    arguments: ConsumeDepositDirectArguments | [
        registry: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Consume a `DepositRequest<T>` that was registered against `DirectRule` and
 * credit the entire `Balance<T>` to the account's stored balance.
 */
export function consumeDepositDirect(options: ConsumeDepositDirectOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'direct_rule',
        function: 'consume_deposit_direct',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConsumeWithdrawDirectArguments {
    registry: RawTransactionArgument<string>;
    req: RawTransactionArgument<string>;
}
export interface ConsumeWithdrawDirectOptions {
    package?: string;
    arguments: ConsumeWithdrawDirectArguments | [
        registry: RawTransactionArgument<string>,
        req: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Consume a `WithdrawRequest<T>` that was registered against `DirectRule` and pay
 * out `Coin<T>` to the request's recipient.
 */
export function consumeWithdrawDirect(options: ConsumeWithdrawDirectOptions) {
    const packageAddress = options.package ?? '@waterx/account';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'direct_rule',
        function: 'consume_withdraw_direct',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}