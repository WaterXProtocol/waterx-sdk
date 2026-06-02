import type { Transaction } from "@mysten/sui/transactions";
import { expect } from "vitest";

export interface MoveCallSummary {
  package: string;
  module: string;
  function: string;
  typeArguments: string[];
  argumentKinds: string[];
}

/** Stable summaries of MoveCall commands for snapshots / assertions (via Transaction#getData). */
export function listMoveCalls(tx: Transaction): MoveCallSummary[] {
  const data = tx.getData() as {
    commands: unknown[];
  };

  const out: MoveCallSummary[] = [];
  for (const cmd of data.commands) {
    if (!cmd || typeof cmd !== "object") continue;
    const record = cmd as Record<string, unknown>;
    if (record.$kind !== "MoveCall") continue;
    const m = record.MoveCall as {
      package: string;
      module: string;
      function: string;
      typeArguments: string[];
      arguments: Array<{ $kind: string }>;
    };
    out.push({
      package: m.package,
      module: m.module,
      function: m.function,
      typeArguments: m.typeArguments,
      argumentKinds: m.arguments.map((a) => a.$kind),
    });
  }
  return out;
}

export function assertLastMoveCall(
  tx: Transaction,
  partial: Pick<MoveCallSummary, "module" | "function"> & Partial<MoveCallSummary>,
): void {
  const calls = listMoveCalls(tx);
  const last = calls.at(-1);
  if (!last) throw new Error("Expected at least one MoveCall");
  if (partial.package !== undefined && last.package !== partial.package) {
    throw new Error(`package: expected ${partial.package}, got ${last.package}`);
  }
  if (last.module !== partial.module) {
    throw new Error(`module: expected ${partial.module}, got ${last.module}`);
  }
  if (last.function !== partial.function) {
    throw new Error(`function: expected ${partial.function}, got ${last.function}`);
  }
  if (partial.typeArguments !== undefined) {
    expect(last.typeArguments).toEqual(partial.typeArguments);
  }
}
