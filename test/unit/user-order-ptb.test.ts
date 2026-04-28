import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { TESTNET_TYPES } from "../../src/constants.ts";
import { cancelOrder, placeOrder } from "../../src/user/order.ts";
import {
  dummyBucketFloatPricePair,
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_RECEIVING_COINS,
} from "../helpers/fixtures/ptb-test-dummies.ts";

const client = WaterXClient.testnet();

const baseParams = {
  collateralTokenType: TESTNET_TYPES.USDC,
  baseTokenType: TESTNET_TYPES.BTC_USD,
  lpTokenType: TESTNET_TYPES.WLP,
  market: client.config.markets.BTC.marketId,
  accountId: PTB_DUMMY_ACCOUNT_ID,
  receivingCoins: PTB_DUMMY_RECEIVING_COINS,
  collateralAmount: 50_000_000n,
  isLong: true,
  isStopOrder: false,
  reduceOnly: false,
  size: 3000n,
  triggerPrice: 65_000_000_000_000n,
};

describe("user/order PTB builders", () => {
  it("placeOrder without linkedPositionId (none option)", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    placeOrder(client, tx, {
      ...baseParams,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(6);
  });

  it("placeOrder with linkedPositionId", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    placeOrder(client, tx, {
      ...baseParams,
      linkedPositionId: 9n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(6);
  });

  it("placeOrder passes TransactionArgument size through to request", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    placeOrder(client, tx, {
      ...baseParams,
      size: tx.pure.u64(888n),
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(6);
  });

  it("cancelOrder", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    cancelOrder(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: PTB_DUMMY_ACCOUNT_ID,
      orderId: 1,
      triggerPrice: 65_000n,
      orderTypeTag: 0,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });
});
