/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Module for the record of Credit and Debt of certain entity */

import { MoveTuple, MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs, type BcsType } from '@mysten/sui/bcs';
import { type Transaction, type TransactionArgument } from '@mysten/sui/transactions';
import * as type_name from './deps/std/type_name.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as liability from './liability.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as balance_1 from './deps/sui/balance.ts';
const $moduleName = '@bucket/framework::sheet';
export const Entity = new MoveTuple({ name: `${$moduleName}::Entity`, fields: [type_name.TypeName] });
export const Sheet = new MoveStruct({ name: `${$moduleName}::Sheet<phantom CoinType, phantom SelfEntity>`, fields: {
        credits: vec_map.VecMap(Entity, liability.Credit),
        debts: vec_map.VecMap(Entity, liability.Debt),
        blacklist: vec_set.VecSet(Entity)
    } });
export const Loan = new MoveStruct({ name: `${$moduleName}::Loan<phantom CoinType, phantom Lender, phantom Receiver>`, fields: {
        balance: balance_1.Balance,
        debt: liability.Debt
    } });
export const Request = new MoveStruct({ name: `${$moduleName}::Request<phantom CoinType, phantom Collector>`, fields: {
        requirement: bcs.u64(),
        balance: balance_1.Balance,
        checklist: bcs.option(bcs.vector(Entity)),
        payer_debts: vec_map.VecMap(Entity, liability.Debt)
    } });
