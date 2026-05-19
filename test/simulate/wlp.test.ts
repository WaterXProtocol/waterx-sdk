/**
 * E2E: WLP mint PTB (heavy oracle refresh inside builder).
 */
import { buildMintWlpTx } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import {
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`wlp (${e2eNetwork})`, () => {
  it("buildMintWlpTx composes refresh + mint (simulate)", async (ctx) => {
    const depositTokenType = client.getPoolTokenType("USDCUSD");
    const tx = await buildMintWlpTx(client, {
      accountId: DUMMY_ACCOUNT,
      depositAmount: 1_000_000n,
      minLpAmount: 1n,
      depositTicker: "USDCUSD",
      depositTokenType,
      skipOraclePriceRefresh: false,
    });
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 240_000);
});
