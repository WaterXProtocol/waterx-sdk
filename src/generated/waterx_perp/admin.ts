/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/**
 * Admin capability for the WaterX Perp protocol. A single AdminCap is minted at
 * deployment and gates all privileged operations across market, lp_pool, referral,
 * and other modules.
 */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@waterx/perp::admin';
export const AdminCap = new MoveStruct({ name: `${$moduleName}::AdminCap`, fields: {
        id: bcs.Address
    } });
export interface InitOptions {
    package?: string;
    arguments?: [
    ];
}
export function init(options: InitOptions = {}) {
    const packageAddress = options.package ?? '@waterx/perp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'admin',
        function: 'init',
    });
}