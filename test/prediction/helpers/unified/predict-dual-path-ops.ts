import { DEFAULT_FORCE_CLAIM_CHUNK_SIZE } from "../../../../src/prediction/constants.ts";
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
  requestPartialClose,
  resolveMarket,
  selectionArg,
  selfCancelClose,
  selfCancelOrder,
  splitPosition,
  transferPosition,
} from "../../../../src/prediction/prediction.ts";
import { minimalPlaceOrderParams, PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import {
  caseArrayFactory,
  caseFactory,
  caseMutate,
  type PredictDualPathCase,
} from "./predict-dual-path-shared.ts";

export function predictOpsDualPathCases(client: {
  config: { packages: { waterx_prediction: { published_at: string } } };
}): PredictDualPathCase[] {
  const acc = minimalPlaceOrderParams(client as never);
  return [
    caseMutate(
      "selectionArg",
      (c, tx) => {
        selectionArg(c, tx, "YES");
      },
      (p, tx) => {
        p.selectionArg(tx, "YES");
      },
    ),
    caseMutate(
      "outcomeArg",
      (c, tx) => {
        outcomeArg(c, tx, "INVALID");
      },
      (p, tx) => {
        p.outcomeArg(tx, "INVALID");
      },
    ),
    caseMutate(
      "placeOrder",
      (c, tx) => placeOrder(c, tx, acc),
      (p, tx) => p.placeOrder(tx, acc),
    ),
    caseMutate(
      "selfCancelOrder",
      (c, tx) => selfCancelOrder(c, tx, { orderId: 9n }),
      (p, tx) => p.selfCancelOrder(tx, { orderId: 9n }),
    ),
    caseMutate(
      "claim",
      (c, tx) => claim(c, tx, { positionId: 8n }),
      (p, tx) => p.claim(tx, { positionId: 8n }),
    ),
    caseMutate(
      "batchClaim",
      (c, tx) => batchClaim(c, tx, { positionIds: [8n, 9n, 10n] }),
      (p, tx) => p.batchClaim(tx, { positionIds: [8n, 9n, 10n] }),
    ),
    caseMutate(
      "requestClose",
      (c, tx) => requestClose(c, tx, { positionId: 8n, minProceeds: 1n, expiryTs: 999n }),
      (p, tx) => p.requestClose(tx, { positionId: 8n, minProceeds: 1n, expiryTs: 999n }),
    ),
    caseMutate(
      "requestPartialClose",
      (c, tx) =>
        requestPartialClose(c, tx, {
          positionId: 8n,
          closeShares: 3n,
          minProceeds: 1n,
          expiryTs: 999n,
        }),
      (p, tx) =>
        p.requestPartialClose(tx, {
          positionId: 8n,
          closeShares: 3n,
          minProceeds: 1n,
          expiryTs: 999n,
        }),
    ),
    caseMutate(
      "selfCancelClose",
      (c, tx) => selfCancelClose(c, tx, { positionId: 8n }),
      (p, tx) => p.selfCancelClose(tx, { positionId: 8n }),
    ),
    caseMutate(
      "transferPosition",
      (c, tx) => transferPosition(c, tx, { positionId: 8n, recipientAccountId: acc.accountId }),
      (p, tx) => p.transferPosition(tx, { positionId: 8n, recipientAccountId: acc.accountId }),
    ),
    caseMutate(
      "splitPosition",
      (c, tx) =>
        splitPosition(c, tx, {
          positionId: 8n,
          recipientAccountId: acc.accountId,
          splitShares: 3n,
        }),
      (p, tx) =>
        p.splitPosition(tx, { positionId: 8n, recipientAccountId: acc.accountId, splitShares: 3n }),
    ),
    caseMutate(
      "fillOrder",
      (c, tx) => fillOrder(c, tx, { orderId: 1n, filledShares: 2n, filledCost: 3n }),
      (p, tx) => p.fillOrder(tx, { orderId: 1n, filledShares: 2n, filledCost: 3n }),
    ),
    caseMutate(
      "cancelOrder",
      (c, tx) => cancelOrder(c, tx, { orderId: 1n }),
      (p, tx) => p.cancelOrder(tx, { orderId: 1n }),
    ),
    caseMutate(
      "confirmClose",
      (c, tx) => confirmClose(c, tx, { positionId: 2n, proceeds: 5n }),
      (p, tx) => p.confirmClose(tx, { positionId: 2n, proceeds: 5n }),
    ),
    caseMutate(
      "cancelClose",
      (c, tx) => cancelClose(c, tx, { positionId: 2n }),
      (p, tx) => p.cancelClose(tx, { positionId: 2n }),
    ),
    caseMutate(
      "forceClaim",
      (c, tx) => forceClaim(c, tx, { positionId: 2n }),
      (p, tx) => p.forceClaim(tx, { positionId: 2n }),
    ),
    caseMutate(
      "batchForceClaim",
      (c, tx) => batchForceClaim(c, tx, { positionIds: [2n, 3n] }),
      (p, tx) => p.batchForceClaim(tx, { positionIds: [2n, 3n] }),
    ),
    caseMutate(
      "resolveMarket",
      (c, tx) => resolveMarket(c, tx, { marketId: "0x02", outcome: "YES" }),
      (p, tx) => p.resolveMarket(tx, { marketId: "0x02", outcome: "YES" }),
    ),
    caseArrayFactory(
      "buildBatchForceClaimTransactions",
      (c) =>
        buildBatchForceClaimTransactions(c, {
          positionIds: Array.from({ length: DEFAULT_FORCE_CLAIM_CHUNK_SIZE + 1 }, (_, i) =>
            BigInt(i + 1),
          ),
        }),
      (p) =>
        p.buildBatchForceClaimTransactions({
          positionIds: Array.from({ length: DEFAULT_FORCE_CLAIM_CHUNK_SIZE + 1 }, (_, i) =>
            BigInt(i + 1),
          ),
        }),
    ),
    caseMutate(
      "adminPlaceOrderFor",
      (c, tx) =>
        adminPlaceOrderFor(c, tx, {
          adminCap: PTB_DUMMY.adminCap,
          payment: PTB_DUMMY.coin,
          accountId: acc.accountId,
          marketId: acc.marketId,
          selection: "NO",
          minShares: 2n,
          priceCapBps: 6000n,
          expiryTs: acc.expiryTs,
        }),
      (p, tx) =>
        p.adminPlaceOrderFor(tx, {
          adminCap: PTB_DUMMY.adminCap,
          payment: PTB_DUMMY.coin,
          accountId: acc.accountId,
          marketId: acc.marketId,
          selection: "NO",
          minShares: 2n,
          priceCapBps: 6000n,
          expiryTs: acc.expiryTs,
        }),
    ),
  ];
}
