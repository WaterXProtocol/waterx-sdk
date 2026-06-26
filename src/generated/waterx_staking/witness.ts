/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Protocol witness for `waterx_staking`.
 *
 * Lives in its own module so the witness type name `WaterXStaking` stays distinct
 * from the vault struct `StakingPool<STAKE>` in `waterx_staking::waterx_staking` —
 * same package, different modules → distinct TypeNames. Used to gate
 * `wxa_account::take<STAKE, _>` / `put<STAKE, _>` and to key delegate per-protocol
 * permissions.
 */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = '@waterx/staking::witness';
export const WaterXStaking = new MoveStruct({ name: `${$moduleName}::WaterXStaking`, fields: {
        dummy_field: bcs.bool()
    } });