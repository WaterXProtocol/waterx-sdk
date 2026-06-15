import {
  addKeeper,
  adminWithdraw,
  createMarketRegistry,
  depositSettlement,
  pauseMarket,
  removeKeeper,
  setMinReserve,
  setOrderCancelCooldownMs,
  unpauseMarket,
} from "../../../../src/prediction/admin.ts";
import { PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import { caseMutate, type PredictDualPathCase } from "./predict-dual-path-shared.ts";

export const predictAdminDualPathCases: PredictDualPathCase[] = [
  caseMutate(
    "createMarketRegistry",
    (c, tx) => createMarketRegistry(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.createMarketRegistry(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
  caseMutate(
    "depositSettlement",
    (c, tx) => depositSettlement(c, tx, { adminCap: PTB_DUMMY.adminCap, payment: PTB_DUMMY.coin }),
    (p, tx) => p.depositSettlement(tx, { adminCap: PTB_DUMMY.adminCap, payment: PTB_DUMMY.coin }),
  ),
  caseMutate(
    "adminWithdraw",
    (c, tx) =>
      adminWithdraw(c, tx, {
        adminCap: PTB_DUMMY.adminCap,
        amount: 1n,
        recipient: PTB_DUMMY.recipient,
      }),
    (p, tx) =>
      p.adminWithdraw(tx, {
        adminCap: PTB_DUMMY.adminCap,
        amount: 1n,
        recipient: PTB_DUMMY.recipient,
      }),
  ),
  caseMutate(
    "setMinReserve",
    (c, tx) => setMinReserve(c, tx, { adminCap: PTB_DUMMY.adminCap, newReserve: 2n }),
    (p, tx) => p.setMinReserve(tx, { adminCap: PTB_DUMMY.adminCap, newReserve: 2n }),
  ),
  caseMutate(
    "setOrderCancelCooldownMs",
    (c, tx) => setOrderCancelCooldownMs(c, tx, { adminCap: PTB_DUMMY.adminCap, cooldownMs: 100n }),
    (p, tx) => p.setOrderCancelCooldownMs(tx, { adminCap: PTB_DUMMY.adminCap, cooldownMs: 100n }),
  ),
  caseMutate(
    "pauseMarket",
    (c, tx) => pauseMarket(c, tx, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" }),
    (p, tx) => p.pauseMarket(tx, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" }),
  ),
  caseMutate(
    "unpauseMarket",
    (c, tx) => unpauseMarket(c, tx, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" }),
    (p, tx) => p.unpauseMarket(tx, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" }),
  ),
  caseMutate(
    "addKeeper",
    (c, tx) => addKeeper(c, tx, { adminCap: PTB_DUMMY.adminCap, keeper: PTB_DUMMY.delegate }),
    (p, tx) => p.addKeeper(tx, { adminCap: PTB_DUMMY.adminCap, keeper: PTB_DUMMY.delegate }),
  ),
  caseMutate(
    "removeKeeper",
    (c, tx) => removeKeeper(c, tx, { adminCap: PTB_DUMMY.adminCap, keeper: PTB_DUMMY.delegate }),
    (p, tx) => p.removeKeeper(tx, { adminCap: PTB_DUMMY.adminCap, keeper: PTB_DUMMY.delegate }),
  ),
];
