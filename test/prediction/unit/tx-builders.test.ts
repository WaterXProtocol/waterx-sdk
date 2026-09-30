import { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PredictClient } from "../../../src/prediction/client.ts";
import { buildBatchClaimTx, buildPlaceOrderTx } from "../../../src/prediction/tx-builders.ts";
import {
  MOCK_SUI_CREDIT,
  MOCK_TESTNET_CONFIG,
} from "../../helpers/fixtures/mock-testnet-config.ts";
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

  it("a SUI-settled market sweeps parked SUI into the SUI credit stack, not USD", async () => {
    const suiPredict = new PredictClient("TESTNET", structuredClone(MOCK_TESTNET_CONFIG), {
      settlement: "SUI",
    });
    const suiBacking = MOCK_SUI_CREDIT.assetType;
    const suiCredit = MOCK_SUI_CREDIT.creditType;
    const funds = (amount: string) => ({
      balance: { addressBalance: amount, coinBalance: "0", balance: amount },
    });
    const probed: string[] = [];
    vi.spyOn(perpClient, "getBalance").mockImplementation(async ({ coinType }) => {
      probed.push(coinType ?? "<none>");
      if (coinType === suiBacking) return funds("5000000000") as never; // 5 SUI (9 dec)
      if (coinType === suiCredit) return funds("100000") as never;
      return funds("0") as never;
    });
    vi.spyOn(perpClient, "listCoins").mockImplementation(async () => ({ objects: [] }) as never);

    const tx = await buildPlaceOrderTx(perpClient, suiPredict, placeParams);
    const calls = listMoveCalls(tx);
    // Both probes ask for the SUI stack's coins — never the USD credit.
    expect(probed).toEqual([suiBacking, suiCredit]);
    // backing SUI → mint_from_request → consume; address SUI-credit → request_deposit_from_funds → consume
    const sweep = calls
      .map((c) => c.function)
      .filter((f) => f !== "request" && f !== "selection_yes");
    expect(sweep).toEqual([
      "request_deposit_from_funds",
      "mint_from_request",
      "consume_deposit_direct",
      "request_deposit_from_funds",
      "consume_deposit_direct",
      "place_order",
    ]);
    const mint = calls.find((c) => c.function === "mint_from_request");
    expect(mint?.typeArguments).toEqual([
      normalizeStructTag(suiBacking),
      normalizeStructTag(suiCredit),
    ]);
    // Only the SUI credit is deposited / consumed — no USD leg anywhere.
    const usdType = normalizeStructTag(MOCK_TESTNET_CONFIG.objects.credit.credit_type);
    expect(calls.flatMap((c) => c.typeArguments)).not.toContain(usdType);
    expect(calls.find((c) => c.function === "place_order")?.typeArguments).toEqual([
      normalizeStructTag(suiCredit),
    ]);
    const inputIds = tx.getData().inputs.map((input) => input.UnresolvedObject?.objectId);
    expect(inputIds).toContain(MOCK_SUI_CREDIT.vault);
    expect(inputIds).toContain(MOCK_SUI_CREDIT.registry);
    expect(inputIds).not.toContain(MOCK_TESTNET_CONFIG.objects.custody.vault);
    expect(inputIds).not.toContain(MOCK_TESTNET_CONFIG.objects.credit.registry);
  });
});
