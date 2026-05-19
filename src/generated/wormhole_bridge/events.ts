/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/


/** Events shared across the cross-chain bridge surface. */

import { MoveStruct } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
const $moduleName = '@waterx/wormhole-bridge::events';
export const BridgeInitialized = new MoveStruct({ name: `${$moduleName}::BridgeInitialized`, fields: {
        bridge_id: bcs.Address
    } });
export const Paused = new MoveStruct({ name: `${$moduleName}::Paused`, fields: {
        paused: bcs.bool()
    } });
export const Minted = new MoveStruct({ name: `${$moduleName}::Minted`, fields: {
        recipient: bcs.Address,
        amount: bcs.u64(),
        evm_origin_chain: bcs.u16(),
        evm_nonce: bcs.u64(),
        vaa_hash: bcs.vector(bcs.u8())
    } });
export const WithdrawalInitiated = new MoveStruct({ name: `${$moduleName}::WithdrawalInitiated`, fields: {
        withdrawal_id: bcs.vector(bcs.u8()),
        burner: bcs.Address,
        amount: bcs.u64(),
        evm_recipient: bcs.vector(bcs.u8()),
        evm_destination_chain: bcs.u16(),
        wormhole_sequence: bcs.u64()
    } });