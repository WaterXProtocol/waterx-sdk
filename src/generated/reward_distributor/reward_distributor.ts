/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
import * as double from './deps/bucket_v2_framework/double.ts';
import * as balance from './deps/sui/balance.ts';
import * as balance_1 from './deps/sui/balance.ts';
import * as balance_2 from './deps/sui/balance.ts';
import * as double_1 from './deps/bucket_v2_framework/double.ts';
import * as double_2 from './deps/bucket_v2_framework/double.ts';
import * as table from './deps/sui/table.ts';
import * as vec_set from './deps/sui/vec_set.ts';
import * as vec_set_1 from './deps/sui/vec_set.ts';
import * as vec_set_2 from './deps/sui/vec_set.ts';
import * as balance_3 from './deps/sui/balance.ts';
import * as table_1 from './deps/sui/table.ts';
import * as vec_set_3 from './deps/sui/vec_set.ts';
import * as vec_set_4 from './deps/sui/vec_set.ts';
const $moduleName = '@waterx/reward-distributor::reward_distributor';
export const Create = new MoveStruct({ name: `${$moduleName}::Create`, fields: {
        vault_id: bcs.Address,
        asset_type: bcs.string()
    } });
export const AddRewarder = new MoveStruct({ name: `${$moduleName}::AddRewarder`, fields: {
        vault_id: bcs.Address,
        rewarder_id: bcs.Address,
        asset_type: bcs.string(),
        reward_type: bcs.string()
    } });
export const UpdateFlowRate = new MoveStruct({ name: `${$moduleName}::UpdateFlowRate`, fields: {
        vault_id: bcs.Address,
        rewarder_id: bcs.Address,
        asset_type: bcs.string(),
        reward_type: bcs.string(),
        flow_rate: bcs.u256()
    } });
export const RewardEarned = new MoveStruct({ name: `${$moduleName}::RewardEarned`, fields: {
        vault_id: bcs.Address,
        rewarder_id: bcs.Address,
        asset_type: bcs.string(),
        reward_type: bcs.string(),
        reward_amount: bcs.u64()
    } });
export const Deposit = new MoveStruct({ name: `${$moduleName}::Deposit`, fields: {
        vault_id: bcs.Address,
        asset_type: bcs.string(),
        account_address: bcs.Address,
        stake_amount: bcs.u64()
    } });
export const Redeem = new MoveStruct({ name: `${$moduleName}::Redeem`, fields: {
        vault_id: bcs.Address,
        asset_type: bcs.string(),
        account_address: bcs.Address,
        withdrawal_amount: bcs.u64()
    } });
export const ClaimReward = new MoveStruct({ name: `${$moduleName}::ClaimReward`, fields: {
        vault_id: bcs.Address,
        rewarder_id: bcs.Address,
        asset_type: bcs.string(),
        reward_type: bcs.string(),
        account_address: bcs.Address,
        reward_amount: bcs.u64(),
        cumulative_reward_amount: bcs.u64()
    } });
export const StakePosition = new MoveStruct({ name: `${$moduleName}::StakePosition`, fields: {
        stake_amount: bcs.u64(),
        pending_rewarder_sync: bcs.bool()
    } });
export const RewarderKey = new MoveStruct({ name: `${$moduleName}::RewarderKey<phantom R>`, fields: {
        dummy_field: bcs.bool()
    } });
export const RewardData = new MoveStruct({ name: `${$moduleName}::RewardData<phantom R>`, fields: {
        unit: double.Double,
        reward: balance.Balance,
        cumulative_reward_amount: bcs.u64()
    } });
export const Rewarder = new MoveStruct({ name: `${$moduleName}::Rewarder<phantom STAKE, phantom R>`, fields: {
        id: bcs.Address,
        source: balance_1.Balance,
        pool: balance_2.Balance,
        flow_rate: double_1.Double,
        unit: double_2.Double,
        timestamp: bcs.u64(),
        total_stake_snapshot: bcs.u64(),
        reward_table: table.Table
    } });
export const StakeDataDisplay = new MoveStruct({ name: `${$moduleName}::StakeDataDisplay`, fields: {
        stake_coin_type: bcs.string(),
        reward_coin_type: bcs.string(),
        stake_amount: bcs.u64(),
        claimable_reward_amount: bcs.u64(),
        cumulative_reward_amount: bcs.u64()
    } });
