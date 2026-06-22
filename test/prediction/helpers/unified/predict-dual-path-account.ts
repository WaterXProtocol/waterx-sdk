import {
  addDelegate,
  allowPredictionProtocolAsset,
  consumeDepositDirect,
  consumeWithdrawDirect,
  createAccount,
  deposit,
  disallowPredictionProtocolAsset,
  removeDelegate,
  requestDeposit,
  requestDepositFromReceivings,
  requestWithdraw,
  setDelegatePredictionPermission,
  transferCoinToAccount,
  whitelistPredictionProtocol,
  withdraw,
} from "../../../../src/prediction/account.ts";
import { minimalAccountOpsParams, PTB_DUMMY } from "../../fixtures/ptb-params.ts";
import { caseMutate, type PredictDualPathCase } from "./predict-dual-path-shared.ts";

const baseAcc = minimalAccountOpsParams();

export const predictAccountDualPathCases: PredictDualPathCase[] = [
  caseMutate(
    "createAccount",
    (c, tx) => createAccount(c, tx, { alias: "dual" }),
    (p, tx) => p.createAccount(tx, { alias: "dual" }),
  ),
  caseMutate(
    "transferCoinToAccount",
    (c, tx) => transferCoinToAccount(c, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
    (p, tx) => p.transferCoinToAccount(tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
  ),
  caseMutate(
    "requestDeposit",
    (c, tx) => requestDeposit(c, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
    (p, tx) => p.requestDeposit(tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
  ),
  caseMutate(
    "consumeDepositDirect",
    (c, tx) => {
      const req = requestDeposit(c, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin });
      consumeDepositDirect(c, tx, { depositRequest: req });
    },
    (p, tx) => {
      const req = p.requestDeposit(tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin });
      p.consumeDepositDirect(tx, { depositRequest: req });
    },
  ),
  caseMutate(
    "deposit",
    (c, tx) => deposit(c, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
    (p, tx) => p.deposit(tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin }),
  ),
  caseMutate(
    "requestDepositFromReceivings",
    (c, tx) => {
      requestDepositFromReceivings(c, tx, {
        accountId: baseAcc.accountId,
        coins: [
          {
            objectId: PTB_DUMMY.coin,
            version: "3",
            digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        ],
      });
    },
    (p, tx) => {
      p.requestDepositFromReceivings(tx, {
        accountId: baseAcc.accountId,
        coins: [
          {
            objectId: PTB_DUMMY.coin,
            version: "3",
            digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        ],
      });
    },
  ),
  caseMutate(
    "requestWithdraw",
    (c, tx) => {
      requestWithdraw(c, tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
    },
    (p, tx) => {
      p.requestWithdraw(tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
    },
  ),
  caseMutate(
    "consumeWithdrawDirect",
    (c, tx) => {
      const req = requestWithdraw(c, tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
      consumeWithdrawDirect(c, tx, { withdrawRequest: req });
    },
    (p, tx) => {
      const req = p.requestWithdraw(tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
      p.consumeWithdrawDirect(tx, { withdrawRequest: req });
    },
  ),
  caseMutate(
    "withdraw",
    (c, tx) => {
      withdraw(c, tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
    },
    (p, tx) => {
      p.withdraw(tx, {
        accountId: baseAcc.accountId,
        amount: 100n,
        recipient: PTB_DUMMY.recipient,
      });
    },
  ),
  caseMutate(
    "addDelegate",
    (c, tx) => addDelegate(c, tx, { ...baseAcc, expiresAtMs: null }),
    (p, tx) => p.addDelegate(tx, { ...baseAcc, expiresAtMs: null }),
  ),
  caseMutate(
    "removeDelegate",
    (c, tx) => removeDelegate(c, tx, baseAcc),
    (p, tx) => p.removeDelegate(tx, baseAcc),
  ),
  caseMutate(
    "setDelegatePredictionPermission",
    (c, tx) => setDelegatePredictionPermission(c, tx, { ...baseAcc, permissions: 7 }),
    (p, tx) => p.setDelegatePredictionPermission(tx, { ...baseAcc, permissions: 7 }),
  ),
  caseMutate(
    "whitelistPredictionProtocol",
    (c, tx) => whitelistPredictionProtocol(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.whitelistPredictionProtocol(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
  caseMutate(
    "allowPredictionProtocolAsset",
    (c, tx) => allowPredictionProtocolAsset(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.allowPredictionProtocolAsset(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
  caseMutate(
    "disallowPredictionProtocolAsset",
    (c, tx) => disallowPredictionProtocolAsset(c, tx, { adminCap: PTB_DUMMY.adminCap }),
    (p, tx) => p.disallowPredictionProtocolAsset(tx, { adminCap: PTB_DUMMY.adminCap }),
  ),
];
