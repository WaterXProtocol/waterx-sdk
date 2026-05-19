/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, MoveTuple, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
import * as vec_map from './deps/sui/vec_map.ts';
import * as balance_1 from './deps/sui/balance.ts';
import * as sheet_1 from './deps/bucket_v2_framework/sheet.ts';
const $moduleName = '@waterx/native-custody::custody_vault';
export const NativeCustody = new MoveStruct({ name: `${$moduleName}::NativeCustody`, fields: {
        dummy_field: bcs.bool()
    } });
export const FeeConfig = new MoveStruct({ name: `${$moduleName}::FeeConfig`, fields: {
        mint_fee_rate: float.Float,
        burn_fee_rate: float_1.Float
    } });
export const SingleVault = new MoveStruct({ name: `${$moduleName}::SingleVault<phantom T>`, fields: {
        id: bcs.Address,
        decimal: bcs.u8(),
        default_fee_config: FeeConfig,
        partner_fee_configs: vec_map.VecMap(bcs.Address, FeeConfig),
        min_burn_amount: bcs.u64(),
        balance: balance_1.Balance,
        balance_amount: bcs.u64(),
        credit_backing: bcs.u64(),
        sheet: sheet_1.Sheet,
        deprecated: bcs.bool()
    } });
export const CustodyVault = new MoveStruct({ name: `${$moduleName}::CustodyVault<phantom CREDIT>`, fields: {
        id: bcs.Address,
        credit_supply: bcs.u64()
    } });
