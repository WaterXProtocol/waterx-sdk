/**
 * Vitest **e2e** project setup: load canonical config before simulate tests run.
 *
 * On-chain preflight (keeper slots + wxa WLP) is **not** run here — use `pnpm test:e2e:preflight`
 * locally when you have `WATERX_INTEGRATION_PRIVATE_KEY` (CI does not set a key).
 */
import { clientInit } from "./e2e-client.ts";

/** E2E: fewer Hermes retries → faster `ctx.skip` when beta/prod are down (override via env). */
if (!process.env.WATERX_PYTH_HERMES_MAX_RETRIES?.trim()) {
  process.env.WATERX_PYTH_HERMES_MAX_RETRIES = "4";
}

await clientInit;
