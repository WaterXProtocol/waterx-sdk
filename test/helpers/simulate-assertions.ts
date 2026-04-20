import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root: test/helpers → ../.. */
const SIMULATE_DUMP_DIR = path.resolve(__dirname, "..", "..", "simulate-dumps");

export type SimulateResult = {
  $kind?: string;
  commandResults?: unknown[];
  Transaction?: Record<string, unknown>;
  FailedTransaction?: {
    digest?: string;
    status?: { error?: { message?: string } | string | unknown };
    effects?: unknown;
    events?: unknown;
    [key: string]: unknown;
  };
};

export function extractSimulateError(result: SimulateResult): string {
  const raw = result.FailedTransaction?.status?.error;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "message" in raw) {
    return String((raw as { message?: unknown }).message ?? raw);
  }
  return JSON.stringify(result.FailedTransaction ?? result);
}

/**
 * Oracle feed/aggregate failures that are external-state dependent on testnet and
 * should not be treated as SDK logic regressions in dry-run suites.
 */
export function isOracleTransientFailureMessage(msg: string): boolean {
  return (
    msg.includes("err_total_weight_not_enough") ||
    msg.includes("::supra_rule::feed") ||
    msg.includes("::pyth_rule::feed")
  );
}

/**
 * When gRPC simulate returns `FailedTransaction` due to testnet oracle flakiness, skip with the
 * **same** message across all `test/simulate` suites (SOL vs other bases — no special casing).
 */
export function skipSimulateIfOracleTransient(
  ctx: { skip: (reason?: string) => void },
  result: unknown,
): boolean {
  const r = result as SimulateResult;
  if (r.$kind !== "FailedTransaction") {
    return false;
  }
  const msg = extractSimulateError(r);
  if (!isOracleTransientFailureMessage(msg)) {
    return false;
  }
  ctx.skip(`Oracle feed/aggregate failed on testnet (transient): ${msg}`);
  return true;
}

/**
 * Pretty-print gRPC simulate / transaction result for debugging (BigInt, Uint8Array, cycles).
 */
export function serializeSimulateResultForDebug(value: unknown, maxDepth = 20): string {
  const seen = new WeakSet<object>();

  function walk(x: unknown, depth: number): unknown {
    if (depth > maxDepth) return "[maxDepth]";
    if (x === null) return null;
    const t = typeof x;
    if (t === "bigint") return `${x}n`;
    if (t === "string" || t === "number" || t === "boolean") return x;
    if (t === "undefined") return null;
    if (t !== "object") return String(x);

    if (x instanceof Uint8Array) {
      return {
        __type: "Uint8Array",
        length: x.length,
        hex: Buffer.from(x).toString("hex"),
      };
    }

    if (Array.isArray(x)) {
      return x.map((item) => walk(item, depth + 1));
    }

    if (seen.has(x as object)) {
      return "[Circular]";
    }
    seen.add(x as object);

    const o = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      try {
        out[k] = walk(o[k], depth + 1);
      } catch {
        out[k] = "[Error serializing field]";
      }
    }
    return out;
  }

  try {
    return JSON.stringify(walk(value, 0), null, 2);
  } catch {
    return String(value);
  }
}

export type SimulateAssertContext = {
  /** When set, full `Transaction.getData()` (entire PTB) is included in the failure dump file. */
  transaction?: { getData(): unknown };
  /**
   * If simulate returns `FailedTransaction` with this MoveAbort, treat as success (no stderr dump).
   * Uses structured metadata from gRPC — prefer this over matching raw error strings.
   */
  allowFailedTransactionMoveAbort?: {
    /** Numeric abort code (e.g. `407` for `waterx_perp::error::err_redeem_not_ready`). */
    abortCode: number;
    /** If set, serialized `MoveAbort.location` must contain this substring. */
    locationIncludes?: string;
  };
};

type ParsedSimulateFailure = {
  message: string;
  commandIndex: number | null;
  abortCode: string | null;
  moveAbortLocation: unknown;
};

/** Pull command index / MoveAbort metadata from gRPC FailedTransaction (not the whole blob). */
export function parseSimulateFailure(result: unknown): ParsedSimulateFailure | null {
  const r = result as SimulateResult;
  if (r.$kind !== "FailedTransaction") return null;

  const err = r.FailedTransaction?.status?.error;
  const message = extractSimulateError(r);
  let commandIndex: number | null = null;
  let abortCode: string | null = null;
  let moveAbortLocation: unknown = null;

  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.command === "number" && Number.isFinite(e.command)) {
      commandIndex = e.command;
    } else if (typeof e.command === "string" && /^\d+$/.test(e.command)) {
      commandIndex = parseInt(e.command, 10);
    }
    const ma = e.MoveAbort;
    if (ma && typeof ma === "object") {
      const m = ma as Record<string, unknown>;
      if (m.abortCode != null) abortCode = String(m.abortCode);
      moveAbortLocation = m.location ?? null;
    }
  }

  return { message, commandIndex, abortCode, moveAbortLocation };
}

