/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct } from '../../../utils/index.ts';
import * as set from './set.ts';
const $moduleName = 'wormhole_sdk::consumed_vaas';
export const ConsumedVAAs = new MoveStruct({ name: `${$moduleName}::ConsumedVAAs`, fields: {
        hashes: set.Set
    } });