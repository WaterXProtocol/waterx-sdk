/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as balance from './deps/sui/balance.ts';
import * as table from './deps/sui/table.ts';
import * as linked_table from './deps/bucket_v2_framework/linked_table.ts';
import * as outcome from './outcome.ts';
const $moduleName = '@waterx/prediction::waterx_prediction';
export const MarketRegistry: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketRegistry<phantom T>`, fields: {
        id: bcs.Address,
        /** One shared settlement pool for all markets using coin type `T`. */
        balance: balance.Balance,
        /** Exact market lookup: external market id bytes -> linked-table key. */
        market_id_map: table.Table,
        unresolved_markets: linked_table.LinkedTable(bcs.u64()),
        resolved_markets: linked_table.LinkedTable(bcs.u64()),
        /** Set of market keys where new opens are blocked. Presence = paused. */
        paused_markets: table.Table,
        /** Pending open and close orders waiting for broker/keeper execution. */
        orders: linked_table.LinkedTable(bcs.u64()),
        /** Filled positions with active Polymarket exposure. */
        positions: linked_table.LinkedTable(bcs.u64()),
        /**
         * Filled order id -> filled position id. Split positions are independent positions
         * and are not indexed here.
         */
        position_id_by_order: table.Table,
        /**
         * Reverse index for cleaning `position_id_by_order` when the filled position is
         * claimed or closed.
         */
        order_id_by_position: table.Table,
        next_order_id: bcs.u64(),
        next_position_id: bcs.u64(),
        next_market_key: bcs.u64(),
        /** Minimum time after order placement before user self-cancel is allowed. */
        order_cancel_cooldown_ms: bcs.u64(),
        /** Floor balance that `admin_withdraw` must respect. */
        min_reserve: bcs.u64()
    } });
export const Market: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Market`, fields: {
        market_id: bcs.vector(bcs.u8()),
        outcome: bcs.option(outcome.Outcome),
        /**
         * Number of `Open` positions referencing this market. Incremented on `fill_order`;
         * decremented on `claim` / `confirm_close`. The market entry remains queryable
         * even after this reaches zero.
         */
        unclaimed_count: bcs.u64(),
        /** Active YES-side exposure still open in broker custody. */
        yes_shares: bcs.u64(),
        yes_cost: bcs.u64(),
        /** Active NO-side exposure still open in broker custody. */
        no_shares: bcs.u64(),
        no_cost: bcs.u64()
    } });
