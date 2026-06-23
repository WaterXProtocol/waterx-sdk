import { Transaction } from "@mysten/sui/transactions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildBatchClaimTx, buildPlaceOrderTx } from "../../../src/prediction/tx-builders.ts";
import { coinRef, mockConsolidateBalances } from "../../perp/helpers/consolidate-mocks.ts";
import { PTB_DUMMY_DEPOSIT_COIN } from "../../perp/helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../../perp/helpers/test-client.ts";
import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

function moveFunctions(tx: Transaction): string[] {
  return listMoveCalls(tx).map((c) => c.function);
}

describe("prediction tx-builders", () => {
  const predictClient = createMockPredictClient();
  const placeParams = minimalPlaceOrderParams(predictClient);
  let perpClient: ReturnType<typeof createUnitTestClient>;

  beforeEach(() => {
    perpClient = createUnitTestClient();
    vi.restoreAllMocks();
  });

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

  it("prepends address CREDIT funds consolidate when consolidateToUsd is true (default)", async () => {
    mockConsolidateBalances(perpClient, { creditFunds: "100000" });

    const tx = await buildPlaceOrderTx(perpClient, predictClient, placeParams);
    const fns = moveFunctions(tx);
    expect(fns).toContain("request_deposit_from_funds");
    expect(fns).toContain("consume_deposit_direct");
    expect(fns).toContain("place_order");
  });

  it("prepends owned Coin<CREDIT> receivings consolidate on batchClaim", async () => {
    mockConsolidateBalances(perpClient, {
      creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "200000")],
    });

    const tx = await buildBatchClaimTx(perpClient, predictClient, {
      accountId: PTB_DUMMY.accountId,
      positionIds: [1n],
    });
    const fns = moveFunctions(tx);
    expect(fns).toContain("request_deposit_from_receivings");
    expect(fns).toContain("claim");
  });

  it("prepends both backing PSM and address CREDIT sweeps before placeOrder", async () => {
    mockConsolidateBalances(perpClient, {
      backingFunds: "300000",
      creditFunds: "100000",
    });

    const tx = await buildPlaceOrderTx(perpClient, predictClient, placeParams);
    const fns = moveFunctions(tx);
    expect(fns).toContain("mint_from_request");
    expect(fns.filter((f) => f === "consume_deposit_direct").length).toBeGreaterThanOrEqual(2);
  });

  it("adds no consolidate legs when probes are empty (default consolidateToUsd)", async () => {
    mockConsolidateBalances(perpClient);

    const syncTx = new Transaction();
    const { placeOrder } = await import("../../../src/prediction/prediction.ts");
    placeOrder(predictClient, syncTx, placeParams);

    const asyncTx = await buildPlaceOrderTx(perpClient, predictClient, placeParams);
    expect(listMoveCalls(asyncTx)).toEqual(listMoveCalls(syncTx));
  });
});
