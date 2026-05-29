/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveEnum, MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as position from './position.ts';
const $moduleName = '@waterx/prediction::order';
export const OrderKind = new MoveEnum({ name: `${$moduleName}::OrderKind`, fields: {
        Open: null,
        Close: null
    } });
export const Order: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Order`, fields: {
        order_id: bcs.u64(),
        kind: OrderKind,
        account_id: bcs.Address,
        market_id: bcs.vector(bcs.u8()),
        selection: position.Selection,
        /** `Some(position_id)` only for close orders. */
        position_id: bcs.option(bcs.u64()),
        /** Open-order spend escrowed in `MarketRegistry.balance`. */
        max_spend: bcs.u64(),
        min_shares: bcs.u64(),
        price_cap: bcs.u64(),
        /** Close-order slippage floor. */
        min_proceeds: bcs.u64(),
        expiry_ts: bcs.u64(),
        /** Earliest timestamp at which the account owner may self-cancel. */
        self_cancel_after_ts: bcs.u64(),
        created_ts: bcs.u64(),
        by_admin: bcs.bool()
    } });
export interface OrderIdArguments {
    order: RawTransactionArgument<string>;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function orderId(options: OrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KindArguments {
    order: RawTransactionArgument<string>;
}
export interface KindOptions {
    package?: string;
    arguments: KindArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function kind(options: KindOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'kind',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdArguments {
    order: RawTransactionArgument<string>;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketIdArguments {
    order: RawTransactionArgument<string>;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function marketId(options: MarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelectionArguments {
    order: RawTransactionArgument<string>;
}
export interface SelectionOptions {
    package?: string;
    arguments: SelectionArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function selection(options: SelectionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'selection',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionIdArguments {
    order: RawTransactionArgument<string>;
}
export interface PositionIdOptions {
    package?: string;
    arguments: PositionIdArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function positionId(options: PositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MaxSpendArguments {
    order: RawTransactionArgument<string>;
}
export interface MaxSpendOptions {
    package?: string;
    arguments: MaxSpendArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function maxSpend(options: MaxSpendOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'max_spend',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MinSharesArguments {
    order: RawTransactionArgument<string>;
}
export interface MinSharesOptions {
    package?: string;
    arguments: MinSharesArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function minShares(options: MinSharesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'min_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PriceCapArguments {
    order: RawTransactionArgument<string>;
}
export interface PriceCapOptions {
    package?: string;
    arguments: PriceCapArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function priceCap(options: PriceCapOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'price_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MinProceedsArguments {
    order: RawTransactionArgument<string>;
}
export interface MinProceedsOptions {
    package?: string;
    arguments: MinProceedsArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function minProceeds(options: MinProceedsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'min_proceeds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ExpiryTsArguments {
    order: RawTransactionArgument<string>;
}
export interface ExpiryTsOptions {
    package?: string;
    arguments: ExpiryTsArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function expiryTs(options: ExpiryTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'expiry_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelfCancelAfterTsArguments {
    order: RawTransactionArgument<string>;
}
export interface SelfCancelAfterTsOptions {
    package?: string;
    arguments: SelfCancelAfterTsArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function selfCancelAfterTs(options: SelfCancelAfterTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'self_cancel_after_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CreatedTsArguments {
    order: RawTransactionArgument<string>;
}
export interface CreatedTsOptions {
    package?: string;
    arguments: CreatedTsArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function createdTs(options: CreatedTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'created_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ByAdminArguments {
    order: RawTransactionArgument<string>;
}
export interface ByAdminOptions {
    package?: string;
    arguments: ByAdminArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function byAdmin(options: ByAdminOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'by_admin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsOpenArguments {
    order: RawTransactionArgument<string>;
}
export interface IsOpenOptions {
    package?: string;
    arguments: IsOpenArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function isOpen(options: IsOpenOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'is_open',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsCloseArguments {
    order: RawTransactionArgument<string>;
}
export interface IsCloseOptions {
    package?: string;
    arguments: IsCloseArguments | [
        order: RawTransactionArgument<string>
    ];
}
export function isClose(options: IsCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'is_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KindIsOpenArguments {
    kind: RawTransactionArgument<string>;
}
export interface KindIsOpenOptions {
    package?: string;
    arguments: KindIsOpenArguments | [
        kind: RawTransactionArgument<string>
    ];
}
export function kindIsOpen(options: KindIsOpenOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kind"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'kind_is_open',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface KindIsCloseArguments {
    kind: RawTransactionArgument<string>;
}
export interface KindIsCloseOptions {
    package?: string;
    arguments: KindIsCloseArguments | [
        kind: RawTransactionArgument<string>
    ];
}
export function kindIsClose(options: KindIsCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kind"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'kind_is_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}