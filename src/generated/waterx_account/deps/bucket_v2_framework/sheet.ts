/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Module for the record of Credit and Debt of certain entity */

import { MoveTuple, MoveStruct } from '../../../utils/index.ts';
import * as type_name from '../std/type_name.ts';
import * as vec_map from '../sui/vec_map.ts';
import * as liability from './liability.ts';
import * as vec_map_1 from '../sui/vec_map.ts';
import * as liability_1 from './liability.ts';
import * as vec_set from '../sui/vec_set.ts';
const $moduleName = 'bucket_v2_framework::sheet';
export const Entity = new MoveTuple({ name: `${$moduleName}::Entity`, fields: [type_name.TypeName] });
export const Sheet = new MoveStruct({ name: `${$moduleName}::Sheet<phantom CoinType, phantom SelfEntity>`, fields: {
        credits: vec_map.VecMap(Entity, liability.Credit),
        debts: vec_map_1.VecMap(Entity, liability_1.Debt),
        blacklist: vec_set.VecSet(Entity)
    } });