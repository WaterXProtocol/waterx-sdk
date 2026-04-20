import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { TESTNET_TYPES } from "../../src/constants.ts";
import {
  cancelRedeemWlp,
  mintWlp,
  mintWlpCoin,
  requestRedeemWlp,
  settleRedeemWlp,
} from "../../src/user/wlp.ts";
import {
  dummyBucketFloatPriceResult,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_LP_COIN_DD,
  PTB_DUMMY_LP_COIN_EE,
  PTB_DUMMY_RECIPIENT,
} from "../helpers/ptb-test-dummies.ts";

const client = WaterXClient.testnet();

function getCommandKinds(tx: Transaction) {
  return (tx.getData().commands ?? []).map((command) => command.$kind);
}

describe("user/wlp PTB builders", () => {
  it("mintWlpCoin returns a coin without transferring it", () => {
    const tx = new Transaction();
    const priceResult = dummyBucketFloatPriceResult(tx);

    const lpCoin = mintWlpCoin(client, tx, {
      depositTokenType: TESTNET_TYPES.USDC,
      lpTokenType: TESTNET_TYPES.WLP,
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
      priceResult,
      minLpAmount: 1n,
    });

    expect(lpCoin).toBeDefined();
    expect(getCommandKinds(tx)).toEqual(["MoveCall", "MoveCall"]);
  });

  it("mintWlp with string coin id", () => {
    const tx = new Transaction();
    const priceResult = dummyBucketFloatPriceResult(tx);
    mintWlp(client, tx, {
      depositTokenType: TESTNET_TYPES.USDC,
      lpTokenType: TESTNET_TYPES.WLP,
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
      priceResult,
      minLpAmount: 1n,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    expect(getCommandKinds(tx)).toEqual(["MoveCall", "MoveCall", "TransferObjects"]);
  });

  it("mintWlp with TransactionArgument coin", () => {
    const tx = new Transaction();
    const priceResult = dummyBucketFloatPriceResult(tx);
    const c = tx.object(PTB_DUMMY_COIN_CC);
    mintWlp(client, tx, {
      depositTokenType: TESTNET_TYPES.USDC,
      lpTokenType: TESTNET_TYPES.WLP,
      depositCoin: c,
      priceResult,
      minLpAmount: 100,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    expect(getCommandKinds(tx)).toEqual(["MoveCall", "MoveCall", "TransferObjects"]);
  });

  it("requestRedeemWlp string vs argument", () => {
    const tx1 = new Transaction();
    requestRedeemWlp(client, tx1, {
      redeemTokenType: TESTNET_TYPES.USDC,
      lpTokenType: TESTNET_TYPES.WLP,
      lpCoin: PTB_DUMMY_LP_COIN_DD,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    expect(tx1.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx2 = new Transaction();
    const lp = tx2.object(PTB_DUMMY_LP_COIN_EE);
    requestRedeemWlp(client, tx2, {
      redeemTokenType: TESTNET_TYPES.USDC,
      lpTokenType: TESTNET_TYPES.WLP,
      lpCoin: lp,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    expect(tx2.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("cancelRedeemWlp", () => {
    const tx = new Transaction();
    cancelRedeemWlp(client, tx, {
      lpTokenType: TESTNET_TYPES.WLP,
      requestId: 42n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("settleRedeemWlp", () => {
    const tx = new Transaction();
    const priceResult = dummyBucketFloatPriceResult(tx);
    settleRedeemWlp(client, tx, {
      lpTokenType: TESTNET_TYPES.WLP,
      redeemTokenType: TESTNET_TYPES.USDC,
      priceResult,
      requestId: 7,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});
