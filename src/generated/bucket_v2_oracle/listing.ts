/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Listing module for managing aggregator registrations for different coin types in
 * the BucketV2 Oracle framework
 */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import * as vec_map from './deps/sui/vec_map.ts';
import * as type_name from './deps/std/type_name.ts';
const $moduleName = '@bucket/oracle::listing';
export const ListingCap = new MoveStruct({ name: `${$moduleName}::ListingCap`, fields: {
        id: bcs.Address,
        aggregator_map: vec_map.VecMap(type_name.TypeName, bcs.Address)
    } });