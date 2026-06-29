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
import {
  createE2eClient,
  predictE2eNetwork,
  predictE2eNetworkKey,
} from "../helpers/e2e-context.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

describe(`unified Client prediction compat (${predictE2eNetwork})`, () => {
  let unified: Client;
  let legacyPredict: PredictClient;
  const network = predictE2eNetworkKey();

  beforeAll(async () => {
    unified = await Client.create({ network, cache: true });
    legacyPredict = await createE2eClient();
  }, 120_000);

  it("Client.create wires the same prediction deployment as createE2eClient", () => {
    expect(unified.predict.network).toBe(network);
    expect(unified.predict.packageId()).toBe(legacyPredict.packageId());
  });

  it("getRegistry: facade vs legacy", async () => {
    await assertAsyncResultsEqual(getRegistry(legacyPredict), unified.predict.getRegistry());
  }, 60_000);

  it("createAccount PTB: facade vs legacy + simulate", async () => {
    const alias = `unified-predict-${Date.now()}`;
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    createAccount(legacyPredict, legacyTx, { alias });
    // Generic account ops are no longer bound on `client.predict` (single unified
    // account lives on `client.account`); the predict line reaches them via the
    // prediction free function with the predict sub-client.
    createAccount(unified.predict, facadeTx, { alias });
    assertTransactionsEqual(legacyTx, facadeTx, "createAccount");
    await expectSimulateSuccess(unified.predict, facadeTx);
  }, 60_000);

  it("placeOrder PTB: facade vs legacy + simulate", async () => {
    const params = minimalPlaceOrderParams(legacyPredict);
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    placeOrder(legacyPredict, legacyTx, params);
    unified.predict.placeOrder(facadeTx, params);
    assertTransactionsEqual(legacyTx, facadeTx, "placeOrder");
    const sim = await unified.predict.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 60_000);
});
