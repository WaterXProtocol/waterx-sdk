/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * This module implements a capability (`EmitterCap`), which allows one to send
 * Wormhole messages. Its external address is determined by the capability's `id`,
 * which is a 32-byte vector.
 */

import { MoveStruct } from '../../../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = 'wormhole_sdk::emitter';
export const EmitterCap = new MoveStruct({ name: `${$moduleName}::EmitterCap`, fields: {
        id: bcs.Address,
        /** Sequence number of the next wormhole message. */
        sequence: bcs.u64()
    } });