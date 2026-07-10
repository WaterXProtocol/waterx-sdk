/**
 * Vitest **e2e** project setup: load canonical config before simulate tests run.
 *
 * On-chain preflight (keeper slots + wxa WLP) is **not** run here — use `pnpm test:e2e:preflight`
 * locally when you have `WATERX_INTEGRATION_PRIVATE_KEY` (CI does not set a key).
 */
import { clientInit } from "./e2e-client.ts";

await clientInit();
