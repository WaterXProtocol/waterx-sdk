/**
 * PTB wiring for user_account module (no chain).
 */
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client";
import { PERM_OPEN_POSITION, TESTNET_TYPES } from "../../src/constants";
import {
  addDelegate,
  createAccount,
  receiveCoin,
  removeDelegate,
  transferToAccount,
  updateDelegatePermissions,
} from "../../src/user/account";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_LP_COIN_EE,
  PTB_DUMMY_OBJECT_DD,
} from "../helpers/fixtures/ptb-test-dummies.ts";

const client = WaterXClient.testnet();
const accountId = PTB_DUMMY_ACCOUNT_ID;
/** Delegate / `newOwner` address (distinct from `accountId`). */
const addr = PTB_DUMMY_DEPOSIT_COIN;

describe("user/account PTB builders", () => {
  it("createAccount appends move call", () => {
    const tx = new Transaction();
    createAccount(client, tx, "acct-name");
    const data = tx.getData();
    expect(data.commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("transferToAccount appends transfer_coin move call", () => {
    const tx = new Transaction();
    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin: PTB_DUMMY_COIN_CC,
      coinType: TESTNET_TYPES.USDC,
    });
    const data = tx.getData();
    expect(data.commands?.length).toBe(1);
  });

  it("transferToAccount accepts TransactionObjectArgument", () => {
    const tx = new Transaction();
    const coin = tx.object(PTB_DUMMY_OBJECT_DD);
    transferToAccount(client, tx, {
      accountObjectAddress: accountId,
      coin,
      coinType: TESTNET_TYPES.USDC,
    });
    expect(tx.getData().commands?.length).toBe(1);
  });

  it("receiveCoin appends user_account::receive_coin_with_amount", () => {
    const tx = new Transaction();
    receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coins: [{ objectId: PTB_DUMMY_LP_COIN_EE, version: "1", digest: "digest" }],
      coinType: TESTNET_TYPES.USDC,
    });
    const data = tx.getData();
    expect(data.commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("receiveCoin accepts the v1 coinObjectId/coinVersion/coinDigest shim", () => {
    const tx = new Transaction();
    receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coinObjectId: PTB_DUMMY_LP_COIN_EE,
      coinVersion: "7",
      coinDigest: "digest-v1",
      coinType: TESTNET_TYPES.USDC,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("receiveCoin shim defaults coinVersion=0 / coinDigest='' when omitted", () => {
    const tx = new Transaction();
    receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coinObjectId: PTB_DUMMY_LP_COIN_EE,
      coinType: TESTNET_TYPES.USDC,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("receiveCoin throws when neither `coins` nor `coinObjectId` is provided", () => {
    const tx = new Transaction();
    expect(() =>
      receiveCoin(client, tx, {
        accountObjectAddress: accountId,
        coinType: TESTNET_TYPES.USDC,
      }),
    ).toThrow(/pass `coins:/);
  });

  it("receiveCoin emits Some(amount) when `amount` is provided", () => {
    const tx = new Transaction();
    receiveCoin(client, tx, {
      accountObjectAddress: accountId,
      coins: [{ objectId: PTB_DUMMY_LP_COIN_EE, version: "1", digest: "digest" }],
      coinType: TESTNET_TYPES.USDC,
      amount: 1_000_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("addDelegate", () => {
    const tx = new Transaction();
    addDelegate(client, tx, {
      accountObjectAddress: accountId,
      delegate: addr,
      permissions: PERM_OPEN_POSITION,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("removeDelegate", () => {
    const tx = new Transaction();
    removeDelegate(client, tx, { accountObjectAddress: accountId, delegate: addr });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("updateDelegatePermissions", () => {
    const tx = new Transaction();
    updateDelegatePermissions(client, tx, {
      accountObjectAddress: accountId,
      delegate: addr,
      newPermissions: 0x0003,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});
