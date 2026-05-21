/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Events emitted by `native_custody::custody_vault`. */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as float from './deps/bucket_v2_framework/float.ts';
import * as float_1 from './deps/bucket_v2_framework/float.ts';
const $moduleName = '@waterx/native-custody::events';
export const NewCustodyVault = new MoveStruct({ name: `${$moduleName}::NewCustodyVault<phantom CREDIT>`, fields: {
        vault_id: bcs.Address
    } });
export const AssetAdded = new MoveStruct({ name: `${$moduleName}::AssetAdded<phantom CREDIT, phantom T>`, fields: {
        vault_id: bcs.Address,
        single_vault_id: bcs.Address,
        decimal: bcs.u8(),
        mint_fee_rate: float.Float,
        burn_fee_rate: float_1.Float,
        min_burn_amount: bcs.u64()
    } });
export const Mint = new MoveStruct({ name: `${$moduleName}::Mint<phantom CREDIT, phantom T>`, fields: {
        asset_in_amount: bcs.u64(),
        asset_balance: bcs.u64(),
        credit_out_amount: bcs.u64(),
        asset_credit_backing: bcs.u64(),
        credit_supply: bcs.u64(),
        fee_amount: bcs.u64()
    } });
export const Burn = new MoveStruct({ name: `${$moduleName}::Burn<phantom CREDIT, phantom T>`, fields: {
        credit_in_amount: bcs.u64(),
        asset_credit_backing: bcs.u64(),
        asset_out_amount: bcs.u64(),
        asset_balance: bcs.u64(),
        credit_supply: bcs.u64(),
        fee_amount: bcs.u64()
    } });