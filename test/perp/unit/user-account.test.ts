import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { PERM_ALL_TRADING } from "../../../src/constants.ts";
import {
  addDelegate,
  createAccount,
  receive,
  removeDelegate,
  requestDeposit,
  requestDepositFromFunds,
  requestDepositFromReceivings,
  requestWithdraw,
  setAlias,
  setDelegateProtocolPermission,
  transferToAccount,
} from "../../../src/user/account.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
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

  it("requestDepositFromReceivings batches TTO receiving refs", () => {
    const tx = new Transaction();
    const receiving = tx.receivingRef({
      objectId: PTB_DUMMY_DEPOSIT_COIN,
      version: "2",
      digest: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    });
    const req = requestDepositFromReceivings(client, tx, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      receivings: [receiving],
      extraData: new Uint8Array([4]),
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("requestDepositFromReceivings defaults extraData to empty", () => {
    const tx = new Transaction();
    const receiving = tx.receivingRef({
      objectId: PTB_DUMMY_DEPOSIT_COIN,
      version: "3",
      digest: "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    });
    const req = requestDepositFromReceivings(client, tx, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      receivings: [receiving],
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("requestDepositFromFunds drains funds-accumulator balance", () => {
    const tx = new Transaction();
    const req = requestDepositFromFunds(client, tx, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      extraData: new Uint8Array([9]),
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("requestDepositFromFunds accepts a TransactionArgument accumulator root", () => {
    const tx = new Transaction();
    const customRoot = tx.object(
      "0xacc000000000000000000000000000000000000000000000000000000000001",
    );
    const req = requestDepositFromFunds(client, tx, {
      accountId,
      coinType: MOCK_USDC_TYPE,
      accumulatorRoot: customRoot,
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("receive drains a TTO receiving ref into the PTB", () => {
    const tx = new Transaction();
    const receiving = tx.receivingRef({
      objectId: PTB_DUMMY_DEPOSIT_COIN,
      version: "1",
      digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    const out = receive(client, tx, {
      accountId,
      receiving,
      receivingType: MOCK_USDC_TYPE,
    });
    expect(out).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });
});
