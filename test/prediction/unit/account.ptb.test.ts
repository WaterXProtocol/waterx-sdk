import { Transaction } from "@mysten/sui/transactions";
import {
  addDelegate,
  allowPredictionProtocolAsset,
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
} from "~predict/account.ts";
import { describe, expect, it } from "vitest";

import { minimalAccountOpsParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

describe("account PTB builders", () => {
  const client = createMockPredictClient();
  const baseAcc = minimalAccountOpsParams();

  it("createAccount", () => {
    const tx = new Transaction();
    createAccount(client, tx, { alias: "u1" });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("transferCoinToAccount", () => {
    const tx = new Transaction();
    transferCoinToAccount(client, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("requestDeposit", () => {
    const tx = new Transaction();
    requestDeposit(client, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("deposit", () => {
    const tx = new Transaction();
    deposit(client, tx, { accountId: baseAcc.accountId, coin: PTB_DUMMY.coin });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("requestDepositFromReceivings", () => {
    const tx = new Transaction();
    requestDepositFromReceivings(client, tx, {
      accountId: baseAcc.accountId,
      coins: [
        {
          objectId: PTB_DUMMY.coin,
          version: "3",
          digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        },
      ],
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("requestWithdraw", () => {
    const tx = new Transaction();
    requestWithdraw(client, tx, {
      accountId: baseAcc.accountId,
      amount: 100n,
      recipient: PTB_DUMMY.recipient,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("addDelegate", () => {
    const tx = new Transaction();
    addDelegate(client, tx, {
      ...baseAcc,
      expiresAtMs: null,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("addDelegate with expiry timestamp", () => {
    const tx = new Transaction();
    addDelegate(client, tx, {
      ...baseAcc,
      expiresAtMs: 9_999_999_999n,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("removeDelegate", () => {
    const tx = new Transaction();
    removeDelegate(client, tx, baseAcc);
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("setDelegatePredictionPermission", () => {
    const tx = new Transaction();
    setDelegatePredictionPermission(client, tx, {
      ...baseAcc,
      permissions: 7,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("whitelistPredictionProtocol", () => {
    const tx = new Transaction();
    whitelistPredictionProtocol(client, tx, { adminCap: PTB_DUMMY.adminCap });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("allow / disallow prediction protocol settlement asset", () => {
    const txAllow = new Transaction();
    allowPredictionProtocolAsset(client, txAllow, { adminCap: PTB_DUMMY.adminCap });
    expect(listMoveCalls(txAllow)).toMatchSnapshot();

    const txDisallow = new Transaction();
    disallowPredictionProtocolAsset(client, txDisallow, { adminCap: PTB_DUMMY.adminCap });
    expect(listMoveCalls(txDisallow)).toMatchSnapshot();
  });
});
