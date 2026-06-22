/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Module for managing Credit and Debt for DeFi protocol usage */

import { MoveStruct } from '../../../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = 'bucket_v2_framework::liability';
export const Credit: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Credit<phantom T>`, fields: {
        value: bcs.u64()
    } });
export const Debt: MoveStruct<any, any> = new MoveStruct({ name: `${$moduleName}::Debt<phantom T>`, fields: {
        value: bcs.u64()
    } });