import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/**
 * Load repo-root env for seed + local integration. Reads `.env` then `.env.local`
 * (the latter overrides, matching the perp side's `.env.local` convention).
 */
export function loadDotenv(): void {
  for (const name of [".env", ".env.local"]) {
    const envPath = resolve(process.cwd(), name);
    if (existsSync(envPath)) {
      config({ path: envPath, override: true, quiet: true });
    }
  }
}
