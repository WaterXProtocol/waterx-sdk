import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/** Optional repo-root env for integration (`SUI_PRIVATE_KEY` / keeper keys). */
for (const name of [".env", ".env.local"]) {
  const envPath = resolve(process.cwd(), name);
  if (existsSync(envPath)) {
    config({ path: envPath, quiet: true });
  }
}
