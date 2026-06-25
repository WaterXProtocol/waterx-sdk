/**
 * Bridge reads: `wormhole_bridge` rate-limit / cap snapshot and the
 * `withdrawal_queue` (Sui → EVM) fee estimate.
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  bridgeFeeAmount as bridgeFeeAmountCall,
  bridgeFeeRate as bridgeFeeRateCall,
  bridgeMinFee as bridgeMinFeeCall,
  wouldExecuteWormhole as wouldExecuteWormholeCall,
} from "../../generated/withdrawal_queue/withdrawal_queue.ts";
import {
  dailyBurned as dailyBurnedCall,
  dailyBurnLimit as dailyBurnLimitCall,
  dailyMinted as dailyMintedCall,
  dailyMintLimit as dailyMintLimitCall,
  maxBurnPerTx as maxBurnPerTxCall,
  maxMintPerTx as maxMintPerTxCall,
  mintedFor as mintedForCall,
  paused as pausedCall,
  personalBurnCapAmount as personalBurnCapAmountCall,
  personalBurned as personalBurnedCall,
} from "../../generated/wormhole_bridge/wormhole_bridge.ts";
import type { PerpClient } from "../client.ts";
import { extractAt, simulateRaw } from "./simulate.ts";

// ============================================================================
// Wormhole bridge (rate-limit / cap reads)
// ============================================================================

/**
 * Live rate-limit / cap snapshot read from the `wormhole_bridge::Bridge`
 * shared object. All amounts are raw base units of the bridged credit coin.
 *
 * `dailyMinted` / `dailyBurned` are the sliding-window sums as the on-chain
 * `daily_minted` / `daily_burned` views report them — buckets that rotated
 * out of the trailing window are evicted lazily on the next mint/burn, so
 * these can read slightly high until then (conservative).
 */
export interface BridgeLimitsView {
  paused: boolean;
  dailyMintLimit: bigint;
  dailyMinted: bigint;
  maxMintPerTx: bigint;
  dailyBurnLimit: bigint;
  dailyBurned: bigint;
  maxBurnPerTx: bigint;
  /** Per-account 24h burn cap; 0n means the gate is disabled. */
  personalBurnCapAmount: bigint;
  /** Present only when `accountId` is supplied — burn counted in that
   *  account's current window (the per-account cap key is the account id). */
  personalBurned?: bigint;
  /** Present only when `backing` is supplied — `minted_for(chainId, token)`,
   *  the amount currently withdrawable to that EVM (chain, token). */
  backingMinted?: bigint;
}

export interface BridgeLimitsArgs {
  /** wxa trading account id — enables the per-account `personalBurned` read. */
  accountId?: string;
  /** Wormhole destination chain id + 20-byte EVM token — enables the
   *  `mintedFor` backing read. */
  backing?: { wormholeChainId: number; token: Uint8Array | number[] };
}

/**
 * Batched read of the bridge's rate-limit / cap state in a single simulate.
 * Pass `accountId` to also fetch the per-account burn usage, and `backing`
 * to also fetch the destination-chain backing (`minted_for`).
 *
 * Throws if `wormhole_bridge` (or its `Bridge` object id) is absent from the
 * canonical config — e.g. on a network where the Sui bridge isn't published.
 */
export async function getBridgeLimits(
  client: PerpClient,
  args: BridgeLimitsArgs = {},
): Promise<BridgeLimitsView> {
  const pkg = client.config.packages.wormhole_bridge;
  if (!pkg?.bridge) {
    throw new Error(
      "wormhole_bridge is not deployed on this network (no `bridge` object id in config)",
    );
  }
  const packageId = pkg.published_at;
  const bridge = pkg.bridge;

  const tx = new Transaction();
  // Fixed-order view calls; indices tracked below.
  pausedCall({ package: packageId, arguments: { bridge } })(tx); // 0
  dailyMintLimitCall({ package: packageId, arguments: { bridge } })(tx); // 1
  dailyMintedCall({ package: packageId, arguments: { bridge } })(tx); // 2
  maxMintPerTxCall({ package: packageId, arguments: { bridge } })(tx); // 3
  dailyBurnLimitCall({ package: packageId, arguments: { bridge } })(tx); // 4
  dailyBurnedCall({ package: packageId, arguments: { bridge } })(tx); // 5
  maxBurnPerTxCall({ package: packageId, arguments: { bridge } })(tx); // 6
  personalBurnCapAmountCall({ package: packageId, arguments: { bridge } })(tx); // 7

  let backingIdx = -1;
  if (args.backing) {
    backingIdx = 8;
    mintedForCall({
      package: packageId,
      arguments: {
        bridge,
        chainId: args.backing.wormholeChainId,
        token: Array.from(args.backing.token),
      },
    })(tx);
  }

  let personalIdx = -1;
  if (args.accountId) {
    personalIdx = backingIdx === -1 ? 8 : 9;
    // Clock (0x6) is auto-injected by the generated wrapper.
    personalBurnedCall({
      package: packageId,
      arguments: { bridge, user: args.accountId },
    })(tx);
  }

  const sim = await simulateRaw(client, tx);
  const u64At = (i: number): bigint => BigInt(bcs.u64().parse(extractAt(sim, i)));

  const view: BridgeLimitsView = {
    paused: bcs.bool().parse(extractAt(sim, 0)),
    dailyMintLimit: u64At(1),
    dailyMinted: u64At(2),
    maxMintPerTx: u64At(3),
    dailyBurnLimit: u64At(4),
    dailyBurned: u64At(5),
    maxBurnPerTx: u64At(6),
    personalBurnCapAmount: u64At(7),
  };
  if (backingIdx >= 0) view.backingMinted = u64At(backingIdx);
  if (personalIdx >= 0) view.personalBurned = u64At(personalIdx);
  return view;
}

