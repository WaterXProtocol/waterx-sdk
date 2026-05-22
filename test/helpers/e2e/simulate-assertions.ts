import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

import {
  isInfrastructureTransientError,
  isOracleTransientFailureMessage,
  isTransientRpcErrorMessage,
} from "./transient-rpc.ts";

export { isOracleTransientFailureMessage };

export { isTransientRpcErrorMessage };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Failure dumps for CI debugging (repo root / `simulate-dumps`). */
const SIMULATE_DUMP_DIR = path.resolve(__dirname, "..", "..", "simulate-dumps");

export type SimulateResult = {
  /** gRPC returns `"Transaction"` on dry-run success; some mocks use `"Success"`. */
  $kind?: "Success" | "Transaction" | "FailedTransaction" | string;
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

/** Whether {@link WaterXClient.simulate} returned a normal outcome object (not a thrown RPC error). */
export function isSimulateOutcome(sim: unknown): boolean {
  const k = (sim as SimulateResult).$kind;
  return k === "Transaction" || k === "FailedTransaction" || k === "Success";
}

/**
 * When gRPC simulate returns `FailedTransaction` due to oracle flakiness
 * (Pyth/Supra feed/aggregate transient), skip with a **uniform** message
 * across all `test/simulate` suites (so CI diff noise is minimal and both
 * networks look the same).
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
  ctx.skip(`Oracle feed/aggregate failed (transient): ${msg}`);
  return true;
}

/**
 * When {@link refreshOraclePrices} fails before dry-run — Hermes gateway / feed infra, not SDK logic.
 * Covers **404** feed mismatch, **5xx** bursts (503/521), and HTML error pages from Cloudflare.
 */
export function skipHermesIfFeedUnavailable(
  ctx: { skip: (reason?: string) => void },
  error: unknown,
): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (!msg.includes("Hermes price fetch failed")) return false;

  const firstLine = msg.split("\n")[0] ?? msg;
  const statusMatch = /Hermes price fetch failed: (\d{3})/.exec(firstLine);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (msg.includes("Price ids not found") || status === 404) {
    ctx.skip(`Hermes feed / gateway mismatch: ${firstLine}`);
    return true;
  }
  if (status != null && (status === 429 || status >= 500)) {
    ctx.skip(`Hermes gateway unavailable: ${firstLine}`);
    return true;
  }
  if (msg.includes("Web server is down") || msg.includes("cloudflare.com")) {
    ctx.skip(`Hermes gateway unavailable: ${firstLine}`);
    return true;
  }
  return false;
}

/**
 * When gRPC / network fails after retries (e.g. **`RpcError: fetch failed`** on public endpoints),
 * treat as infra flake — same tier as oracle transient skips.
 */
export function skipIfTransientInfrastructureError(
  ctx: { skip: (reason?: string) => void },
  error: unknown,
): boolean {
  if (!isInfrastructureTransientError(error)) return false;
  const msg = error instanceof Error ? error.message : String(error);
  ctx.skip(`Transient RPC/network failure: ${msg.split("\n")[0]}`);
  return true;
}

/**
 * Retry an async step (builder, Hermes, gRPC simulate) on transient infra errors.
 */
export async function withInfrastructureRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; backoffMs?: number } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 5);
  const baseBackoff = opts.backoffMs ?? 600;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (!isInfrastructureTransientError(e)) throw e;
      if (i < attempts - 1) {
        const jitter = Math.floor(Math.random() * 300);
        await new Promise((r) => setTimeout(r, baseBackoff * (i + 1) + jitter));
      }
    }
  }
  throw last;
}

/** Whether a simulate result is a FailedTransaction whose MoveAbort matches a transient oracle pattern. */
export function isSimulateOracleTransient(result: unknown): boolean {
  const r = result as SimulateResult;
  if (r.$kind !== "FailedTransaction") return false;
  return isOracleTransientFailureMessage(extractSimulateError(r));
}

/**
 * Run `simulate()` with a small retry budget for two kinds of transient
 * failures that commonly appear under parallel e2e load:
 *
 * 1. `FailedTransaction` matching {@link isOracleTransientFailureMessage} (feed paths) —
 *    retried once more after backoff.
 * 2. Thrown gRPC/HTTP errors such as `Too Many Requests` / `RESOURCE_EXHAUSTED`
 *    / `Deadline Exceeded` — public RPC rate limit.
 *
 * Non-transient results and non-transient thrown errors surface immediately so
 * callers still observe deterministic MoveAbort / assertion failures.
 */
export async function simulateWithTransientRetry(
  simulateOnce: () => Promise<unknown>,
  opts: { attempts?: number; backoffMs?: number } = {},
): Promise<unknown> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseBackoff = opts.backoffMs ?? 500;
  let last: unknown = null;
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      last = await simulateOnce();
      lastError = null;
      if (!isSimulateOracleTransient(last)) return last;
    } catch (e) {
      lastError = e;
      if (!isInfrastructureTransientError(e)) throw e;
    }
    if (i < attempts - 1) {
      // Exponential-ish backoff + jitter so parallel forks don't resync retries.
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, baseBackoff * (i + 1) + jitter));
    }
  }
  if (lastError) throw lastError;
  return last;
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

