/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as type_name from './deps/std/type_name.ts';
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
        protocol: type_name.TypeName
    } });
export const ProtocolWhitelisted = new MoveStruct({ name: `${$moduleName}::ProtocolWhitelisted`, fields: {
        protocol: type_name.TypeName
    } });
export const ProtocolDelisted = new MoveStruct({ name: `${$moduleName}::ProtocolDelisted`, fields: {
        protocol: type_name.TypeName
    } });
export const ProtocolPaused = new MoveStruct({ name: `${$moduleName}::ProtocolPaused`, fields: {
        protocol: type_name.TypeName
    } });
export const ProtocolUnpaused = new MoveStruct({ name: `${$moduleName}::ProtocolUnpaused`, fields: {
        protocol: type_name.TypeName
    } });
export const ProtocolAssetAllowed = new MoveStruct({ name: `${$moduleName}::ProtocolAssetAllowed`, fields: {
        protocol: type_name.TypeName,
        asset: type_name.TypeName
    } });
export const ProtocolAssetDisallowed = new MoveStruct({ name: `${$moduleName}::ProtocolAssetDisallowed`, fields: {
        protocol: type_name.TypeName,
        asset: type_name.TypeName
    } });
export const DepositPolicyRegistered = new MoveStruct({ name: `${$moduleName}::DepositPolicyRegistered`, fields: {
        token_type: type_name.TypeName,
        policy: type_name.TypeName
    } });
export const DepositPolicyUnregistered = new MoveStruct({ name: `${$moduleName}::DepositPolicyUnregistered`, fields: {
        token_type: type_name.TypeName,
        policy: type_name.TypeName
    } });
export const WithdrawPolicyRegistered = new MoveStruct({ name: `${$moduleName}::WithdrawPolicyRegistered`, fields: {
        token_type: type_name.TypeName,
        policy: type_name.TypeName
    } });
export const WithdrawPolicyUnregistered = new MoveStruct({ name: `${$moduleName}::WithdrawPolicyUnregistered`, fields: {
        token_type: type_name.TypeName,
        policy: type_name.TypeName
    } });
export const DepositRequested = new MoveStruct({ name: `${$moduleName}::DepositRequested`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name.TypeName,
        amount: bcs.u64()
    } });
export const DepositConsumed = new MoveStruct({ name: `${$moduleName}::DepositConsumed`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name.TypeName,
        policy: type_name.TypeName,
        amount: bcs.u64()
    } });
export const WithdrawRequested = new MoveStruct({ name: `${$moduleName}::WithdrawRequested`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name.TypeName,
        amount: bcs.u64(),
        requested_by: bcs.Address,
        recipient: bcs.Address
    } });
export const WithdrawConsumed = new MoveStruct({ name: `${$moduleName}::WithdrawConsumed`, fields: {
        account_object_address: bcs.Address,
        token_type: type_name.TypeName,
        policy: type_name.TypeName,
        amount: bcs.u64(),
        recipient: bcs.Address
    } });
export const TakenByProtocol = new MoveStruct({ name: `${$moduleName}::TakenByProtocol`, fields: {
        account_object_address: bcs.Address,
        protocol: type_name.TypeName,
        token_type: type_name.TypeName,
        amount: bcs.u64()
    } });
export const ReturnedByProtocol = new MoveStruct({ name: `${$moduleName}::ReturnedByProtocol`, fields: {
        account_object_address: bcs.Address,
        protocol: type_name.TypeName,
        token_type: type_name.TypeName,
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