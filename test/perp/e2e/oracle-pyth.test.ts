/**
 * E2E: Hermes + Pyth accumulator + per-ticker oracle aggregate (no trading).
 */
import { Transaction } from "@mysten/sui/transactions";
import { refreshOraclePrices } from "@waterx/sdk";
import { describe, it } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateSuccess,
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipIfTransientInfrastructureError,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

describe(`oracle Pyth refresh (${e2eNetwork})`, () => {
  it("refreshes BTC + USDC pool tickers in one simulate PTB", async (ctx) => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(1_200_000_000);
    try {
      // Standalone oracle-refresh e2e probe (no trading), no TradingRequest
      // to reimburse a sponsor fund against — pay the Pyth update fee from
      // tx.gas.
      await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"], { allowGasFee: true });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    assertSimulateSuccess(sim, 1);
  }, 180_000);
});
