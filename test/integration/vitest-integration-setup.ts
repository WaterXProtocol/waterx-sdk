/**
 * Vitest **integration-trader** project setup: seed `lifecycleRow` `approxPrice` without RPC.
 *
 * Do **not** call {@link primeLifecycleOracleUsdPrices} here: this project runs multiple workers by
 * default; each would batch-simulate all lifecycle bases and races public gRPC → 429. Integration
 * scratch sizing uses on-chain resize; static fallbacks are enough for USD hints in helpers.
 */
import { seedLifecycleApproxPricesForUnitTests } from "../helpers/e2e/lifecycle-oracle-usd-prices.ts";

seedLifecycleApproxPricesForUnitTests();
