/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as type_name from './deps/std/type_name.ts';
import * as type_name_1 from './deps/std/type_name.ts';
import * as type_name_2 from './deps/std/type_name.ts';
import * as type_name_3 from './deps/std/type_name.ts';
import * as type_name_4 from './deps/std/type_name.ts';
import * as type_name_5 from './deps/std/type_name.ts';
import * as type_name_6 from './deps/std/type_name.ts';
import * as type_name_7 from './deps/std/type_name.ts';
import * as type_name_8 from './deps/std/type_name.ts';
import * as type_name_9 from './deps/std/type_name.ts';
import * as type_name_10 from './deps/std/type_name.ts';
import * as type_name_11 from './deps/std/type_name.ts';
import * as type_name_12 from './deps/std/type_name.ts';
import * as type_name_13 from './deps/std/type_name.ts';
import * as type_name_14 from './deps/std/type_name.ts';
import * as type_name_15 from './deps/std/type_name.ts';
import * as type_name_16 from './deps/std/type_name.ts';
import * as type_name_17 from './deps/std/type_name.ts';
import * as type_name_18 from './deps/std/type_name.ts';
import * as type_name_19 from './deps/std/type_name.ts';
import * as type_name_20 from './deps/std/type_name.ts';
import * as type_name_21 from './deps/std/type_name.ts';
import * as type_name_22 from './deps/std/type_name.ts';
import * as type_name_23 from './deps/std/type_name.ts';
import * as type_name_24 from './deps/std/type_name.ts';
import * as type_name_25 from './deps/std/type_name.ts';
const $moduleName = '@waterx/account::events';
export const AccountCreated = new MoveStruct({ name: `${$moduleName}::AccountCreated`, fields: {
        owner: bcs.Address,
        account_object_address: bcs.Address,
        alias: bcs.string(),
        index: bcs.u64()
    } });
export const AccountAliasUpdated = new MoveStruct({ name: `${$moduleName}::AccountAliasUpdated`, fields: {
        account_object_address: bcs.Address,
        alias: bcs.string()
    } });
export const DelegateAdded = new MoveStruct({ name: `${$moduleName}::DelegateAdded`, fields: {
        account_object_address: bcs.Address,
        delegate: bcs.Address,
        alias: bcs.string(),
        permissions: bcs.u32(),
        expires_at_ms: bcs.option(bcs.u64())
    } });
export const DelegateRemoved = new MoveStruct({ name: `${$moduleName}::DelegateRemoved`, fields: {
        account_object_address: bcs.Address,
        delegate: bcs.Address
    } });
export const DelegateUpdated = new MoveStruct({ name: `${$moduleName}::DelegateUpdated`, fields: {
        account_object_address: bcs.Address,
        delegate: bcs.Address,
        alias: bcs.string(),
        permissions: bcs.u32(),
        expires_at_ms: bcs.option(bcs.u64())
    } });
export const DelegateProtocolPermissionSet = new MoveStruct({ name: `${$moduleName}::DelegateProtocolPermissionSet`, fields: {
        account_object_address: bcs.Address,
        delegate: bcs.Address,
        protocol: type_name.TypeName,
        permissions: bcs.u32()
    } });
export const DelegateProtocolPermissionUnset = new MoveStruct({ name: `${$moduleName}::DelegateProtocolPermissionUnset`, fields: {
        account_object_address: bcs.Address,
        delegate: bcs.Address,
        protocol: type_name_1.TypeName
    } });
export const ProtocolWhitelisted = new MoveStruct({ name: `${$moduleName}::ProtocolWhitelisted`, fields: {
        protocol: type_name_2.TypeName
    } });
export const ProtocolDelisted = new MoveStruct({ name: `${$moduleName}::ProtocolDelisted`, fields: {
        protocol: type_name_3.TypeName
    } });
export const ProtocolAssetAllowed = new MoveStruct({ name: `${$moduleName}::ProtocolAssetAllowed`, fields: {
        protocol: type_name_4.TypeName,
        asset: type_name_5.TypeName
    } });
export const ProtocolAssetDisallowed = new MoveStruct({ name: `${$moduleName}::ProtocolAssetDisallowed`, fields: {
        protocol: type_name_6.TypeName,
        asset: type_name_7.TypeName
    } });
export const DepositPolicyRegistered = new MoveStruct({ name: `${$moduleName}::DepositPolicyRegistered`, fields: {
        token_type: type_name_8.TypeName,
        policy: type_name_9.TypeName
    } });
export const DepositPolicyUnregistered = new MoveStruct({ name: `${$moduleName}::DepositPolicyUnregistered`, fields: {
        token_type: type_name_10.TypeName,
        policy: type_name_11.TypeName
    } });
export const WithdrawPolicyRegistered = new MoveStruct({ name: `${$moduleName}::WithdrawPolicyRegistered`, fields: {
        token_type: type_name_12.TypeName,
        policy: type_name_13.TypeName
    } });
export const WithdrawPolicyUnregistered = new MoveStruct({ name: `${$moduleName}::WithdrawPolicyUnregistered`, fields: {
        token_type: type_name_14.TypeName,
        policy: type_name_15.TypeName
    } });
export const DepositRequested = new MoveStruct({ name: `${$moduleName}::DepositRequested`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_16.TypeName,
        amount: bcs.u64()
    } });
export const DepositConsumed = new MoveStruct({ name: `${$moduleName}::DepositConsumed`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_17.TypeName,
        policy: type_name_18.TypeName,
        amount: bcs.u64()
    } });
export const WithdrawRequested = new MoveStruct({ name: `${$moduleName}::WithdrawRequested`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_19.TypeName,
        amount: bcs.u64(),
        requested_by: bcs.Address,
        recipient: bcs.Address
    } });
export const WithdrawConsumed = new MoveStruct({ name: `${$moduleName}::WithdrawConsumed`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name_20.TypeName,
        policy: type_name_21.TypeName,
        amount: bcs.u64(),
        recipient: bcs.Address
    } });
export const TakenByProtocol = new MoveStruct({ name: `${$moduleName}::TakenByProtocol`, fields: {
        account_object_address: bcs.Address,
        protocol: type_name_22.TypeName,
        token_type: type_name_23.TypeName,
        amount: bcs.u64()
    } });
export const ReturnedByProtocol = new MoveStruct({ name: `${$moduleName}::ReturnedByProtocol`, fields: {
        account_object_address: bcs.Address,
        protocol: type_name_24.TypeName,
        token_type: type_name_25.TypeName,
        amount: bcs.u64()
    } });
export const ManagerAdded = new MoveStruct({ name: `${$moduleName}::ManagerAdded`, fields: {
        manager: bcs.Address
    } });
export const ManagerRemoved = new MoveStruct({ name: `${$moduleName}::ManagerRemoved`, fields: {
        manager: bcs.Address
    } });
export const Paused = new MoveStruct({ name: `${$moduleName}::Paused`, fields: {
        paused_by: bcs.Address
    } });
export const Unpaused = new MoveStruct({ name: `${$moduleName}::Unpaused`, fields: {
        dummy_field: bcs.bool()
    } });
export const VersionAllowed = new MoveStruct({ name: `${$moduleName}::VersionAllowed`, fields: {
        version: bcs.u16()
    } });
export const VersionDisallowed = new MoveStruct({ name: `${$moduleName}::VersionDisallowed`, fields: {
        version: bcs.u16()
    } });