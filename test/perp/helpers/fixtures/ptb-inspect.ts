/**
 * Shared PTB-inspection helpers for unit tests that assert on a built
 * `Transaction`'s MoveCall commands (target module::function, in order).
 */

import type { Transaction } from "@mysten/sui/transactions";

export type MoveCallCommand = {
  package: string;
  module: string;
  function: string;
  arguments: { $kind: string; Input?: number; Result?: number; NestedResult?: [number, number] }[];
};

/** All MoveCall commands of a built PTB, in order. */
export function moveCalls(tx: Transaction): MoveCallCommand[] {
  const out: MoveCallCommand[] = [];
  for (const c of tx.getData().commands ?? []) {
    if (c.$kind === "MoveCall" && c.MoveCall) out.push(c.MoveCall as MoveCallCommand);
  }
  return out;
}

/** `module::function` for every MoveCall command in a built PTB. */
export function moveTargets(tx: Transaction): string[] {
  return moveCalls(tx).map((c) => `${c.module}::${c.function}`);
}
