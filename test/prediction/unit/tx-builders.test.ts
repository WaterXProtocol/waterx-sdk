import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it, vi } from "vitest";

import { buildBatchClaimTx, buildPlaceOrderTx } from "../../../src/prediction/tx-builders.ts";
import { MOCK_CREDIT_TYPE } from "../../perp/helpers/fixtures/mock-testnet-config.ts";
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

  it("prepends address CREDIT consolidate when consolidateToUsd is true", async () => {
    vi.spyOn(perpClient, "getBalance").mockImplementation(async ({ coinType }) => {
      if (coinType === MOCK_CREDIT_TYPE) {
        return {
          balance: { addressBalance: "100000", coinBalance: "0", balance: "100000" },
        } as never;
      }
      return { balance: { addressBalance: "0", coinBalance: "0", balance: "0" } } as never;
    });
    vi.spyOn(perpClient, "listCoins").mockResolvedValue({ objects: [] } as never);

    const tx = await buildPlaceOrderTx(perpClient, predictClient, placeParams);
    const functions = listMoveCalls(tx).map((c) => c.function);
    expect(functions).toContain("request_deposit_from_funds");
    expect(functions).toContain("consume_deposit_direct");
  });
});
