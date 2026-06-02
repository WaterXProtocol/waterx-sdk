import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/** Optional local `.env` for integration only (`SUI_PRIVATE_KEY`). Not used in CI e2e. */
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath, quiet: true });
}
