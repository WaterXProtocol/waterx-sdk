/**************************************************************
 * THIS FILE IS GENERATED AND SHOULD NOT BE MANUALLY MODIFIED *
 **************************************************************/
import { MoveStruct, normalizeMoveArguments, type RawTransactionArgument } from '../utils/index.ts';
import { bcs } from '@mysten/sui/bcs';
import { type Transaction } from '@mysten/sui/transactions';
const $moduleName = '@waterx/wlp::wlp';
export const WLP = new MoveStruct({ name: `${$moduleName}::WLP`, fields: {
        id: bcs.Address
    } });
export interface CreateWlpPoolArguments {
    coinRegistry: RawTransactionArgument<string>;
    adminCap: RawTransactionArgument<string>;
    proof: RawTransactionArgument<string>;
}
export interface CreateWlpPoolOptions {
    package?: string;
    arguments: CreateWlpPoolArguments | [
        coinRegistry: RawTransactionArgument<string>,
        adminCap: RawTransactionArgument<string>,
        proof: RawTransactionArgument<string>
    ];
}
export function createWlpPool(options: CreateWlpPoolOptions) {
    const packageAddress = options.package ?? '@waterx/wlp';
    const argumentsTypes = [
        null,
        null,
        null
    ] satisfies (string | null)[];
    const parameterNames = ["coinRegistry", "adminCap", "proof"];
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wlp',
        function: 'create_wlp_pool',
        arguments: normalizeMoveArguments(options.arguments, argumentsTypes, parameterNames),
    });
}
export interface DecimalsOptions {
    package?: string;
    arguments?: [
    ];
}
export function decimals(options: DecimalsOptions = {}) {
    const packageAddress = options.package ?? '@waterx/wlp';
    return (tx: Transaction) => tx.moveCall({
        package: packageAddress,
        module: 'wlp',
        function: 'decimals',
    });
}