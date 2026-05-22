/**
 * E2E: Hermes + Pyth accumulator + per-ticker oracle aggregate (no trading).
 */
import { Transaction } from "@mysten/sui/transactions";
import { refreshOraclePrices } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  isSimulateOutcome,
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
      await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"]);
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
    expect(isSimulateOutcome(sim)).toBe(true);
  }, 180_000);
});
