import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { buildBatchClaimTx, buildPlaceOrderTx } from "../../../src/prediction/tx-builders.ts";
import { createUnitTestClient } from "../../perp/helpers/test-client.ts";
import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

describe("prediction tx-builders", () => {
  const perpClient = createUnitTestClient();
  const predictClient = createMockPredictClient();
  const placeParams = minimalPlaceOrderParams(predictClient);

  it("buildPlaceOrderTx composes placeOrder when consolidateToUsd is false", async () => {
    const syncTx = new Transaction();
    const { placeOrder } = await import("../../../src/prediction/prediction.ts");
    placeOrder(predictClient, syncTx, placeParams);

    const asyncTx = await buildPlaceOrderTx(perpClient, predictClient, {
      ...placeParams,
      consolidateToUsd: false,
    });
    expect(listMoveCalls(asyncTx)).toEqual(listMoveCalls(syncTx));
  });

  it("buildBatchClaimTx composes batchClaim when consolidateToUsd is false", async () => {
    const syncTx = new Transaction();
    const { batchClaim } = await import("../../../src/prediction/prediction.ts");
    batchClaim(predictClient, syncTx, { positionIds: [8n, 9n] });

    const asyncTx = await buildBatchClaimTx(perpClient, predictClient, {
      accountId: PTB_DUMMY.accountId,
      positionIds: [8n, 9n],
      consolidateToUsd: false,
    });
    expect(listMoveCalls(asyncTx)).toEqual(listMoveCalls(syncTx));
  });

  it("reuses passed Transaction via tx opt", async () => {
    const tx = new Transaction();
    const out = await buildPlaceOrderTx(perpClient, predictClient, {
      ...placeParams,
      tx,
      consolidateToUsd: false,
    });
    expect(out).toBe(tx);
  });
});
