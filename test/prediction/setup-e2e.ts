import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/** Optional local `.env` for E2E fixture pins (`E2E_ACCOUNT_ID`, `E2E_ACCOUNT_OWNER`, etc.). */
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath, quiet: true });
}
