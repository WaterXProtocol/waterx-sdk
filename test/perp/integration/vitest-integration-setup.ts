/**
 * Vitest **integration-trader** project setup: preload client + oracle USD hints.
 */
import { beforeAll } from "vitest";

import { seedLifecycleApproxPricesForUnitTests } from "../helpers/e2e/lifecycle-oracle-usd-prices.ts";
import { clientInit } from "./setup.ts";

seedLifecycleApproxPricesForUnitTests();

beforeAll(async () => {
  await clientInit();
}, 120_000);