// ============================================================================
// Withdrawal queue — bridge fee estimate (withdrawal_queue v4)
// ============================================================================

export interface BridgeFeeView {
  /** Raw fee charged on a wormhole (Sui → EVM) exit of `amount`:
   *  `max(ceil(effectiveRate * amount), effectiveMinFee)`. */
  feeAmount: bigint;
  /** Whether the exit clears the on-chain net-zero guard — i.e. a strictly
   *  positive amount remains after the fee. Gate "estimated fee" UI on THIS,
   *  not `feeAmount` alone: a dust `amount`, or a min-fee floor ≥ `amount`,
   *  makes `feeAmount >= amount` and the exit would abort (audit L1). */
  wouldExecute: boolean;
  /** Effective % rate for the chain (per-chain override → default → 0),
   *  1e9-scaled (the `Float`-as-`u128` ABI convention). */
  effectiveRate: bigint;
  /** Effective minimum-fee floor for the chain (override → default → 0),
   *  in CREDIT base units. */
  effectiveMinFee: bigint;
  /** Net CREDIT the recipient receives after the fee; `0n` when the exit
   *  wouldn't execute (`wouldExecute === false`). */
  netAmount: bigint;
}

function requireWithdrawalQueue(client: PerpClient): { pkg: string; queue: string } {
  const wq = client.config.packages.withdrawal_queue;
  if (!wq?.queue) {
    throw new Error(
      "withdrawal_queue is not deployed on this network (no `queue` object id in config)",
    );
  }
  return { pkg: wq.published_at, queue: wq.queue };
}

/**
 * Estimate the bridge fee for a wormhole (Sui → EVM) CREDIT exit of `amount`
 * to `evmDestinationChain`, read in a single simulate from the on-chain
 * `withdrawal_queue` views. The charged fee is
 * `max(ceil(effectiveRate * amount), effectiveMinFee)`.
 *
 * Surface UI off `wouldExecute`, NOT `feeAmount` alone — `feeAmount` is the raw
 * fee and can equal/exceed `amount` (ceil rounding on a dust entry, or a min-fee
 * floor larger than the entry), in which case the on-chain exit aborts its
 * net-zero guard (audit L1). `netAmount` is `0n` whenever `wouldExecute` is
 * false.
 *
 * @param args.amount             CREDIT base units (the bridged coin's smallest unit).
 * @param args.evmDestinationChain WORMHOLE chain id of the destination EVM.
 * @param args.creditType         CREDIT coin type; defaults to `client.creditType()`.
 */
export async function getBridgeFee(
  client: PerpClient,
  args: { evmDestinationChain: number; amount: bigint | number; creditType?: string },
): Promise<BridgeFeeView> {
  const { pkg, queue } = requireWithdrawalQueue(client);
  const amount = BigInt(args.amount);
  const common = {
    package: pkg,
    typeArguments: [args.creditType ?? client.creditType()] as [string],
  };
  const chain = args.evmDestinationChain;

  const tx = new Transaction();
  // Fixed-order view calls; indices tracked below.
  bridgeFeeAmountCall({
    ...common,
    arguments: { queue, evmDestinationChain: chain, amount },
  })(tx); // 0
  wouldExecuteWormholeCall({
    ...common,
    arguments: { queue, evmDestinationChain: chain, amount },
  })(tx); // 1
  bridgeFeeRateCall({ ...common, arguments: { queue, evmDestinationChain: chain } })(tx); // 2
  bridgeMinFeeCall({ ...common, arguments: { queue, evmDestinationChain: chain } })(tx); // 3

  const sim = await simulateRaw(client, tx);
  const feeAmount = BigInt(bcs.u64().parse(extractAt(sim, 0)));
  const wouldExecute = bcs.bool().parse(extractAt(sim, 1));

  return {
    feeAmount,
    wouldExecute,
    effectiveRate: BigInt(bcs.u128().parse(extractAt(sim, 2))),
    effectiveMinFee: BigInt(bcs.u64().parse(extractAt(sim, 3))),
    netAmount: wouldExecute ? amount - feeAmount : 0n,
  };
}
