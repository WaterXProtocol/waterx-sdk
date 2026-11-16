/** Voucher builders participate in the same free-function/facade equivalence registry as cash builders. */
import type { PredictClient } from "../../../../src/prediction/client.ts";
import { buildPlaceVoucherOrderTx } from "../../../../src/prediction/tx-builders.ts";
import * as voucher from "../../../../src/prediction/voucher.ts";
import { minimalPlaceOrderParams, PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import { caseMutate, type PredictDualPathCase } from "./predict-dual-path-shared.ts";

export function predictVoucherDualPathCases(client: PredictClient): PredictDualPathCase[] {
  const place = { ...minimalPlaceOrderParams(client), maxSpend: 9_007_199_254_740_993n };
  const grant = { accountId: PTB_DUMMY.accountId, amount: 9_007_199_254_740_993n };
  const revoke = { ...grant, adminCap: PTB_DUMMY.adminCap };
  const budget = { adminCap: PTB_DUMMY.adminCap, grantBudget: 9_007_199_254_740_993n };
  const paused = { adminCap: PTB_DUMMY.adminCap, paused: true };
  const granter = { adminCap: PTB_DUMMY.adminCap, granter: PTB_DUMMY.delegate };
  return [
    caseMutate(
      "placeOrderWithVoucher",
      (c, tx) => voucher.placeOrderWithVoucher(c, tx, place),
      (p, tx) => p.placeOrderWithVoucher(tx, place),
    ),
    {
      name: "buildPlaceVoucherOrderTx",
      buildLegacy: (c) => buildPlaceVoucherOrderTx(c, place),
      buildFacade: (p) => p.buildPlaceVoucherOrderTx(place),
    },
    caseMutate(
      "grantVoucher",
      (c, tx) => voucher.grantVoucher(c, tx, grant),
      (p, tx) => p.grantVoucher(tx, grant),
    ),
    caseMutate(
      "revokeVoucher",
      (c, tx) => voucher.revokeVoucher(c, tx, revoke),
      (p, tx) => p.revokeVoucher(tx, revoke),
    ),
    caseMutate(
      "setVoucherGrantBudget",
      (c, tx) => voucher.setVoucherGrantBudget(c, tx, budget),
      (p, tx) => p.setVoucherGrantBudget(tx, budget),
    ),
    caseMutate(
      "setVoucherPaused",
      (c, tx) => voucher.setVoucherPaused(c, tx, paused),
      (p, tx) => p.setVoucherPaused(tx, paused),
    ),
    caseMutate(
      "addVoucherGranter",
      (c, tx) => voucher.addVoucherGranter(c, tx, granter),
      (p, tx) => p.addVoucherGranter(tx, granter),
    ),
    caseMutate(
      "removeVoucherGranter",
      (c, tx) => voucher.removeVoucherGranter(c, tx, granter),
      (p, tx) => p.removeVoucherGranter(tx, granter),
    ),
  ];
}
