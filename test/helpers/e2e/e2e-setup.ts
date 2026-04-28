/**
 * Vitest **e2e** project setup: prime oracle USD cache before any test file runs so
 * {@link lifecycleRow} can supply `approxPrice` from on-chain simulate (not table literals).
 */
import { client } from "./e2e-client.ts";
import { primeLifecycleOracleUsdPrices } from "./lifecycle-oracle-usd-prices.ts";

await primeLifecycleOracleUsdPrices(client);
