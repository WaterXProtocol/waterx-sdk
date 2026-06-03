/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveEnum, MoveStruct, normalizeMoveArguments } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as position from './position.ts';
const $moduleName = '@waterx/prediction::order';
export const OrderKind = new MoveEnum({ name: `${$moduleName}::OrderKind`, fields: {
        Open: null,
        Close: null
    } });
export const Order: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Order`, fields: {
        order_id: bcs.u64(),
        kind: OrderKind,
        /**
         * Account that funded the order and owns pending-order cancellation / refund
         * rights.
         */
        account_id: bcs.Address,
        /** Account that receives the position after an open order is filled. */
        receiver_account_id: bcs.Address,
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
    order: TransactionArgument;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface KindOptions {
    package?: string;
    arguments: KindArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        order: TransactionArgument
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
export interface ReceiverAccountIdArguments {
    order: TransactionArgument;
}
export interface ReceiverAccountIdOptions {
    package?: string;
    arguments: ReceiverAccountIdArguments | [
        order: TransactionArgument
    ];
}
export function receiverAccountId(options: ReceiverAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["order"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'order',
        function: 'receiver_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketIdArguments {
    order: TransactionArgument;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface SelectionOptions {
    package?: string;
    arguments: SelectionArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface PositionIdOptions {
    package?: string;
    arguments: PositionIdArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface MaxSpendOptions {
    package?: string;
    arguments: MaxSpendArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface MinSharesOptions {
    package?: string;
    arguments: MinSharesArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface PriceCapOptions {
    package?: string;
    arguments: PriceCapArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface MinProceedsOptions {
    package?: string;
    arguments: MinProceedsArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface ExpiryTsOptions {
    package?: string;
    arguments: ExpiryTsArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface SelfCancelAfterTsOptions {
    package?: string;
    arguments: SelfCancelAfterTsArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface CreatedTsOptions {
    package?: string;
    arguments: CreatedTsArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface ByAdminOptions {
    package?: string;
    arguments: ByAdminArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface IsOpenOptions {
    package?: string;
    arguments: IsOpenArguments | [
        order: TransactionArgument
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
    order: TransactionArgument;
}
export interface IsCloseOptions {
    package?: string;
    arguments: IsCloseArguments | [
        order: TransactionArgument
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
    kind: TransactionArgument;
}
export interface KindIsOpenOptions {
    package?: string;
    arguments: KindIsOpenArguments | [
        kind: TransactionArgument
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
    kind: TransactionArgument;
}
export interface KindIsCloseOptions {
    package?: string;
    arguments: KindIsCloseArguments | [
        kind: TransactionArgument
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