export interface NewArguments<E extends BcsType<any>> {
    _: RawTransactionArgument<E>;
}
export interface NewOptions<E extends BcsType<any>> {
    package?: string;
    arguments: NewArguments<E> | [
        _: RawTransactionArgument<E>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** Public Funs */
export function _new<E extends BcsType<any>>(options: NewOptions<E>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LendArguments<L extends BcsType<any>> {
    sheet: TransactionArgument;
    balance: TransactionArgument;
    LenderStamp: RawTransactionArgument<L>;
}
export interface LendOptions<L extends BcsType<any>> {
    package?: string;
    arguments: LendArguments<L> | [
        sheet: TransactionArgument,
        balance: TransactionArgument,
        LenderStamp: RawTransactionArgument<L>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function lend<L extends BcsType<any>>(options: LendOptions<L>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "balance", "LenderStamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'lend',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ReceiveArguments<R extends BcsType<any>> {
    sheet: TransactionArgument;
    loan: TransactionArgument;
    ReceiverStamp: RawTransactionArgument<R>;
}
export interface ReceiveOptions<R extends BcsType<any>> {
    package?: string;
    arguments: ReceiveArguments<R> | [
        sheet: TransactionArgument,
        loan: TransactionArgument,
        ReceiverStamp: RawTransactionArgument<R>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function receive<R extends BcsType<any>>(options: ReceiveOptions<R>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[2]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "loan", "ReceiverStamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'receive',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequestArguments<C extends BcsType<any>> {
    requirement: RawTransactionArgument<number | bigint>;
    checklist: TransactionArgument;
    CollectorStamp: RawTransactionArgument<C>;
}
export interface RequestOptions<C extends BcsType<any>> {
    package?: string;
    arguments: RequestArguments<C> | [
        requirement: RawTransactionArgument<number | bigint>,
        checklist: TransactionArgument,
        CollectorStamp: RawTransactionArgument<C>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function request<C extends BcsType<any>>(options: RequestOptions<C>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        'u64',
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["requirement", "checklist", "CollectorStamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PayArguments<P extends BcsType<any>> {
    sheet: TransactionArgument;
    req: TransactionArgument;
    balance: TransactionArgument;
    PayerStamp: RawTransactionArgument<P>;
}
export interface PayOptions<P extends BcsType<any>> {
    package?: string;
    arguments: PayArguments<P> | [
        sheet: TransactionArgument,
        req: TransactionArgument,
        balance: TransactionArgument,
        PayerStamp: RawTransactionArgument<P>
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function pay<P extends BcsType<any>>(options: PayOptions<P>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        null,
        `${options.typeArguments[2]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "req", "balance", "PayerStamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'pay',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CollectArguments<C extends BcsType<any>> {
    sheet: TransactionArgument;
    req: TransactionArgument;
    Stamp: RawTransactionArgument<C>;
}
export interface CollectOptions<C extends BcsType<any>> {
    package?: string;
    arguments: CollectArguments<C> | [
        sheet: TransactionArgument,
        req: TransactionArgument,
        Stamp: RawTransactionArgument<C>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function collect<C extends BcsType<any>>(options: CollectOptions<C>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "req", "Stamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'collect',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddDebtorArguments<E extends BcsType<any>> {
    sheet: TransactionArgument;
    debtor: TransactionArgument;
    Stamp: RawTransactionArgument<E>;
}
export interface AddDebtorOptions<E extends BcsType<any>> {
    package?: string;
    arguments: AddDebtorArguments<E> | [
        sheet: TransactionArgument,
        debtor: TransactionArgument,
        Stamp: RawTransactionArgument<E>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function addDebtor<E extends BcsType<any>>(options: AddDebtorOptions<E>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "debtor", "Stamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'add_debtor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddCreditorArguments<E extends BcsType<any>> {
    sheet: TransactionArgument;
    creditor: TransactionArgument;
    Stamp: RawTransactionArgument<E>;
}
export interface AddCreditorOptions<E extends BcsType<any>> {
    package?: string;
    arguments: AddCreditorArguments<E> | [
        sheet: TransactionArgument,
        creditor: TransactionArgument,
        Stamp: RawTransactionArgument<E>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function addCreditor<E extends BcsType<any>>(options: AddCreditorOptions<E>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "creditor", "Stamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'add_creditor',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BanArguments<E extends BcsType<any>> {
    sheet: TransactionArgument;
    entity: TransactionArgument;
    Stamp: RawTransactionArgument<E>;
}
export interface BanOptions<E extends BcsType<any>> {
    package?: string;
    arguments: BanArguments<E> | [
        sheet: TransactionArgument,
        entity: TransactionArgument,
        Stamp: RawTransactionArgument<E>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function ban<E extends BcsType<any>>(options: BanOptions<E>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "entity", "Stamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'ban',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UnbanArguments<E extends BcsType<any>> {
    sheet: TransactionArgument;
    entity: TransactionArgument;
    Stamp: RawTransactionArgument<E>;
}
export interface UnbanOptions<E extends BcsType<any>> {
    package?: string;
    arguments: UnbanArguments<E> | [
        sheet: TransactionArgument,
        entity: TransactionArgument,
        Stamp: RawTransactionArgument<E>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function unban<E extends BcsType<any>>(options: UnbanOptions<E>) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null,
        null,
        `${options.typeArguments[1]}`
    ] satisfies (string | null)[];
    const parameterNames = ["sheet", "entity", "Stamp"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'unban',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface EntityOptions {
    package?: string;
    arguments?: [
    ];
    typeArguments: [
        string
    ];
}
/** Getter Funs */
export function entity(options: EntityOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'entity',
        typeArguments: options.typeArguments
    });
}
export interface CreditsArguments {
    sheet: TransactionArgument;
}
export interface CreditsOptions {
    package?: string;
    arguments: CreditsArguments | [
        sheet: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function credits(options: CreditsOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sheet"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'credits',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DebtsArguments {
    sheet: TransactionArgument;
}
export interface DebtsOptions {
    package?: string;
    arguments: DebtsArguments | [
        sheet: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function debts(options: DebtsOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sheet"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'debts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BlacklistArguments {
    sheet: TransactionArgument;
}
export interface BlacklistOptions {
    package?: string;
    arguments: BlacklistArguments | [
        sheet: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function blacklist(options: BlacklistOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sheet"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'blacklist',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TotalCreditArguments {
    sheet: TransactionArgument;
}
export interface TotalCreditOptions {
    package?: string;
    arguments: TotalCreditArguments | [
        sheet: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function totalCredit(options: TotalCreditOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sheet"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'total_credit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TotalDebtArguments {
    sheet: TransactionArgument;
}
export interface TotalDebtOptions {
    package?: string;
    arguments: TotalDebtArguments | [
        sheet: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function totalDebt(options: TotalDebtOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["sheet"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'total_debt',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface LoanValueArguments {
    loan: TransactionArgument;
}
export interface LoanValueOptions {
    package?: string;
    arguments: LoanValueArguments | [
        loan: TransactionArgument
    ];
    typeArguments: [
        string,
        string,
        string
    ];
}
export function loanValue(options: LoanValueOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["loan"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'loan_value',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RequirementArguments {
    req: TransactionArgument;
}
export interface RequirementOptions {
    package?: string;
    arguments: RequirementArguments | [
        req: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function requirement(options: RequirementOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'requirement',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceArguments {
    req: TransactionArgument;
}
export interface BalanceOptions {
    package?: string;
    arguments: BalanceArguments | [
        req: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function balance(options: BalanceOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ShortageArguments {
    req: TransactionArgument;
}
export interface ShortageOptions {
    package?: string;
    arguments: ShortageArguments | [
        req: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function shortage(options: ShortageOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'shortage',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface PayerDebtsArguments {
    req: TransactionArgument;
}
export interface PayerDebtsOptions {
    package?: string;
    arguments: PayerDebtsArguments | [
        req: TransactionArgument
    ];
    typeArguments: [
        string,
        string
    ];
}
export function payerDebts(options: PayerDebtsOptions) {
    const packageAddress = options.package ?? '@bucket/framework';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["req"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'sheet',
        function: 'payer_debts',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}