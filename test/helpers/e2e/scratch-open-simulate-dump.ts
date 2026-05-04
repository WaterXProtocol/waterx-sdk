/**
 * Opt-in local dumps of successful scratch `buildOpenPositionTx` gRPC simulate payloads.
 * Set `WATERX_E2E_SIMULATE_SUCCESS_DUMP=1`. Writes under `simulate-dumps/scratch-open-success/`
 * (parent dir is gitignored).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DUMP_DIR = path.resolve(__dirname, "..", "..", "simulate-dumps", "scratch-open-success");

function safeJsonStringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );
}

export type ScratchOpenSimulateDumpKind = "approx-oracle" | "explicit-size" | "resize";

export function maybeWriteScratchOpenSimulateDump(args: {
  base: string;
  kind: ScratchOpenSimulateDumpKind;
  result: unknown;
}): void {
  if (process.env.WATERX_E2E_SIMULATE_SUCCESS_DUMP?.trim() !== "1") return;

  const r = args.result as { $kind?: string };
  if (r.$kind !== "Transaction") return;

  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const filePath = path.join(
    DUMP_DIR,
    `${args.base}-${args.kind}-${Date.now()}-${process.pid}.json`,
  );
  try {
    fs.writeFileSync(filePath, `${safeJsonStringify(args.result)}\n`, "utf8");
    console.info(`[WATERX_E2E_SIMULATE_SUCCESS_DUMP] wrote ${filePath}`);
  } catch (e) {
    console.error("[WATERX_E2E_SIMULATE_SUCCESS_DUMP] write failed:", e);
  }
}
