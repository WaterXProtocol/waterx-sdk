import { Transaction } from "@mysten/sui/transactions";
import { DEFAULT_FORCE_CLAIM_CHUNK_SIZE } from "~predict/constants.ts";
import {
  adminPlaceOrderFor,
  batchClaim,
  batchForceClaim,
  buildBatchForceClaimTransactions,
  cancelClose,
  cancelOrder,
  claim,
  confirmClose,
  fillOrder,
  forceClaim,
  outcomeArg,
  placeOrder,
  requestClose,
  resolveMarket,
  selectionArg,
  selfCancelClose,
  selfCancelOrder,
} from "~predict/prediction.ts";
import { describe, expect, it } from "vitest";

import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

describe("prediction PTB builders", () => {
  const client = createMockPredictClient();
  const acc = minimalPlaceOrderParams(client);

  it("selectionArg / outcomeArg pure variants add helper calls", () => {
    const tx = new Transaction();
    selectionArg(client, tx, "YES");
    outcomeArg(client, tx, "INVALID");
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("selectionArg / outcomeArg pass through existing transaction arguments", () => {
    const tx = new Transaction();
    const sel = selectionArg(client, tx, "NO");
    const out = outcomeArg(client, tx, "NO");
    const tx2 = new Transaction();
    expect(selectionArg(client, tx2, sel)).toBe(sel);
    expect(outcomeArg(client, tx2, out)).toBe(out);
    expect(listMoveCalls(tx2)).toHaveLength(0);
  });

  it("placeOrder", () => {
    const tx = new Transaction();
    placeOrder(client, tx, acc);
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("selfCancelOrder", () => {
    const tx = new Transaction();
    selfCancelOrder(client, tx, { orderId: 9n });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("claim", () => {
    const tx = new Transaction();
    claim(client, tx, { positionId: 8n });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("batchClaim", () => {
    const tx = new Transaction();
    batchClaim(client, tx, { positionIds: [8n, 9n, 10n] });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("batchClaim rejects empty positionIds", () => {
    const tx = new Transaction();
    expect(() => batchClaim(client, tx, { positionIds: [] })).toThrow(
      /positionIds must not be empty/,
    );
  });

  it("requestClose", () => {
    const tx = new Transaction();
    requestClose(client, tx, {
      positionId: 8n,
      minProceeds: 1n,
      expiryTs: 999n,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("selfCancelClose", () => {
    const tx = new Transaction();
    selfCancelClose(client, tx, { positionId: 8n });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("keeper flows", () => {
    const txFill = new Transaction();
    fillOrder(client, txFill, {
      orderId: 1n,
      filledShares: 2n,
      filledCost: 3n,
    });
    expect(listMoveCalls(txFill)).toMatchSnapshot();

    const txCancelOrder = new Transaction();
    cancelOrder(client, txCancelOrder, { orderId: 1n });
    expect(listMoveCalls(txCancelOrder)).toMatchSnapshot();

    const txConfirm = new Transaction();
    confirmClose(client, txConfirm, { positionId: 2n, proceeds: 5n });
    expect(listMoveCalls(txConfirm)).toMatchSnapshot();

    const txCancelClose = new Transaction();
    cancelClose(client, txCancelClose, { positionId: 2n });
    expect(listMoveCalls(txCancelClose)).toMatchSnapshot();

    const txForce = new Transaction();
    forceClaim(client, txForce, { positionId: 2n });
    expect(listMoveCalls(txForce)).toMatchSnapshot();

    const txBatchForce = new Transaction();
    batchForceClaim(client, txBatchForce, { positionIds: [2n, 3n] });
    expect(listMoveCalls(txBatchForce)).toMatchSnapshot();

    const txResolve = new Transaction();
    resolveMarket(client, txResolve, { marketId: "0x02", outcome: "YES" });
    expect(listMoveCalls(txResolve)).toMatchSnapshot();
  });

  it("batchForceClaim rejects empty positionIds", () => {
    const tx = new Transaction();
    expect(() => batchForceClaim(client, tx, { positionIds: [] })).toThrow(
      /positionIds must not be empty/,
    );
  });

  it("buildBatchForceClaimTransactions splits into multiple PTBs", () => {
    const txs = buildBatchForceClaimTransactions(client, {
      positionIds: [1n, 2n, 3n, 4n, 5n],
      chunkSize: 2,
    });
    expect(txs).toHaveLength(3);
    expect(listMoveCalls(txs[0]!).filter((c) => c.function === "force_claim")).toHaveLength(2);
    expect(listMoveCalls(txs[1]!).filter((c) => c.function === "force_claim")).toHaveLength(2);
    expect(listMoveCalls(txs[2]!).filter((c) => c.function === "force_claim")).toHaveLength(1);
    expect(listMoveCalls(txs[0]!).filter((c) => c.function === "request")).toHaveLength(1);
  });

  it("buildBatchForceClaimTransactions uses default chunk size for a single PTB", () => {
    const txs = buildBatchForceClaimTransactions(client, { positionIds: [1n, 2n] });
    expect(txs).toHaveLength(1);
    expect(listMoveCalls(txs[0]!).filter((c) => c.function === "force_claim")).toHaveLength(2);
  });

  it("buildBatchForceClaimTransactions splits at DEFAULT_FORCE_CLAIM_CHUNK_SIZE", () => {
    const positionIds = Array.from({ length: DEFAULT_FORCE_CLAIM_CHUNK_SIZE + 1 }, (_, i) =>
      BigInt(i + 1),
    );
    const txs = buildBatchForceClaimTransactions(client, { positionIds });
    expect(txs).toHaveLength(2);
    expect(listMoveCalls(txs[0]!).filter((c) => c.function === "force_claim")).toHaveLength(
      DEFAULT_FORCE_CLAIM_CHUNK_SIZE,
    );
    expect(listMoveCalls(txs[1]!).filter((c) => c.function === "force_claim")).toHaveLength(1);
  });

  it("buildBatchForceClaimTransactions rejects empty positionIds", () => {
    expect(() => buildBatchForceClaimTransactions(client, { positionIds: [] })).toThrow(
      /positionIds must not be empty/,
    );
  });

  it("buildBatchForceClaimTransactions rejects invalid chunkSize", () => {
    expect(() =>
      buildBatchForceClaimTransactions(client, { positionIds: [1n], chunkSize: 0 }),
    ).toThrow(/chunkSize must be a positive integer/);
    expect(() =>
      buildBatchForceClaimTransactions(client, { positionIds: [1n], chunkSize: 1.5 }),
    ).toThrow(/chunkSize must be a positive integer/);
  });

  it("adminPlaceOrderFor", () => {
    const tx = new Transaction();
    adminPlaceOrderFor(client, tx, {
      adminCap: PTB_DUMMY.adminCap,
      payment: PTB_DUMMY.coin,
      accountId: acc.accountId,
      marketId: acc.marketId,
      selection: "NO",
      minShares: 2n,
      priceCapBps: 6000n,
      expiryTs: acc.expiryTs,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });
});
