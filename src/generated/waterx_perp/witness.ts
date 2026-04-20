/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Package witness for WaterX Perp protocol. Used internally for request/response
 * pattern validation.
 */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@waterx/perp::witness';
export const WaterXPerp = new MoveStruct({ name: `${$moduleName}::WaterXPerp`, fields: {
        dummy_field: bcs.bool()
    } });
export interface WitnessOptions {
    package?: string;
    arguments?: [
    ];
}
export function witness(options: WitnessOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'witness',
        function: 'witness',
    });
}