export const DepositChecker = new MoveStruct({ name: `${$moduleName}::DepositChecker<phantom STAKE>`, fields: {
        account: bcs.Address,
        prev_stake_amount: bcs.u64(),
        rewarder_ids: vec_set.VecSet(bcs.Address)
    } });
export const WithdrawChecker = new MoveStruct({ name: `${$moduleName}::WithdrawChecker<phantom STAKE>`, fields: {
        account: bcs.Address,
        prev_stake_amount: bcs.u64(),
        rewarder_ids: vec_set_1.VecSet(bcs.Address)
    } });
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export const RewardDistributor = new MoveStruct({ name: `${$moduleName}::RewardDistributor<phantom STAKE>`, fields: {
        id: bcs.Address,
        versions: vec_set_2.VecSet(bcs.u16()),
        stake: balance_3.Balance,
        stake_table: table_1.Table,
        managers: vec_set_3.VecSet(bcs.Address),
        stake_cap: bcs.u64(),
        rewarder_ids: vec_set_4.VecSet(bcs.Address)
    } });
export interface PackageVersionOptions {
    package?: string;
    arguments?: [
    ];
}
export function packageVersion(options: PackageVersionOptions = {}) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'package_version',
    });
}
export interface NewArguments {
    AdminCap: RawTransactionArgument<string>;
    stakeCap: RawTransactionArgument<number | bigint>;
}
export interface NewOptions {
    package?: string;
    arguments: NewArguments | [
        AdminCap: RawTransactionArgument<string>,
        stakeCap: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
/** === Admin Functions === */
export function _new(options: NewOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["AdminCap", "stakeCap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'new',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DefaultArguments {
    adminCap: RawTransactionArgument<string>;
    stakeCap: RawTransactionArgument<number | bigint>;
}
export interface DefaultOptions {
    package?: string;
    arguments: DefaultArguments | [
        adminCap: RawTransactionArgument<string>,
        stakeCap: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function _default(options: DefaultOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["adminCap", "stakeCap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'default',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddRewarderArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    flowAmount: RawTransactionArgument<number | bigint>;
    flowInterval: RawTransactionArgument<number | bigint>;
    startTime: RawTransactionArgument<number | bigint>;
}
export interface AddRewarderOptions {
    package?: string;
    arguments: AddRewarderArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        flowAmount: RawTransactionArgument<number | bigint>,
        flowInterval: RawTransactionArgument<number | bigint>,
        startTime: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function addRewarder(options: AddRewarderOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'u64',
        'u64',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "flowAmount", "flowInterval", "startTime"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'add_rewarder',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawFromSourceArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    amount: RawTransactionArgument<number | bigint>;
}
export interface WithdrawFromSourceOptions {
    package?: string;
    arguments: WithdrawFromSourceArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        amount: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function withdrawFromSource(options: WithdrawFromSourceOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock',
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "amount"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'withdraw_from_source',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SetStakeCapArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    stakeCap: RawTransactionArgument<number | bigint>;
}
export interface SetStakeCapOptions {
    package?: string;
    arguments: SetStakeCapArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        stakeCap: RawTransactionArgument<number | bigint>
    ];
    typeArguments: [
        string
    ];
}
export function setStakeCap(options: SetStakeCapOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'u64'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "stakeCap"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'set_stake_cap',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddManagerArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    manager: RawTransactionArgument<string>;
}
export interface AddManagerOptions {
    package?: string;
    arguments: AddManagerArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        manager: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function addManager(options: AddManagerOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "manager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'add_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveManagerArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    manager: RawTransactionArgument<string>;
}
export interface RemoveManagerOptions {
    package?: string;
    arguments: RemoveManagerArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        manager: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function removeManager(options: RemoveManagerOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "manager"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'remove_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface AddVersionArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface AddVersionOptions {
    package?: string;
    arguments: AddVersionArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function addVersion(options: AddVersionOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'add_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RemoveVersionArguments {
    self: RawTransactionArgument<string>;
    Cap: RawTransactionArgument<string>;
    version: RawTransactionArgument<number>;
}
export interface RemoveVersionOptions {
    package?: string;
    arguments: RemoveVersionArguments | [
        self: RawTransactionArgument<string>,
        Cap: RawTransactionArgument<string>,
        version: RawTransactionArgument<number>
    ];
    typeArguments: [
        string
    ];
}
export function removeVersion(options: RemoveVersionOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        'u16'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "Cap", "version"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'remove_version',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface UpdateFlowRateArguments {
    self: RawTransactionArgument<string>;
    flowAmount: RawTransactionArgument<number | bigint>;
    flowInterval: RawTransactionArgument<number | bigint>;
    request: RawTransactionArgument<string>;
}
export interface UpdateFlowRateOptions {
    package?: string;
    arguments: UpdateFlowRateArguments | [
        self: RawTransactionArgument<string>,
        flowAmount: RawTransactionArgument<number | bigint>,
        flowInterval: RawTransactionArgument<number | bigint>,
        request: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** === Manager Functions === */
export function updateFlowRate(options: UpdateFlowRateOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock',
        'u64',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "flowAmount", "flowInterval", "request"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'update_flow_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositToSourceByManagerArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    flowInterval: RawTransactionArgument<number | bigint>;
    managerReq: RawTransactionArgument<string>;
}
export interface DepositToSourceByManagerOptions {
    package?: string;
    arguments: DepositToSourceByManagerArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        flowInterval: RawTransactionArgument<number | bigint>,
        managerReq: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function depositToSourceByManager(options: DepositToSourceByManagerOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock',
        null,
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin", "flowInterval", "managerReq"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'deposit_to_source_by_manager',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositToSourceArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositToSourceOptions {
    package?: string;
    arguments: DepositToSourceArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
/** === Public Functions === */
export function depositToSource(options: DepositToSourceOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'deposit_to_source',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SupplyArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface SupplyOptions {
    package?: string;
    arguments: SupplyArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function supply(options: SupplyOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'supply',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositToPoolArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
}
export interface DepositToPoolOptions {
    package?: string;
    arguments: DepositToPoolArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function depositToPool(options: DepositToPoolOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'deposit_to_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DepositArguments {
    self: RawTransactionArgument<string>;
    coin: RawTransactionArgument<string>;
    accReq: RawTransactionArgument<string>;
}
export interface DepositOptions {
    package?: string;
    arguments: DepositArguments | [
        self: RawTransactionArgument<string>,
        coin: RawTransactionArgument<string>,
        accReq: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function deposit(options: DepositOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock',
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "coin", "accReq"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SettleRewarderOnDepositArguments {
    checker: RawTransactionArgument<string>;
    self: RawTransactionArgument<string>;
}
export interface SettleRewarderOnDepositOptions {
    package?: string;
    arguments: SettleRewarderOnDepositArguments | [
        checker: RawTransactionArgument<string>,
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function settleRewarderOnDeposit(options: SettleRewarderOnDepositOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["checker", "self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'settle_rewarder_on_deposit',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DestroyDepositCheckerArguments {
    checker: RawTransactionArgument<string>;
}
export interface DestroyDepositCheckerOptions {
    package?: string;
    arguments: DestroyDepositCheckerArguments | [
        checker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function destroyDepositChecker(options: DestroyDepositCheckerOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["checker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'destroy_deposit_checker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RedeemArguments {
    self: RawTransactionArgument<string>;
    withdrawalAmount: RawTransactionArgument<number | bigint>;
    accReq: RawTransactionArgument<string>;
}
export interface RedeemOptions {
    package?: string;
    arguments: RedeemArguments | [
        self: RawTransactionArgument<string>,
        withdrawalAmount: RawTransactionArgument<number | bigint>,
        accReq: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function redeem(options: RedeemOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        '0x2::clock::Clock',
        'u64',
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self", "withdrawalAmount", "accReq"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'redeem',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface SettleRewarderOnWithdrawArguments {
    checker: RawTransactionArgument<string>;
    self: RawTransactionArgument<string>;
}
export interface SettleRewarderOnWithdrawOptions {
    package?: string;
    arguments: SettleRewarderOnWithdrawArguments | [
        checker: RawTransactionArgument<string>,
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function settleRewarderOnWithdraw(options: SettleRewarderOnWithdrawOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["checker", "self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'settle_rewarder_on_withdraw',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface DestroyWithdrawCheckerArguments {
    checker: RawTransactionArgument<string>;
}
export interface DestroyWithdrawCheckerOptions {
    package?: string;
    arguments: DestroyWithdrawCheckerArguments | [
        checker: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function destroyWithdrawChecker(options: DestroyWithdrawCheckerOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["checker"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'destroy_withdraw_checker',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface ClaimArguments {
    self: RawTransactionArgument<string>;
    request: RawTransactionArgument<string>;
}
export interface ClaimOptions {
    package?: string;
    arguments: ClaimArguments | [
        self: RawTransactionArgument<string>,
        request: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function claim(options: ClaimOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        null,
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "request"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'claim',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface IdArguments {
    self: RawTransactionArgument<string>;
}
export interface IdOptions {
    package?: string;
    arguments: IdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
/** === View Functions === */
export function id(options: IdOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderIdsArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderIdsOptions {
    package?: string;
    arguments: RewarderIdsArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function rewarderIds(options: RewarderIdsOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_ids',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderExistsArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderExistsOptions {
    package?: string;
    arguments: RewarderExistsArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderExists(options: RewarderExistsOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetRewarderArguments {
    self: RawTransactionArgument<string>;
}
export interface GetRewarderOptions {
    package?: string;
    arguments: GetRewarderArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function getRewarder(options: GetRewarderOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'get_rewarder',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderIdArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderIdOptions {
    package?: string;
    arguments: RewarderIdArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderId(options: RewarderIdOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_id',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderSourceAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderSourceAmountOptions {
    package?: string;
    arguments: RewarderSourceAmountArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderSourceAmount(options: RewarderSourceAmountOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_source_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderPoolAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderPoolAmountOptions {
    package?: string;
    arguments: RewarderPoolAmountArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderPoolAmount(options: RewarderPoolAmountOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_pool_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderFlowRateArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderFlowRateOptions {
    package?: string;
    arguments: RewarderFlowRateArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderFlowRate(options: RewarderFlowRateOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_flow_rate',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderTimestampArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderTimestampOptions {
    package?: string;
    arguments: RewarderTimestampArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderTimestamp(options: RewarderTimestampOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_timestamp',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RewarderTotalStakeSnapshotArguments {
    self: RawTransactionArgument<string>;
}
export interface RewarderTotalStakeSnapshotOptions {
    package?: string;
    arguments: RewarderTotalStakeSnapshotArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function rewarderTotalStakeSnapshot(options: RewarderTotalStakeSnapshotOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'rewarder_total_stake_snapshot',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface StakeExistsArguments {
    self: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface StakeExistsOptions {
    package?: string;
    arguments: StakeExistsArguments | [
        self: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function stakeExists(options: StakeExistsOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'stake_exists',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface TotalStakeAmountArguments {
    self: RawTransactionArgument<string>;
}
export interface TotalStakeAmountOptions {
    package?: string;
    arguments: TotalStakeAmountArguments | [
        self: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function totalStakeAmount(options: TotalStakeAmountOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null
    ] satisfies (string | null)[];
    const parameterNames = ["self"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'total_stake_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface RealtimeRewardAmountArguments {
    self: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface RealtimeRewardAmountOptions {
    package?: string;
    arguments: RealtimeRewardAmountArguments | [
        self: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function realtimeRewardAmount(options: RealtimeRewardAmountOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'realtime_reward_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface WithdrawableAmountArguments {
    self: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface WithdrawableAmountOptions {
    package?: string;
    arguments: WithdrawableAmountArguments | [
        self: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string
    ];
}
export function withdrawableAmount(options: WithdrawableAmountOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'address'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'withdrawable_amount',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}
export interface GetStakeDataArguments {
    self: RawTransactionArgument<string>;
    account: RawTransactionArgument<string>;
}
export interface GetStakeDataOptions {
    package?: string;
    arguments: GetStakeDataArguments | [
        self: RawTransactionArgument<string>,
        account: RawTransactionArgument<string>
    ];
    typeArguments: [
        string,
        string
    ];
}
export function getStakeData(options: GetStakeDataOptions) {
    const packageAddress = options.package ?? '@waterx/reward-distributor';
    const argumentsTypes = [
        null,
        'address',
        '0x2::clock::Clock'
    ] satisfies (string | null)[];
    const parameterNames = ["self", "account"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'reward_distributor',
        function: 'get_stake_data',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
        typeArguments: options.typeArguments
    });
}