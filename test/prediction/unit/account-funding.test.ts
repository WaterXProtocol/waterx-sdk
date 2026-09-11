import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import type { WaterXConfig } from "../../../src/config.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";
import { appendPsmDeposit, psmConfigReady } from "../helpers/account-funding.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";

/**
 * A prediction-only deployment: `packages` is an open record and
 * `native_custody` sits in the PERP line's asserted set, so `PredictClient`
 * builds happily without it — the exact config shape the PSM readiness check
 * used to misjudge.
 */
function predictionOnlyConfig(): WaterXConfig {
  const config = structuredClone(MOCK_TESTNET_CONFIG);
  delete (config.packages as Record<string, unknown>).native_custody;
  return config;
}

describe("PSM readiness vs a prediction-only deployment", () => {
  it("psmConfigReady is false without the native_custody package, even with MOCK_USDC registered", () => {
    const client = createMockPredictClient(predictionOnlyConfig());
    // The vault objects and the MOCK_USDC asset are schema-required and
    // present — the ONLY missing piece is the custody package entry, which is
    // precisely what the readiness check used to ignore.
    expect(client.config.objects.custody.assets.some((a) => a.name === "MOCK_USDC")).toBe(true);
    expect(psmConfigReady(client)).toBe(false);
  });

  it("appendPsmDeposit refuses with a named error, never a TypeError off undefined.published_at", () => {
    const client = createMockPredictClient(predictionOnlyConfig());
    const tx = new Transaction();
    expect(() =>
      appendPsmDeposit(client, tx, {
        accountId: "0x1",
        mockUsdcCoinId: "0x2",
        amount: 1n,
      }),
    ).toThrow(/native_custody package in waterx-config/);
  });

  it("a full deployment stays ready and builds the PSM deposit", () => {
    const client = createMockPredictClient();
    expect(psmConfigReady(client)).toBe(true);
    const tx = new Transaction();
    appendPsmDeposit(client, tx, { accountId: "0x1", mockUsdcCoinId: "0x2", amount: 1n });
    expect(tx.getData().commands.length).toBeGreaterThan(0);
  });
});
