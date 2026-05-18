import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { PERM_ALL_TRADING } from "../../src/constants.ts";
import {
  addDelegate,
  createAccount,
  removeDelegate,
  requestDeposit,
  requestWithdraw,
  setAlias,
  setDelegateProtocolPermission,
  transferToAccount,
} from "../../src/user/account.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID, PTB_DUMMY_DEPOSIT_COIN } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;

describe("user/account PTB builders (v3)", () => {
  it("createAccount", () => {
    const tx = new Transaction();
    createAccount(client, tx, { alias: "unit-test" });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("setAlias", () => {
    const tx = new Transaction();
    setAlias(client, tx, { accountId, alias: "renamed" });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("addDelegate + removeDelegate", () => {
    const tx = new Transaction();
    addDelegate(client, tx, {
      accountId,
      delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
      alias: "bot",
      permissions: PERM_ALL_TRADING,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx2 = new Transaction();
    removeDelegate(client, tx2, { accountId, delegateAddress: PTB_DUMMY_DEPOSIT_COIN });
    expect(tx2.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("setDelegateProtocolPermission", () => {
    const tx = new Transaction();
    setDelegateProtocolPermission(client, tx, {
      accountId,
      delegateAddress: PTB_DUMMY_DEPOSIT_COIN,
      protocolType: `${client.config.packages.waterx_perp.original_id}::account_data::WaterXPerp`,
      permissions: PERM_ALL_TRADING,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("requestDeposit + requestWithdraw + transferToAccount", () => {
    const tx = new Transaction();
    const coin = tx.object(PTB_DUMMY_DEPOSIT_COIN);
    requestDeposit(client, tx, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      coin,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx2 = new Transaction();
    requestWithdraw(client, tx2, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      amount: 1_000_000n,
      recipient: PTB_DUMMY_DEPOSIT_COIN,
    });
    expect(tx2.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx3 = new Transaction();
    transferToAccount(client, tx3, {
      accountId,
      coin: tx3.object(PTB_DUMMY_DEPOSIT_COIN),
      coinType: MOCK_USDC_TYPE,
    });
    expect(tx3.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});
