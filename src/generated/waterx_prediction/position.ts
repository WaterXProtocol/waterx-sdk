/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveEnum, MoveStruct, normalizeMoveArguments } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
const $moduleName = '@waterx/prediction::position';
/**
 * Which outcome the user predicted. The broker module routes fills externally; it
 * does not expose a native CLOB direction.
 */
export const Selection = new MoveEnum({ name: `${$moduleName}::Selection`, fields: {
        No: null,
        Yes: null
    } });
export const Position = new MoveStruct({ name: `${$moduleName}::Position`, fields: {
        /** Canonical waterx_account that owns this broker position. */
        account_id: bcs.Address,
        market_id: bcs.vector(bcs.u8()),
        selection: Selection,
        filled_shares: bcs.u64(),
        filled_cost: bcs.u64(),
        opened_ts: bcs.u64(),
        /** Set only while a close order is waiting for keeper execution. */
        close_order_id: bcs.option(bcs.u64())
    } });
export const Status = new MoveEnum({ name: `${$moduleName}::Status`, fields: {
        Open: null,
        PendingClose: null
    } });
export interface AccountIdArguments {
    position: TransactionArgument;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        position: TransactionArgument
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface MarketIdArguments {
    position: TransactionArgument;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        position: TransactionArgument
    ];
}
export function marketId(options: MarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelectionArguments {
    position: TransactionArgument;
}
export interface SelectionOptions {
    package?: string;
    arguments: SelectionArguments | [
        position: TransactionArgument
    ];
}
export function selection(options: SelectionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'selection',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FilledSharesArguments {
    position: TransactionArgument;
}
export interface FilledSharesOptions {
    package?: string;
    arguments: FilledSharesArguments | [
        position: TransactionArgument
    ];
}
export function filledShares(options: FilledSharesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'filled_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FilledCostArguments {
    position: TransactionArgument;
}
export interface FilledCostOptions {
    package?: string;
    arguments: FilledCostArguments | [
        position: TransactionArgument
    ];
}
export function filledCost(options: FilledCostOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'filled_cost',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OpenedTsArguments {
    position: TransactionArgument;
}
export interface OpenedTsOptions {
    package?: string;
    arguments: OpenedTsArguments | [
        position: TransactionArgument
    ];
}
export function openedTs(options: OpenedTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'opened_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface CloseOrderIdArguments {
    position: TransactionArgument;
}
export interface CloseOrderIdOptions {
    package?: string;
    arguments: CloseOrderIdArguments | [
        position: TransactionArgument
    ];
}
export function closeOrderId(options: CloseOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'close_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface HasPendingCloseArguments {
    position: TransactionArgument;
}
export interface HasPendingCloseOptions {
    package?: string;
    arguments: HasPendingCloseArguments | [
        position: TransactionArgument
    ];
}
export function hasPendingClose(options: HasPendingCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'has_pending_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface StatusArguments {
    position: TransactionArgument;
}
export interface StatusOptions {
    package?: string;
    arguments: StatusArguments | [
        position: TransactionArgument
    ];
}
export function status(options: StatusOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["position"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelectionNoOptions {
    package?: string;
    arguments?: [
    ];
}
export function selectionNo(options: SelectionNoOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'selection_no',
    });
}
export interface SelectionYesOptions {
    package?: string;
    arguments?: [
    ];
}
export function selectionYes(options: SelectionYesOptions = {}) {
    const packageAddress = options.package ?? '@waterx/prediction';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'selection_yes',
    });
}
export interface StatusIsOpenArguments {
    s: TransactionArgument;
}
export interface StatusIsOpenOptions {
    package?: string;
    arguments: StatusIsOpenArguments | [
        s: TransactionArgument
    ];
}
export function statusIsOpen(options: StatusIsOpenOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'status_is_open',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface StatusIsPendingCloseArguments {
    s: TransactionArgument;
}
export interface StatusIsPendingCloseOptions {
    package?: string;
    arguments: StatusIsPendingCloseArguments | [
        s: TransactionArgument
    ];
}
export function statusIsPendingClose(options: StatusIsPendingCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'status_is_pending_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelectionIsNoArguments {
    s: TransactionArgument;
}
export interface SelectionIsNoOptions {
    package?: string;
    arguments: SelectionIsNoArguments | [
        s: TransactionArgument
    ];
}
export function selectionIsNo(options: SelectionIsNoOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'selection_is_no',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SelectionIsYesArguments {
    s: TransactionArgument;
}
export interface SelectionIsYesOptions {
    package?: string;
    arguments: SelectionIsYesArguments | [
        s: TransactionArgument
    ];
}
export function selectionIsYes(options: SelectionIsYesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["s"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'position',
        function: 'selection_is_yes',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}