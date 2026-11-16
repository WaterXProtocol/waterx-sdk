/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Non-cash betting credit. All writes are package-only; prediction entrypoints
 * apply the existing AdminCap, account permissions and keeper authorization.
 */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as table from './deps/sui/table.ts';
const $moduleName = '@waterx/prediction::voucher';
export const LedgerKey = new MoveStruct({ name: `${$moduleName}::LedgerKey`, fields: {
        dummy_field: bcs.bool()
    } });
export const Ledger = new MoveStruct({ name: `${$moduleName}::Ledger`, fields: {
        accounts: table.Table,
        orders: table.Table,
        positions: table.Table,
        paused: bcs.bool(),
        /** Credit granters may still issue on this registry; admin sets it. */
        grant_budget: bcs.u64()
    } });
export const VoucherBalance = new MoveStruct({ name: `${$moduleName}::VoucherBalance`, fields: {
        available: bcs.u64(),
        reserved: bcs.u64()
    } });