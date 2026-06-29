/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = '@waterx/prediction::admin';
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });