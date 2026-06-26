/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * This module implements a custom type that resembles the set data structure.
 * `Set` leverages `sui::table` to store unique keys of the same type.
 *
 * NOTE: Items added to this data structure cannot be removed.
 */

import { MoveStruct } from '../../../utils/index.ts';
import * as table from '../sui/table.ts';
const $moduleName = 'wormhole_sdk::set';
export const Set = new MoveStruct({ name: `${$moduleName}::Set<phantom T>`, fields: {
        items: table.Table
    } });