/**
 * Load repo-root `.env` then `.env.local` into `process.env`.
 *
 * Security / precedence:
 * - Anything already exported in the shell wins (`dotenv` default).
 * - `.env.local` then fills keys that were **not** present in the initial shell snapshot,
 *   so machine-specific secrets override values from `.env` without committing them.
 *
 * Used by Vitest setup files, integration bootstrap, and CLI wrappers (`run-e2e`, `run-integration`).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (directory containing `package.json`). */
export const REPO_ROOT = path.join(__dirname, "..");

export function loadRepoEnvFiles(opts?: { repoRoot?: string }): void {
  const repoRoot = opts?.repoRoot ?? REPO_ROOT;
  /** Snapshot before reading repo files — shell-exported vars always win. */
  const envBeforeFiles: NodeJS.ProcessEnv = { ...process.env };

  dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

  const envLocalPath = path.join(repoRoot, ".env.local");
  if (existsSync(envLocalPath)) {
    const parsedLocal = dotenv.parse(readFileSync(envLocalPath, "utf8"));
    for (const [key, value] of Object.entries(parsedLocal)) {
      if (!Object.hasOwn(envBeforeFiles, key)) {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Read the canonical config URL from `WATERX_CONFIG_URL` at this script (harness)
 * boundary, to pass as the SDK's `waterxConfigUrl` opt. `loadConfig` itself no
 * longer reads env — scripts must supply the URL — so every CLI/smoke script
 * sources it here. Call {@link loadRepoEnvFiles} first so `.env` values are
 * visible. Returns `undefined` when unset (client `create` then throws).
 */
export function waterxConfigUrlFromEnv(): string | undefined {
  const url = process.env.WATERX_CONFIG_URL?.trim();
  return url || undefined;
}
