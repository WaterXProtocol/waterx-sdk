/**
 * Shared simulate/decode plumbing for the read helpers.
 *
 * Each public read builds a one-shot PTB, runs `client.simulate(tx)` with the
 * zero address as sender, and decodes the command's BCS return values. Typed to
 * the transport base ({@link BaseLineClient}) so any line client satisfies it —
 * this is the **base** copy the perp `fetch/simulate.ts` re-exports, so the
 * plumbing lives once. Internal to `fetch/` — not part of the public surface.
 */

import { fromBase64 } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";

import type { BaseLineClient } from "../../base-client.ts";
import { DRY_RUN_SENDER } from "../../constants.ts";

export interface SimulationCommandResult {
  returnValues?: { bcs?: Uint8Array | string; value?: { bcs?: Uint8Array | string } }[];
}

export interface SimulationResult {
  $kind?: string;
  FailedTransaction?: {
    status?: { error?: { message?: string } };
  };
  commandResults?: SimulationCommandResult[] | null;
}

export function toBytes(b: Uint8Array | string | undefined): Uint8Array | undefined {
  if (!b) return undefined;
  if (typeof b === "string") return fromBase64(b);
  // gRPC returns Uint8Array; JSON-RPC serialization may turn it into a
  // numeric-indexed object. Normalize both.
  if (b instanceof Uint8Array) return b;
  return new Uint8Array(Object.values(b as Record<string, number>));
}

export async function simulateRaw(
  client: BaseLineClient,
  tx: Transaction,
): Promise<SimulationResult> {
  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  if (sim.$kind === "FailedTransaction") {
    const err = sim.FailedTransaction?.status?.error?.message ?? "FailedTransaction";
    throw new Error(`simulate aborted: ${err}`);
  }
  return sim;
}

export function extractAt(
  sim: SimulationResult,
  commandIndex: number,
  returnIndex = 0,
): Uint8Array {
  const ret = sim.commandResults?.[commandIndex]?.returnValues?.[returnIndex];
  const bytes = toBytes(ret?.bcs) ?? toBytes(ret?.value?.bcs);
  if (!bytes) {
    throw new Error(
      `simulate returned no BCS value at commandResults[${commandIndex}].returnValues[${returnIndex}]`,
    );
  }
  return bytes;
}

export async function simulateAndExtract(
  client: BaseLineClient,
  tx: Transaction,
  commandIndex = 0,
  returnIndex = 0,
): Promise<Uint8Array> {
  const sim = await simulateRaw(client, tx);
  return extractAt(sim, commandIndex, returnIndex);
}