export const MarketPointer: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::MarketPointer`, fields: {
        key: bcs.u64(),
        resolved: bcs.bool()
    } });
export interface CreateMarketRegistryArguments {
    _: RawTransactionArgument<string>;
}
export interface CreateMarketRegistryOptions {
    package?: string;
    arguments: CreateMarketRegistryArguments | [
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin-only: spin up the shared market registry object for coin type `T`. All
 * markets for this coin type should settle through this object.
 */
export function createMarketRegistry(options: CreateMarketRegistryOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'create_market_registry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PlaceOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    accountId: RawTransactionArgument<string>;
    receiverAccountId: RawTransactionArgument<string>;
    maxSpend: RawTransactionArgument<number | bigint>;
    marketId: RawTransactionArgument<Array<number>>;
    selection: TransactionArgument;
    minShares: RawTransactionArgument<number | bigint>;
    priceCap: RawTransactionArgument<number | bigint>;
    expiryTs: RawTransactionArgument<number | bigint>;
}
export interface PlaceOrderOptions {
    package?: string;
    arguments: PlaceOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        accountId: RawTransactionArgument<string>,
        receiverAccountId: RawTransactionArgument<string>,
        maxSpend: RawTransactionArgument<number | bigint>,
        marketId: RawTransactionArgument<Array<number>>,
        selection: TransactionArgument,
        minShares: RawTransactionArgument<number | bigint>,
        priceCap: RawTransactionArgument<number | bigint>,
        expiryTs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-backed variant: debits `max_spend` from `account_id` in
 * `waterx_account`, records pending-order/refunds against that payer, and gives
 * the filled position to `receiver_account_id`.
 */
export function placeOrder(options: PlaceOrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        '0x2::object::ID',
        'u64',
        'vector<u8>',
        null,
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "accountId", "receiverAccountId", "maxSpend", "marketId", "selection", "minShares", "priceCap", "expiryTs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'place_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SelfCancelOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface SelfCancelOrderOptions {
    package?: string;
    arguments: SelfCancelOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-backed rescue for a stuck open order. Refunds go back into the
 * waterx_account stored balance.
 */
export function selfCancelOrder(options: SelfCancelOrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'self_cancel_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface ClaimOptions {
    package?: string;
    arguments: ClaimArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Account-backed claim. Payout is credited to the owning waterx_account balance. */
export function claim(options: ClaimOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'claim',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestCloseArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
    minProceeds: RawTransactionArgument<number | bigint>;
    expiryTs: RawTransactionArgument<number | bigint>;
}
export interface RequestCloseOptions {
    package?: string;
    arguments: RequestCloseArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>,
        minProceeds: RawTransactionArgument<number | bigint>,
        expiryTs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-backed close request. Auth is checked against the owning waterx_account.
 * The position is locked in PendingClose until a keeper confirms the sell, a
 * keeper cancels it, or the user self-cancels past `self_cancel_after_ts`. Aborts
 * if the market has already resolved.
 */
export function requestClose(options: RequestCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "positionId", "minProceeds", "expiryTs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'request_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SelfCancelCloseArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface SelfCancelCloseOptions {
    package?: string;
    arguments: SelfCancelCloseArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** Account-backed PendingClose rescue. Reverts the position to Open. */
export function selfCancelClose(options: SelfCancelCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'self_cancel_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TransferPositionArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
    recipientAccountId: RawTransactionArgument<string>;
}
export interface TransferPositionOptions {
    package?: string;
    arguments: TransferPositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>,
        recipientAccountId: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-backed position transfer. The source account owner moves an open
 * prediction position to another WXA account; future close/claim proceeds go to
 * the recipient account.
 */
export function transferPosition(options: TransferPositionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::object::ID',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "positionId", "recipientAccountId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'transfer_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SplitPositionArguments {
    globalConfig: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    senderRequest: TransactionArgument;
    positionId: RawTransactionArgument<number | bigint>;
    recipientAccountId: RawTransactionArgument<string>;
    splitShares: RawTransactionArgument<number | bigint>;
}
export interface SplitPositionOptions {
    package?: string;
    arguments: SplitPositionArguments | [
        globalConfig: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        senderRequest: TransactionArgument,
        positionId: RawTransactionArgument<number | bigint>,
        recipientAccountId: RawTransactionArgument<string>,
        splitShares: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Account-backed partial transfer. Splits an open position into two normal
 * positions: the source keeps the remainder and the recipient receives a new
 * independent position with proportional cost basis.
 */
export function splitPosition(options: SplitPositionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::object::ID',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "marketRegistry", "wxaRegistry", "senderRequest", "positionId", "recipientAccountId", "splitShares"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'split_position',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AdminPlaceOrderForArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
    selection: TransactionArgument;
    minShares: RawTransactionArgument<number | bigint>;
    priceCap: RawTransactionArgument<number | bigint>;
    expiryTs: RawTransactionArgument<number | bigint>;
}
export interface AdminPlaceOrderForOptions {
    package?: string;
    arguments: AdminPlaceOrderForArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>,
        selection: TransactionArgument,
        minShares: RawTransactionArgument<number | bigint>,
        priceCap: RawTransactionArgument<number | bigint>,
        expiryTs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin-funded account position. The admin supplies the payment coin, while future
 * user exits and admin refunds/claims return value to `account_id` in
 * `waterx_account`.
 */
export function adminPlaceOrderFor(options: AdminPlaceOrderForOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        '0x2::object::ID',
        'vector<u8>',
        null,
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "wxaRegistry", "payment", "accountId", "marketId", "selection", "minShares", "priceCap", "expiryTs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'admin_place_order_for',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface FillOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
    filledShares: RawTransactionArgument<number | bigint>;
    filledCost: RawTransactionArgument<number | bigint>;
}
export interface FillOrderOptions {
    package?: string;
    arguments: FillOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>,
        filledShares: RawTransactionArgument<number | bigint>,
        filledCost: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Keeper reports the Polymarket fill back to chain. Account-backed fill
 * confirmation. Any unspent max_spend is credited back to the payer account, then
 * a new independent position id is allocated.
 */
export function fillOrder(options: FillOrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "wxaRegistry", "orderId", "filledShares", "filledCost"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'fill_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelOrderArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface CancelOrderOptions {
    package?: string;
    arguments: CancelOrderArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Keeper-initiated cancel. Used when Polymarket couldn't fill at all.
 * Account-backed keeper cancel. Full refund is credited to the owning
 * waterx_account.
 */
export function cancelOrder(options: CancelOrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "wxaRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'cancel_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ConfirmCloseArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
    proceeds: RawTransactionArgument<number | bigint>;
}
export interface ConfirmCloseOptions {
    package?: string;
    arguments: ConfirmCloseArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>,
        proceeds: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Keeper reports the Polymarket sell back to chain. Pays user `proceeds` and
 * closes the position. Aborts if `proceeds < close_min_proceeds`. Account-backed
 * close confirmation. Proceeds are credited to the owning waterx_account.
 */
export function confirmClose(options: ConfirmCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "wxaRegistry", "positionId", "proceeds"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'confirm_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CancelCloseArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface CancelCloseOptions {
    package?: string;
    arguments: CancelCloseArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Keeper-initiated cancel of a PendingClose request. Used when the
 * waterx_prediction couldn't sell on Polymarket. Reverts position to Open — shares
 * are intact.
 */
export function cancelClose(options: CancelCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "wxaRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'cancel_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ForceClaimArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    wxaRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface ForceClaimOptions {
    package?: string;
    arguments: ForceClaimArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        wxaRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Keeper settles a position for the owning waterx_account. Same payout math as
 * `claim`; keeper just pays the gas.
 *
 * Two main use cases:
 *
 * 1.  **Batch payout distribution** — after `resolve_market`, chain multiple
 *     `force_claim` calls in one PTB to settle every position on that market in a
 *     single tx. Users get paid without spending gas.
 * 2.  **Zombie cleanup** - losing-side positions where payout = 0 give the account
 *     no incentive to call `claim`. Force-claim removes the position while leaving
 *     market metadata available for indexed queries.
 *
 * Only operates on open positions. Pending open orders and pending close orders
 * have their own resolution paths (`fill_order` / `confirm_close`). Account-backed
 * keeper claim. Used for gas-sponsored settlement and zombie cleanup when the
 * position belongs to a waterx_account.
 */
export function forceClaim(options: ForceClaimOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        null,
        'u64',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "wxaRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'force_claim',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositSettlementArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    payment: RawTransactionArgument<string>;
}
export interface DepositSettlementOptions {
    package?: string;
    arguments: DepositSettlementArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        payment: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function depositSettlement(options: DepositSettlementOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "payment"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'deposit_settlement',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AdminWithdrawArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
    recipient: RawTransactionArgument<string>;
}
export interface AdminWithdrawOptions {
    package?: string;
    arguments: AdminWithdrawArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>,
        recipient: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin pulls capital out of the market_registry — used to realise
 * waterx_prediction spread/profit or rebalance working capital. Aborts if the
 * post-balance would dip below `min_reserve`, providing a kill-switch against
 * accidental drains.
 */
export function adminWithdraw(options: AdminWithdrawOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "amount", "recipient"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'admin_withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetMinReserveArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    newReserve: RawTransactionArgument<number | bigint>;
}
export interface SetMinReserveOptions {
    package?: string;
    arguments: SetMinReserveArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        newReserve: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin sets the minimum reserve floor. Future `admin_withdraw` calls abort if
 * they would leave `market_registry.balance` below this. Does NOT block user
 * payouts — `claim` and refunds bypass `min_reserve` entirely (those are user
 * funds).
 */
export function setMinReserve(options: SetMinReserveOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "newReserve"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'set_min_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetOrderCancelCooldownMsArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    newCooldownMs: RawTransactionArgument<number | bigint>;
}
export interface SetOrderCancelCooldownMsOptions {
    package?: string;
    arguments: SetOrderCancelCooldownMsArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        newCooldownMs: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin sets the minimum account-owner self-cancel cooldown for newly created open
 * and close orders. Existing orders keep their stored self-cancel time.
 */
export function setOrderCancelCooldownMs(options: SetOrderCancelCooldownMsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "newCooldownMs"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'set_order_cancel_cooldown_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolveMarketArguments {
    globalConfig: RawTransactionArgument<string>;
    keeperRequest: TransactionArgument;
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
    outcome: TransactionArgument;
}
export interface ResolveMarketOptions {
    package?: string;
    arguments: ResolveMarketArguments | [
        globalConfig: RawTransactionArgument<string>,
        keeperRequest: TransactionArgument,
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>,
        outcome: TransactionArgument
    ];
    typeArguments: [
        string
    ];
}
/** Keeper records the market outcome. Aborts if already resolved. */
export function resolveMarket(options: ResolveMarketOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        null,
        'vector<u8>',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["globalConfig", "keeperRequest", "marketRegistry", "marketId", "outcome"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolve_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PauseMarketArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface PauseMarketOptions {
    package?: string;
    arguments: PauseMarketArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Admin pauses new opens for a specific market. Existing positions unaffected. If
 * the market does not exist yet, this creates market metadata and emits
 * `MarketCreated { by_admin: true }` before `MarketPaused`.
 */
export function pauseMarket(options: PauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'pause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnpauseMarketArguments {
    _: RawTransactionArgument<string>;
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface UnpauseMarketOptions {
    package?: string;
    arguments: UnpauseMarketArguments | [
        _: RawTransactionArgument<string>,
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/** Admin re-enables opens for a previously paused market. */
export function unpauseMarket(options: UnpauseMarketOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["_", "marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unpause_market',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionStatusArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionStatusOptions {
    package?: string;
    arguments: PositionStatusArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionStatus(options: PositionStatusOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_status',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionAccountIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionAccountIdOptions {
    package?: string;
    arguments: PositionAccountIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionAccountId(options: PositionAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionMarketIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionMarketIdOptions {
    package?: string;
    arguments: PositionMarketIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionMarketId(options: PositionMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionSelectionArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionSelectionOptions {
    package?: string;
    arguments: PositionSelectionArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionSelection(options: PositionSelectionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_selection',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionPayoutArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionPayoutOptions {
    package?: string;
    arguments: PositionPayoutArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionPayout(options: PositionPayoutOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_payout',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionFilledArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionFilledOptions {
    package?: string;
    arguments: PositionFilledArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionFilled(options: PositionFilledOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_filled',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionOpenedTsArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionOpenedTsOptions {
    package?: string;
    arguments: PositionOpenedTsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionOpenedTs(options: PositionOpenedTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_opened_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCloseExpiryArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionCloseExpiryOptions {
    package?: string;
    arguments: PositionCloseExpiryArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionCloseExpiry(options: PositionCloseExpiryOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_close_expiry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCloseOrderIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionCloseOrderIdOptions {
    package?: string;
    arguments: PositionCloseOrderIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionCloseOrderId(options: PositionCloseOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_close_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCloseSelfCancelAfterTsArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionCloseSelfCancelAfterTsOptions {
    package?: string;
    arguments: PositionCloseSelfCancelAfterTsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionCloseSelfCancelAfterTs(options: PositionCloseSelfCancelAfterTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_close_self_cancel_after_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCloseMinProceedsArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionCloseMinProceedsOptions {
    package?: string;
    arguments: PositionCloseMinProceedsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionCloseMinProceeds(options: PositionCloseMinProceedsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_close_min_proceeds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionExistsArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionExistsOptions {
    package?: string;
    arguments: PositionExistsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionExists(options: PositionExistsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketRegistryBalanceArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface MarketRegistryBalanceOptions {
    package?: string;
    arguments: MarketRegistryBalanceArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketRegistryBalance(options: MarketRegistryBalanceOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_registry_balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketRegistryMinReserveArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface MarketRegistryMinReserveOptions {
    package?: string;
    arguments: MarketRegistryMinReserveArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketRegistryMinReserve(options: MarketRegistryMinReserveOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_registry_min_reserve',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketRegistryOrderCancelCooldownMsArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface MarketRegistryOrderCancelCooldownMsOptions {
    package?: string;
    arguments: MarketRegistryOrderCancelCooldownMsArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketRegistryOrderCancelCooldownMs(options: MarketRegistryOrderCancelCooldownMsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_registry_order_cancel_cooldown_ms',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NextOrderIdArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface NextOrderIdOptions {
    package?: string;
    arguments: NextOrderIdArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function nextOrderId(options: NextOrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'next_order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface NextPositionIdArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface NextPositionIdOptions {
    package?: string;
    arguments: NextPositionIdArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function nextPositionId(options: NextPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'next_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionIdForOrderArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface PositionIdForOrderOptions {
    package?: string;
    arguments: PositionIdForOrderArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionIdForOrder(options: PositionIdForOrderOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_id_for_order',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsMarketResolvedArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface IsMarketResolvedOptions {
    package?: string;
    arguments: IsMarketResolvedArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function isMarketResolved(options: IsMarketResolvedOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'is_market_resolved',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsMarketPausedArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface IsMarketPausedOptions {
    package?: string;
    arguments: IsMarketPausedArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function isMarketPaused(options: IsMarketPausedOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'is_market_paused',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IsMarketPausedByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface IsMarketPausedByKeyOptions {
    package?: string;
    arguments: IsMarketPausedByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function isMarketPausedByKey(options: IsMarketPausedByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'is_market_paused_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketExistsArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketExistsOptions {
    package?: string;
    arguments: MarketExistsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function marketExists(options: MarketExistsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketOutcomeArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketOutcomeOptions {
    package?: string;
    arguments: MarketOutcomeArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
/** Aborts if the market is unresolved or doesn't exist. */
export function marketOutcome(options: MarketOutcomeOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_outcome',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketOutcomeByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketOutcomeByKeyOptions {
    package?: string;
    arguments: MarketOutcomeByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketOutcomeByKey(options: MarketOutcomeByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_outcome_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketUnclaimedCountArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketUnclaimedCountOptions {
    package?: string;
    arguments: MarketUnclaimedCountArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function marketUnclaimedCount(options: MarketUnclaimedCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_unclaimed_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketExposureArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketExposureOptions {
    package?: string;
    arguments: MarketExposureArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function marketExposure(options: MarketExposureOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_exposure',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrdersArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface OrdersOptions {
    package?: string;
    arguments: OrdersArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orders(options: OrdersOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'orders',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderCountArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface OrderCountOptions {
    package?: string;
    arguments: OrderCountArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orderCount(options: OrderCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderKeyAtArguments {
    marketRegistry: RawTransactionArgument<string>;
    index: RawTransactionArgument<number | bigint>;
}
export interface OrderKeyAtOptions {
    package?: string;
    arguments: OrderKeyAtArguments | [
        marketRegistry: RawTransactionArgument<string>,
        index: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderKeyAt(options: OrderKeyAtOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "index"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_key_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderFrontArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface OrderFrontOptions {
    package?: string;
    arguments: OrderFrontArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orderFront(options: OrderFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderBackArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface OrderBackOptions {
    package?: string;
    arguments: OrderBackArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function orderBack(options: OrderBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderNextArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderNextOptions {
    package?: string;
    arguments: OrderNextArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderNext(options: OrderNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderPrevArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderPrevOptions {
    package?: string;
    arguments: OrderPrevArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderPrev(options: OrderPrevOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_prev',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderExistsArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderExistsOptions {
    package?: string;
    arguments: OrderExistsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderExists(options: OrderExistsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    lookupOrderId: RawTransactionArgument<number | bigint>;
}
export interface OrderIdOptions {
    package?: string;
    arguments: OrderIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        lookupOrderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderId(options: OrderIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "lookupOrderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderKindArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderKindOptions {
    package?: string;
    arguments: OrderKindArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderKind(options: OrderKindOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_kind',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderAccountIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderAccountIdOptions {
    package?: string;
    arguments: OrderAccountIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderAccountId(options: OrderAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderReceiverAccountIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderReceiverAccountIdOptions {
    package?: string;
    arguments: OrderReceiverAccountIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderReceiverAccountId(options: OrderReceiverAccountIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_receiver_account_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderMarketIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderMarketIdOptions {
    package?: string;
    arguments: OrderMarketIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderMarketId(options: OrderMarketIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_market_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderSelectionArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderSelectionOptions {
    package?: string;
    arguments: OrderSelectionArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderSelection(options: OrderSelectionOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_selection',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderPositionIdArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderPositionIdOptions {
    package?: string;
    arguments: OrderPositionIdArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderPositionId(options: OrderPositionIdOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_position_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderMaxSpendArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderMaxSpendOptions {
    package?: string;
    arguments: OrderMaxSpendArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderMaxSpend(options: OrderMaxSpendOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_max_spend',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderMinSharesArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderMinSharesOptions {
    package?: string;
    arguments: OrderMinSharesArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderMinShares(options: OrderMinSharesOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_min_shares',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderPriceCapArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderPriceCapOptions {
    package?: string;
    arguments: OrderPriceCapArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderPriceCap(options: OrderPriceCapOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_price_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderMinProceedsArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderMinProceedsOptions {
    package?: string;
    arguments: OrderMinProceedsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderMinProceeds(options: OrderMinProceedsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_min_proceeds',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderExpiryArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderExpiryOptions {
    package?: string;
    arguments: OrderExpiryArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderExpiry(options: OrderExpiryOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_expiry',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderSelfCancelAfterTsArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderSelfCancelAfterTsOptions {
    package?: string;
    arguments: OrderSelfCancelAfterTsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderSelfCancelAfterTs(options: OrderSelfCancelAfterTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_self_cancel_after_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderCreatedTsArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderCreatedTsOptions {
    package?: string;
    arguments: OrderCreatedTsArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderCreatedTs(options: OrderCreatedTsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_created_ts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface OrderIsByAdminArguments {
    marketRegistry: RawTransactionArgument<string>;
    orderId: RawTransactionArgument<number | bigint>;
}
export interface OrderIsByAdminOptions {
    package?: string;
    arguments: OrderIsByAdminArguments | [
        marketRegistry: RawTransactionArgument<string>,
        orderId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function orderIsByAdmin(options: OrderIsByAdminOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "orderId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_is_by_admin',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionsArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface PositionsOptions {
    package?: string;
    arguments: PositionsArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function positions(options: PositionsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'positions',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionCountArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface PositionCountOptions {
    package?: string;
    arguments: PositionCountArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function positionCount(options: PositionCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionKeyAtArguments {
    marketRegistry: RawTransactionArgument<string>;
    index: RawTransactionArgument<number | bigint>;
}
export interface PositionKeyAtOptions {
    package?: string;
    arguments: PositionKeyAtArguments | [
        marketRegistry: RawTransactionArgument<string>,
        index: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionKeyAt(options: PositionKeyAtOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "index"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_key_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionFrontArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface PositionFrontOptions {
    package?: string;
    arguments: PositionFrontArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function positionFront(options: PositionFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionBackArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface PositionBackOptions {
    package?: string;
    arguments: PositionBackArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function positionBack(options: PositionBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionNextArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionNextOptions {
    package?: string;
    arguments: PositionNextArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionNext(options: PositionNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PositionPrevArguments {
    marketRegistry: RawTransactionArgument<string>;
    positionId: RawTransactionArgument<number | bigint>;
}
export interface PositionPrevOptions {
    package?: string;
    arguments: PositionPrevArguments | [
        marketRegistry: RawTransactionArgument<string>,
        positionId: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function positionPrev(options: PositionPrevOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "positionId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'position_prev',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketCountArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface MarketCountOptions {
    package?: string;
    arguments: MarketCountArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function marketCount(options: MarketCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketId: RawTransactionArgument<Array<number>>;
}
export interface MarketKeyOptions {
    package?: string;
    arguments: MarketKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketId: RawTransactionArgument<Array<number>>
    ];
    typeArguments: [
        string
    ];
}
export function marketKey(options: MarketKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketId"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketKeyAtArguments {
    marketRegistry: RawTransactionArgument<string>;
    index: RawTransactionArgument<number | bigint>;
}
export interface MarketKeyAtOptions {
    package?: string;
    arguments: MarketKeyAtArguments | [
        marketRegistry: RawTransactionArgument<string>,
        index: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/**
 * Compatibility helper for indexed reads. Returns unresolved market keys first,
 * then resolved market keys. Prefer the linked-table cursor helpers for canonical
 * traversal.
 */
export function marketKeyAt(options: MarketKeyAtOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "index"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_key_at',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketIdByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketIdByKeyOptions {
    package?: string;
    arguments: MarketIdByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketIdByKey(options: MarketIdByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_id_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketExistsByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketExistsByKeyOptions {
    package?: string;
    arguments: MarketExistsByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketExistsByKey(options: MarketExistsByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_exists_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketIsResolvedByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketIsResolvedByKeyOptions {
    package?: string;
    arguments: MarketIsResolvedByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketIsResolvedByKey(options: MarketIsResolvedByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_is_resolved_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketUnclaimedCountByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketUnclaimedCountByKeyOptions {
    package?: string;
    arguments: MarketUnclaimedCountByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketUnclaimedCountByKey(options: MarketUnclaimedCountByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_unclaimed_count_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MarketExposureByKeyArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface MarketExposureByKeyOptions {
    package?: string;
    arguments: MarketExposureByKeyArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function marketExposureByKey(options: MarketExposureByKeyOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'market_exposure_by_key',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketsArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface UnresolvedMarketsOptions {
    package?: string;
    arguments: UnresolvedMarketsArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarkets(options: UnresolvedMarketsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_markets',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketsArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface ResolvedMarketsOptions {
    package?: string;
    arguments: ResolvedMarketsArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarkets(options: ResolvedMarketsOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_markets',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketCountArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface UnresolvedMarketCountOptions {
    package?: string;
    arguments: UnresolvedMarketCountArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketCount(options: UnresolvedMarketCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_market_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketCountArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface ResolvedMarketCountOptions {
    package?: string;
    arguments: ResolvedMarketCountArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketCount(options: ResolvedMarketCountOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_market_count',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketFrontArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface UnresolvedMarketFrontOptions {
    package?: string;
    arguments: UnresolvedMarketFrontArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketFront(options: UnresolvedMarketFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_market_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketBackArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface UnresolvedMarketBackOptions {
    package?: string;
    arguments: UnresolvedMarketBackArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketBack(options: UnresolvedMarketBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_market_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketFrontArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface ResolvedMarketFrontOptions {
    package?: string;
    arguments: ResolvedMarketFrontArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketFront(options: ResolvedMarketFrontOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_market_front',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketBackArguments {
    marketRegistry: RawTransactionArgument<string>;
}
export interface ResolvedMarketBackOptions {
    package?: string;
    arguments: ResolvedMarketBackArguments | [
        marketRegistry: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketBack(options: ResolvedMarketBackOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_market_back',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketNextArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface UnresolvedMarketNextOptions {
    package?: string;
    arguments: UnresolvedMarketNextArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketNext(options: UnresolvedMarketNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_market_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnresolvedMarketPrevArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface UnresolvedMarketPrevOptions {
    package?: string;
    arguments: UnresolvedMarketPrevArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function unresolvedMarketPrev(options: UnresolvedMarketPrevOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'unresolved_market_prev',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketNextArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface ResolvedMarketNextOptions {
    package?: string;
    arguments: ResolvedMarketNextArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketNext(options: ResolvedMarketNextOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_market_next',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ResolvedMarketPrevArguments {
    marketRegistry: RawTransactionArgument<string>;
    marketKey: RawTransactionArgument<number | bigint>;
}
export interface ResolvedMarketPrevOptions {
    package?: string;
    arguments: ResolvedMarketPrevArguments | [
        marketRegistry: RawTransactionArgument<string>,
        marketKey: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function resolvedMarketPrev(options: ResolvedMarketPrevOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["marketRegistry", "marketKey"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'resolved_market_prev',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
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
        module: 'waterx_prediction',
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
        module: 'waterx_prediction',
        function: 'status_is_pending_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderKindIsOpenArguments {
    kind: TransactionArgument;
}
export interface OrderKindIsOpenOptions {
    package?: string;
    arguments: OrderKindIsOpenArguments | [
        kind: TransactionArgument
    ];
}
export function orderKindIsOpen(options: OrderKindIsOpenOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kind"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_kind_is_open',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface OrderKindIsCloseArguments {
    kind: TransactionArgument;
}
export interface OrderKindIsCloseOptions {
    package?: string;
    arguments: OrderKindIsCloseArguments | [
        kind: TransactionArgument
    ];
}
export function orderKindIsClose(options: OrderKindIsCloseOptions) {
    const packageAddress = options.package ?? '@waterx/prediction';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["kind"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'waterx_prediction',
        function: 'order_kind_is_close',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}