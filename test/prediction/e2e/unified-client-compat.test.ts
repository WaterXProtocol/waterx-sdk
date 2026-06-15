import { Transaction } from "@mysten/sui/transactions";
import { createAccount } from "~predict/account.ts";
import type { PredictClient } from "~predict/client.ts";
import { getRegistry } from "~predict/fetch.ts";
import { placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { Client } from "../../../src/sdk.ts";
import {
  assertAsyncResultsEqual,
  assertTransactionsEqual,
} from "../../helpers/unified-dual-path.ts";
import { assertSimulateReached } from "../../perp/helpers/e2e/simulate-assertions.ts";
import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

describe("unified Client prediction compat (testnet)", () => {
  let unified: Client;
  let legacyPredict: PredictClient;

  beforeAll(async () => {
    unified = await Client.create({ network: "TESTNET", cache: true });
    legacyPredict = await createE2eClient();
  }, 120_000);

  it("Client.create wires the same prediction deployment as PredictClient.testnet", () => {
    expect(unified.predictClient.packageId()).toBe(legacyPredict.packageId());
  });

  it("getRegistry: facade vs legacy", async () => {
    await assertAsyncResultsEqual(getRegistry(legacyPredict), unified.predict.getRegistry());
  }, 60_000);

  it("createAccount PTB: facade vs legacy + simulate", async () => {
    const alias = `unified-predict-${Date.now()}`;
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    createAccount(legacyPredict, legacyTx, { alias });
    unified.predict.createAccount(facadeTx, { alias });
    assertTransactionsEqual(legacyTx, facadeTx, "createAccount");
    await expectSimulateSuccess(unified.predictClient, facadeTx);
  }, 60_000);

  it("placeOrder PTB: facade vs legacy + simulate", async () => {
    const params = minimalPlaceOrderParams(legacyPredict);
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    placeOrder(legacyPredict, legacyTx, params);
    unified.predict.placeOrder(facadeTx, params);
    assertTransactionsEqual(legacyTx, facadeTx, "placeOrder");
    const sim = await unified.predictClient.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 60_000);
});
