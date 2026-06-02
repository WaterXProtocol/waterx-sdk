import { Transaction } from "@mysten/sui/transactions";
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
} from "~predict/admin.ts";
import { describe, expect, it } from "vitest";

import { PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

describe("admin PTB builders", () => {
  const client = createMockPredictClient();

  it("createMarketRegistry", () => {
    const tx = new Transaction();
    createMarketRegistry(client, tx, { adminCap: PTB_DUMMY.adminCap });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("depositSettlement", () => {
    const tx = new Transaction();
    depositSettlement(client, tx, { adminCap: PTB_DUMMY.adminCap, payment: PTB_DUMMY.coin });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("adminWithdraw", () => {
    const tx = new Transaction();
    adminWithdraw(client, tx, {
      adminCap: PTB_DUMMY.adminCap,
      amount: 1n,
      recipient: PTB_DUMMY.recipient,
    });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("setMinReserve", () => {
    const tx = new Transaction();
    setMinReserve(client, tx, { adminCap: PTB_DUMMY.adminCap, newReserve: 2n });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("setOrderCancelCooldownMs", () => {
    const tx = new Transaction();
    setOrderCancelCooldownMs(client, tx, { adminCap: PTB_DUMMY.adminCap, cooldownMs: 100n });
    expect(listMoveCalls(tx)).toMatchSnapshot();
  });

  it("pauseMarket / unpauseMarket", () => {
    const txPause = new Transaction();
    pauseMarket(client, txPause, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" });
    expect(listMoveCalls(txPause)).toMatchSnapshot();

    const txUnpause = new Transaction();
    unpauseMarket(client, txUnpause, { adminCap: PTB_DUMMY.adminCap, marketId: "0xab" });
    expect(listMoveCalls(txUnpause)).toMatchSnapshot();
  });

  it("addKeeper / removeKeeper", () => {
    const txAdd = new Transaction();
    addKeeper(client, txAdd, {
      adminCap: PTB_DUMMY.adminCap,
      keeper: PTB_DUMMY.delegate,
    });
    expect(listMoveCalls(txAdd)).toMatchSnapshot();

    const txRm = new Transaction();
    removeKeeper(client, txRm, {
      adminCap: PTB_DUMMY.adminCap,
      keeper: PTB_DUMMY.delegate,
    });
    expect(listMoveCalls(txRm)).toMatchSnapshot();
  });
});