/**
 * Writes summary + optional full PTB to `simulate-dumps/simulate-failure-<ms>.txt`.
 * @returns absolute path to the dump file, or null if nothing to write
 */
export function writeSimulateFailureDump(
  result: unknown,
  context?: SimulateAssertContext,
): string | null {
  const meta = parseSimulateFailure(result);
  if (!meta) return null;

  const lines: string[] = ["========== simulate failure (summary) ==========", meta.message];
  if (meta.commandIndex != null) {
    lines.push(`failingCommandIndex (0-based): ${meta.commandIndex}`);
  }
  if (meta.abortCode != null) {
    lines.push(`MoveAbort.abortCode: ${meta.abortCode}`);
  }
  if (meta.moveAbortLocation != null) {
    lines.push("MoveAbort.location:");
    lines.push(serializeSimulateResultForDebug(meta.moveAbortLocation));
  }
  lines.push("========== end simulate failure (summary) ==========");

  if (!context?.transaction) {
    lines.push("");
    lines.push("(no Transaction in assertSimulateSuccess context — PTB body omitted.)");
    lines.push("Pass { transaction: tx } to include full Transaction.getData().");
  } else {
    lines.push("");
    lines.push("========== PTB Transaction.getData() (full) ==========");
    lines.push("");
    try {
      lines.push(serializeSimulateResultForDebug(context.transaction.getData()));
    } catch (e) {
      lines.push(`Transaction.getData() failed: ${String(e)}`);
    }
    lines.push("");
    lines.push("========== end PTB Transaction.getData() ==========");
  }

  fs.mkdirSync(SIMULATE_DUMP_DIR, { recursive: true });
  const filePath = path.join(
    SIMULATE_DUMP_DIR,
    `simulate-failure-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 10)}.txt`,
  );
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

function logFailedSimulateBrief(dumpPath: string | null, metaMessage: string): void {
  console.error("\n[simulate failure]", metaMessage);
  if (dumpPath) {
    console.error("[simulate failure] full diagnostic dump:", dumpPath);
  }
  console.error("");
}

/** Assert gRPC simulate succeeded ($kind Transaction) with enough command results. */
export function assertSimulateSuccess(
  result: unknown,
  minCommands = 1,
  context?: SimulateAssertContext,
): void {
  expect(result).toBeDefined();
  const r = result as SimulateResult;
  if (r.$kind === "FailedTransaction") {
    const allowedAbort = context?.allowFailedTransactionMoveAbort;
    if (allowedAbort) {
      const meta = parseSimulateFailure(result);
      expect(meta, "FailedTransaction should yield parseable MoveAbort metadata").not.toBeNull();
      const parsedCode =
        meta!.abortCode != null && meta!.abortCode !== "" ? Number(meta!.abortCode) : Number.NaN;
      expect(
        parsedCode,
        `expected MoveAbort code ${allowedAbort.abortCode}, got ${meta!.abortCode ?? "(missing)"}`,
      ).toBe(allowedAbort.abortCode);
      if (allowedAbort.locationIncludes != null) {
        const locText = serializeSimulateResultForDebug(meta!.moveAbortLocation ?? null);
        expect(locText, "MoveAbort.location should include expected module/function").toContain(
          allowedAbort.locationIncludes,
        );
      }
      return;
    }
    const errMsg = extractSimulateError(r);
    const dumpPath = writeSimulateFailureDump(result, context);
    logFailedSimulateBrief(dumpPath, errMsg);
    throw new Error(
      `Simulation returned FailedTransaction: ${errMsg}` + (dumpPath ? ` (dump: ${dumpPath})` : ""),
    );
  }
  expect(r.$kind).toBe("Transaction");
  expect(Array.isArray(r.commandResults)).toBe(true);
  expect(r.commandResults!.length).toBeGreaterThanOrEqual(minCommands);
}

/** Assert gRPC simulate failed with a specific `MoveAbort` (negative / error-path tests). */
export function assertSimulateMoveAbort(
  result: unknown,
  expected: { abortCode: number; locationIncludes?: string },
): void {
  expect(result).toBeDefined();
  const r = result as SimulateResult;
  expect(r.$kind, `expected FailedTransaction, got ${String(r.$kind)}`).toBe("FailedTransaction");
  const meta = parseSimulateFailure(result);
  expect(meta, "FailedTransaction should yield parseable MoveAbort metadata").not.toBeNull();
  const parsed =
    meta!.abortCode != null && meta!.abortCode !== "" ? Number(meta!.abortCode) : Number.NaN;
  expect(
    Number.isFinite(parsed),
    `expected numeric MoveAbort code, got ${meta!.abortCode ?? "(missing)"}; message=${meta!.message}`,
  ).toBe(true);
  expect(parsed, meta!.message).toBe(expected.abortCode);
  if (expected.locationIncludes != null) {
    const locText = serializeSimulateResultForDebug(meta!.moveAbortLocation ?? null);
    expect(locText, "MoveAbort.location should include expected substring").toContain(
      expected.locationIncludes,
    );
  }
}