/**
 * Known MoveAbort codes we treat as "shared-chain state-dependent" in positive
 * discovery-based simulate tests (returning a skip reason instead of failing):
 *
 * - `104` err_exceed_max_leverage — discovered position already near max leverage
 * - `201` err_invalid_size — v2 dust / fixed scratch size below `min_size()` vs live oracle, or partial decrease
 * - `202` err_insufficient_collateral — fixed scratch collateral too small vs mainnet price
 * - `207` err_position_flip_not_supported — decrease size > discovered position size
 * - `208` err_invalid_collateral_type — discovered position uses non-USDC collateral
 */
const STATE_DEPENDENT_ABORT_CODES: ReadonlySet<string> = new Set([
  "104",
  "201",
  "202",
  "207",
  "208",
]);

const STATE_DEPENDENT_ABORT_LOCATIONS: readonly string[] = [
  "err_exceed_max_leverage",
  "err_invalid_size",
  "err_insufficient_collateral",
  "err_position_flip_not_supported",
  "err_invalid_collateral_type",
];

/**
 * Inspect a simulate result without triggering dump / stderr side effects.
 * Returns a skip reason if the result is a FailedTransaction whose MoveAbort
 * matches a known shared-chain state-dependent pattern; otherwise null.
 *
 * Use this before `assertSimulateSuccess` in positive discovery flows to keep
 * terminal output clean when we already plan to `ctx.skip` the case.
 */
export function stateDependentSimulateSkipReason(result: unknown): string | null {
  const r = result as SimulateResult;
  if (r.$kind !== "FailedTransaction") return null;

  const meta = parseSimulateFailure(result);
  if (!meta) return null;

  const code = meta.abortCode ?? "";
  if (STATE_DEPENDENT_ABORT_CODES.has(code)) {
    return `state-dependent abort ${code}: ${meta.message.split("\n")[0] ?? meta.message}`;
  }

  const locText = serializeSimulateResultForDebug(meta.moveAbortLocation ?? null);
  if (STATE_DEPENDENT_ABORT_LOCATIONS.some((l) => locText.includes(l))) {
    return `state-dependent location ${locText}: ${meta.message.split("\n")[0] ?? meta.message}`;
  }

  return null;
}

/**
 * If the simulate result is a shared-chain state-dependent FailedTransaction
 * (see {@link stateDependentSimulateSkipReason}), call `ctx.skip(reason)` and
 * return `true`. Caller should early-return when this returns true.
 */
export function skipSimulateIfStateDependent(
  ctx: { skip: (reason?: string) => void },
  result: unknown,
  labelPrefix?: string,
): boolean {
  const reason = stateDependentSimulateSkipReason(result);
  if (reason == null) return false;
  ctx.skip(labelPrefix ? `${labelPrefix}: ${reason}` : reason);
  return true;
}

/**
 * `assertSimulateSuccess` after optional oracle + shared-chain skips — common in
 * collateral PTB dry-runs when state may legitimately fail (104/…) on mainnet.
 */
export function assertSimulateSuccessOrSkipOracleAndState(
  ctx: { skip: (reason?: string) => void },
  result: unknown,
  minCommands: number,
  tx: { getData(): unknown },
  opts: { allowStateDependentSkip?: boolean; stateDependentLabel?: string } = {},
): void {
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  if (
    opts.allowStateDependentSkip &&
    skipSimulateIfStateDependent(ctx, result, opts.stateDependentLabel ?? "")
  ) {
    return;
  }
  assertSimulateSuccess(result, minCommands, { transaction: tx });
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

/** Alias for {@link assertSimulateMoveAbort} (e2e discovery matrix naming). */
export function assertSimulateAbortMatches(
  result: unknown,
  expected: { abortCode: number; locationIncludes?: string },
): void {
  assertSimulateMoveAbort(result, expected);
}

/**
 * Negative-path simulate: require `FailedTransaction` without pinning a numeric abort code
 * (stable across contract tweaks). Optional loose message substrings when helpful.
 */
export function assertSimulateFailed(
  result: unknown,
  opts?: { messageIncludes?: readonly string[] },
): void {
  expect(result).toBeDefined();
  const r = result as SimulateResult;
  expect(
    r.$kind,
    r.$kind === "Transaction"
      ? "expected simulate to fail, but transaction succeeded"
      : `expected FailedTransaction, got ${String(r.$kind)}`,
  ).toBe("FailedTransaction");
  if (opts?.messageIncludes?.length) {
    const msg = extractSimulateError(r);
    const hit = opts.messageIncludes.some((s) => msg.includes(s));
    expect(
      hit,
      `simulate error should mention one of [${opts.messageIncludes.join(", ")}]: ${msg}`,
    ).toBe(true);
  }
}

/** Run simulate with infra retry; skip on transient RPC/oracle flakes. Returns `undefined` when skipped. */
export async function simulateForTestOrSkip(
  ctx: { skip: (reason?: string) => void },
  simulateOnce: () => Promise<unknown>,
): Promise<unknown | undefined> {
  try {
    const sim = await simulateWithTransientRetry(simulateOnce);
    if (skipSimulateIfOracleTransient(ctx, sim)) return undefined;
    return sim;
  } catch (e) {
    if (skipIfTransientInfrastructureError(ctx, e)) return undefined;
    throw e;
  }
}
