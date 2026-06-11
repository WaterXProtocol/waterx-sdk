/**
 * Load package-local `.env` then `.env.local` (shell-exported vars always win).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = join(__dirname, "..");

export function loadPackageEnv(): void {
  const envBeforeFiles: NodeJS.ProcessEnv = { ...process.env };
  dotenv.config({ path: join(PACKAGE_ROOT, ".env"), quiet: true });

  const localPath = join(PACKAGE_ROOT, ".env.local");
  if (existsSync(localPath)) {
    const parsed = dotenv.parse(readFileSync(localPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (!Object.hasOwn(envBeforeFiles, key)) {
        process.env[key] = value;
      }
    }
  }
}