export const VaultKey = new MoveTuple({ name: `${$moduleName}::VaultKey<phantom T>`, fields: [bcs.bool()] });
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'package_version',
    });
}
export interface MemoMintOptions {
    package?: string;
    arguments?: [
    ];
}
export function memoMint(options: MemoMintOptions = {}) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'memo_mint',
    });
}
export interface MemoBurnOptions {
    package?: string;
    arguments?: [
    ];
}
export function memoBurn(options: MemoBurnOptions = {}) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'memo_burn',
    });
}
export interface CreateVaultArguments {
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
}
export interface CreateVaultOptions {
    package?: string;
    arguments: CreateVaultArguments | [
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** Create + share an empty `CustodyVault<CREDIT>`. Add assets via `add_asset`. */
export function createVault(options: CreateVaultOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["registry", "_"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'create_vault',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddAssetArguments {
    vault: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    decimal: RawTransactionArgument<number>;
    mintFeeRate: RawTransactionArgument<number | bigint>;
    burnFeeRate: RawTransactionArgument<number | bigint>;
    minBurnAmount: RawTransactionArgument<number | bigint>;
}
export interface AddAssetOptions {
    package?: string;
    arguments: AddAssetArguments | [
        vault: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        decimal: RawTransactionArgument<number>,
        mintFeeRate: RawTransactionArgument<number | bigint>,
        burnFeeRate: RawTransactionArgument<number | bigint>,
        minBurnAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Register backing asset `T` on `CustodyVault<CREDIT>`. Fee-rate inputs are raw
 * 1e9-scaled `Float` values (u128). e.g. 1% = `10_000_000`, 100% =
 * `1_000_000_000`. Anything above 1.0 aborts.
 */
export function addAsset(options: AddAssetOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        'u8',
        'u128',
        'u128',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "_", "decimal", "mintFeeRate", "burnFeeRate", "minBurnAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'add_asset',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetMinBurnAmountArguments {
    vault: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    minBurnAmount: RawTransactionArgument<number | bigint>;
}
export interface SetMinBurnAmountOptions {
    package?: string;
    arguments: SetMinBurnAmountArguments | [
        vault: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        minBurnAmount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function setMinBurnAmount(options: SetMinBurnAmountOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "_", "minBurnAmount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'set_min_burn_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetAssetDeprecatedArguments {
    vault: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    deprecated: RawTransactionArgument<boolean>;
}
export interface SetAssetDeprecatedOptions {
    package?: string;
    arguments: SetAssetDeprecatedArguments | [
        vault: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        deprecated: RawTransactionArgument<boolean>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Toggle the `deprecated` flag on a backing asset. When deprecated, `mint` aborts
 * with `EAssetDeprecated`; `burn` still works so existing credit holders can
 * redeem.
 */
export function setAssetDeprecated(options: SetAssetDeprecatedOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        'bool'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "_", "deprecated"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'set_asset_deprecated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetFeeConfigArguments {
    vault: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    partner: RawTransactionArgument<string | null>;
    mintFeeRate: RawTransactionArgument<number | bigint>;
    burnFeeRate: RawTransactionArgument<number | bigint>;
}
export interface SetFeeConfigOptions {
    package?: string;
    arguments: SetFeeConfigArguments | [
        vault: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        partner: RawTransactionArgument<string | null>,
        mintFeeRate: RawTransactionArgument<number | bigint>,
        burnFeeRate: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function setFeeConfig(options: SetFeeConfigOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        '0x1::option::Option<address>',
        'u128',
        'u128'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "_", "partner", "mintFeeRate", "burnFeeRate"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'set_fee_config',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositLiquidityArguments {
    vault: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    assetCoin: RawTransactionArgument<string>;
}
export interface DepositLiquidityOptions {
    package?: string;
    arguments: DepositLiquidityArguments | [
        vault: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        assetCoin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function depositLiquidity(options: DepositLiquidityOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "registry", "_", "assetCoin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'deposit_liquidity',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawLiquidityArguments {
    vault: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    _: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawLiquidityOptions {
    package?: string;
    arguments: WithdrawLiquidityArguments | [
        vault: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        _: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function withdrawLiquidity(options: WithdrawLiquidityOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "registry", "_", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'withdraw_liquidity',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintArguments {
    vault: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    assetCoin: RawTransactionArgument<string>;
    extraData: RawTransactionArgument<number[]>;
}
export interface MintOptions {
    package?: string;
    arguments: MintArguments | [
        vault: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        assetCoin: RawTransactionArgument<string>,
        extraData: RawTransactionArgument<number[]>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Mint credit backed by asset `T` and wrap the resulting `Coin<CREDIT>` into a
 * `DepositRequest<CREDIT>` targeting `account_id`. The hot-potato request keeps
 * the credit inside the waterx_account system — it must be consumed in the same
 * PTB by the deposit policy registered for `CREDIT`. Fee tier is looked up by
 * `account_id.to_address()` — partner discounts follow the destination wxa
 * account, symmetric with `burn`.
 */
export function mint(options: MintOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        null,
        '0x2::object::ID',
        null,
        'vector<u8>'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "registry", "accountRegistry", "accountId", "assetCoin", "extraData"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'mint',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintFromRequestArguments {
    vault: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    accountRegistry: RawTransactionArgument<string>;
    depositRequest: RawTransactionArgument<string>;
}
export interface MintFromRequestOptions {
    package?: string;
    arguments: MintFromRequestArguments | [
        vault: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountRegistry: RawTransactionArgument<string>,
        depositRequest: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * Variant of `mint` that accepts a `DepositRequest<T>` instead of raw `Coin<T>`.
 * Requires `T` to have `NativeCustody` registered as its deposit policy on the wxa
 * `AccountRegistry`. Unwraps the request, then funnels through `mint` so the
 * returned `DepositRequest<CREDIT>` carries the same `account_id` and `extra_data`
 * as the input request.
 */
export function mintFromRequest(options: MintFromRequestOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "registry", "accountRegistry", "depositRequest"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'mint_from_request',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BurnArguments {
    vault: RawTransactionArgument<string>;
    registry: RawTransactionArgument<string>;
    accountId: RawTransactionArgument<string>;
    creditCoin: RawTransactionArgument<string>;
}
export interface BurnOptions {
    package?: string;
    arguments: BurnArguments | [
        vault: RawTransactionArgument<string>,
        registry: RawTransactionArgument<string>,
        accountId: RawTransactionArgument<string>,
        creditCoin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/**
 * `account_id` identifies the wxa Account that the burned CREDIT belongs to. Used
 * (a) as the personal-burn-cap key on the credit registry and (b) as the
 * partner-fee lookup key — so partner discounts follow the source account, not the
 * executor that calls this function (fixes audit finding #3's partner-fee-evasion
 * vector when invoked via `withdrawal_queue::execute_native`).
 */
export function burn(options: BurnOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        null,
        '0x2::object::ID',
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "registry", "accountId", "creditCoin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'burn',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreditSupplyArguments {
    vault: RawTransactionArgument<string>;
}
export interface CreditSupplyOptions {
    package?: string;
    arguments: CreditSupplyArguments | [
        vault: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function creditSupply(options: CreditSupplyOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["vault"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'credit_supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface HasAssetArguments {
    vault: RawTransactionArgument<string>;
}
export interface HasAssetOptions {
    package?: string;
    arguments: HasAssetArguments | [
        vault: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function hasAsset(options: HasAssetOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["vault"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'has_asset',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SingleVaultArguments {
    vault: RawTransactionArgument<string>;
}
export interface SingleVaultOptions {
    package?: string;
    arguments: SingleVaultArguments | [
        vault: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function singleVault(options: SingleVaultOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["vault"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'single_vault',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DecimalArguments {
    single: RawTransactionArgument<string>;
}
export interface DecimalOptions {
    package?: string;
    arguments: DecimalArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function decimal(options: DecimalOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'decimal',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceArguments {
    single: RawTransactionArgument<string>;
}
export interface BalanceOptions {
    package?: string;
    arguments: BalanceArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function balance(options: BalanceOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'balance',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BalanceAmountArguments {
    single: RawTransactionArgument<string>;
}
export interface BalanceAmountOptions {
    package?: string;
    arguments: BalanceAmountArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function balanceAmount(options: BalanceAmountOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'balance_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface CreditBackingArguments {
    single: RawTransactionArgument<string>;
}
export interface CreditBackingOptions {
    package?: string;
    arguments: CreditBackingArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function creditBacking(options: CreditBackingOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'credit_backing',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MinBurnAmountArguments {
    single: RawTransactionArgument<string>;
}
export interface MinBurnAmountOptions {
    package?: string;
    arguments: MinBurnAmountArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function minBurnAmount(options: MinBurnAmountOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'min_burn_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SheetArguments {
    single: RawTransactionArgument<string>;
}
export interface SheetOptions {
    package?: string;
    arguments: SheetArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function sheet(options: SheetOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'sheet',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DeprecatedArguments {
    single: RawTransactionArgument<string>;
}
export interface DeprecatedOptions {
    package?: string;
    arguments: DeprecatedArguments | [
        single: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function deprecated(options: DeprecatedOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["single"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'deprecated',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface MintFeeRateArguments {
    vault: RawTransactionArgument<string>;
    caller: RawTransactionArgument<string>;
}
export interface MintFeeRateOptions {
    package?: string;
    arguments: MintFeeRateArguments | [
        vault: RawTransactionArgument<string>,
        caller: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function mintFeeRate(options: MintFeeRateOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "caller"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'mint_fee_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface BurnFeeRateArguments {
    vault: RawTransactionArgument<string>;
    caller: RawTransactionArgument<string>;
}
export interface BurnFeeRateOptions {
    package?: string;
    arguments: BurnFeeRateArguments | [
        vault: RawTransactionArgument<string>,
        caller: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function burnFeeRate(options: BurnFeeRateOptions) {
    const packageAddress = options.package ?? '@waterx/native-custody';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["vault", "caller"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'custody_vault',
        function: 'burn_fee_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}