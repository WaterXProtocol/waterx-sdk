/**
 * Vitest **e2e** project setup: load canonical config before simulate tests run.
 */
import { clientInit } from "./e2e-client.ts";

await clientInit;
