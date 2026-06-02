/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Droppable response returned by WaterX Perp trading execution. */

import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/perp::response';
export const TradingResponse = new MoveStruct({ name: `${$moduleName}::TradingResponse`, fields: {
        /** Trading market object id. */
        market_id: bcs.Address,
        /** Affected wxa account id. Use this for ownership attribution. */
        account_id: bcs.Address,
        /** One of the `waterx_perp::trading::action_*` values. */
        action: bcs.u8(),
        /** Execution caller. This can be a keeper or risk manager. */
        sender: bcs.Address,
        /** Order id touched or created by the execution, when applicable. */
        order_id: bcs.option(bcs.u64()),
        /** Position id touched or created by the execution, when applicable. */
        position_id: bcs.option(bcs.u64()),
        /** Raw collateral-token PnL amount. Direction is `pnl_is_profit`. */
        pnl_amount: bcs.u64(),
        /** Meaningful only when `pnl_amount > 0`. */
        pnl_is_profit: bcs.bool(),
        /** Raw collateral-token fees recorded or realized by this execution. */
        fee_amount: bcs.u64(),
        /** Raw collateral amount credited back to the affected wxa account. */
        returned_collateral_amount: bcs.u64(),
        /** Raw collateral newly provided by this execution. */
        input_collateral_amount: bcs.u64(),
        /** Post-action position collateral, or zero when no position remains. */
        position_collateral_amount: bcs.u64(),
        /** Order or position direction for the executed action. */
        is_long: bcs.bool(),
        /** Executed or requested size when surfaced by the path; zero if not applicable. */
        size: float.Float,
        /** Execution or trigger price when surfaced by the path; zero if not applicable. */
        execution_price: float_1.Float
    } });
export interface MarketIdArguments {
    self: RawTransactionArgument<string>;
}
export interface MarketIdOptions {
    package?: string;
    arguments: MarketIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function marketId(options: MarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface AccountIdArguments {
    self: RawTransactionArgument<string>;
}
export interface AccountIdOptions {
    package?: string;
    arguments: AccountIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function accountId(options: AccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ActionArguments {
    self: RawTransactionArgument<string>;
}
export interface ActionOptions {
    package?: string;
    arguments: ActionArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function action(options: ActionOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'action',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SenderArguments {
    self: RawTransactionArgument<string>;
}
export interface SenderOptions {
    package?: string;
    arguments: SenderArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function sender(options: SenderOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'sender',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderIdArguments {
    self: RawTransactionArgument<string>;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function orderId(options: OrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionIdArguments {
    self: RawTransactionArgument<string>;
}
export interface PositionIdOptions {
    package?: string;
    arguments: PositionIdArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function positionId(options: PositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PnlAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface PnlAmountOptions {
    package?: string;
    arguments: PnlAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function pnlAmount(options: PnlAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'pnl_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PnlIsProfitArguments {
    self: RawTransactionArgument<string>;
}
export interface PnlIsProfitOptions {
    package?: string;
    arguments: PnlIsProfitArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function pnlIsProfit(options: PnlIsProfitOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'pnl_is_profit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface FeeAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface FeeAmountOptions {
    package?: string;
    arguments: FeeAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function feeAmount(options: FeeAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'fee_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ReturnedCollateralAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface ReturnedCollateralAmountOptions {
    package?: string;
    arguments: ReturnedCollateralAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function returnedCollateralAmount(options: ReturnedCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'returned_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface InputCollateralAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface InputCollateralAmountOptions {
    package?: string;
    arguments: InputCollateralAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
/**
 * Collateral newly provided by this execution. This is zero for close, cancel,
 * decrease, withdraw, and liquidation paths.
 */
export function inputCollateralAmount(options: InputCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'input_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface PositionCollateralAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface PositionCollateralAmountOptions {
    package?: string;
    arguments: PositionCollateralAmountArguments | [
        self: RawTransactionArgument<string>
    ];
}
/**
 * Position collateral after this execution, when a position remains or was opened.
 * This is zero when no position state exists after the action.
 */
export function positionCollateralAmount(options: PositionCollateralAmountOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'position_collateral_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface IsLongArguments {
    self: RawTransactionArgument<string>;
}
export interface IsLongOptions {
    package?: string;
    arguments: IsLongArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function isLong(options: IsLongOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'is_long',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface SizeArguments {
    self: RawTransactionArgument<string>;
}
export interface SizeOptions {
    package?: string;
    arguments: SizeArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function size(options: SizeOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'size',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface ExecutionPriceArguments {
    self: RawTransactionArgument<string>;
}
export interface ExecutionPriceOptions {
    package?: string;
    arguments: ExecutionPriceArguments | [
        self: RawTransactionArgument<string>
    ];
}
export function executionPrice(options: ExecutionPriceOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'execution_price',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface NewArguments {
    marketId: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    action: RawTransactionArgument<number>;
    sender: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint | null>;
    positionId: RawTransactionArgument<number | bigint | null>;
    pnlAmount: RawTransactionArgument<number | bigint>;
    pnlIsProfit: RawTransactionArgument<boolean>;
    feeAmount: RawTransactionArgument<number | bigint>;
    returnedCollateralAmount: RawTransactionArgument<number | bigint>;
    inputCollateralAmount: RawTransactionArgument<number | bigint>;
    positionCollateralAmount: RawTransactionArgument<number | bigint>;
    isLong: RawTransactionArgument<boolean>;
    size: RawTransactionArgument<string>;
    executionPrice: RawTransactionArgument<string>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        marketId: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        action: RawTransactionArgument<number>,
        sender: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint | null>,
        positionId: RawTransactionArgument<number | bigint | null>,
        pnlAmount: RawTransactionArgument<number | bigint>,
        pnlIsProfit: RawTransactionArgument<boolean>,
        feeAmount: RawTransactionArgument<number | bigint>,
        returnedCollateralAmount: RawTransactionArgument<number | bigint>,
        inputCollateralAmount: RawTransactionArgument<number | bigint>,
        positionCollateralAmount: RawTransactionArgument<number | bigint>,
        isLong: RawTransactionArgument<boolean>,
        size: RawTransactionArgument<string>,
        executionPrice: RawTransactionArgument<string>
    ];
}
/**
 * Construct a `TradingResponse` receipt. Each dispatch arm in
 * `waterx_perp::trading` builds exactly one receipt at the tail of the action;
 * fields not surfaced by a given path are passed as zero / `option::none()` per
 * the per-field doc comments on the struct. `public(package)` so only this package
 * can mint receipts — external consumers receive them via the
 * `vector<TradingResponse>` returns of `trading::execute` and the keeper
 * entrypoints.
 */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/perp';
    const argumentsTypes = [
        '0x2::object::ID',
        '0x2::object::ID',
        'u8',
        'address',
        '0x1::option::Option<u64>',
        '0x1::option::Option<u64>',
        'u64',
        'bool',
        'u64',
        'u64',
        'u64',
        'u64',
        'bool',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketId", "accountId", "action", "sender", "orderId", "positionId", "pnlAmount", "pnlIsProfit", "feeAmount", "returnedCollateralAmount", "inputCollateralAmount", "positionCollateralAmount", "isLong", "size", "executionPrice"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'response',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}