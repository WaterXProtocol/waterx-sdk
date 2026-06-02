/**
 * E2E: wxa account creation simulate (no signing).
 */
import { Transaction } from "@mysten/sui/transactions";
import { createAccount } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { client, DUMMY_SENDER, e2eNetwork } from "../helpers/e2e/e2e-client.ts";
import { assertSimulateSuccess } from "../helpers/e2e/simulate-assertions.ts";

describe(`account wxa (${e2eNetwork})`, () => {
  it("simulates createAccount PTB shape", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(50_000_000);
    createAccount(client, tx, { alias: `e2e-${Date.now()}` });
    const sim = await client.simulate(tx);
    assertSimulateSuccess(sim, 1);
  }, 120_000);
});
