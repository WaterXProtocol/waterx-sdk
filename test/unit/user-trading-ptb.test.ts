/**
 * Exercise trading.request → execute → destroy_response wiring (dummy price args).
 */
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { TESTNET_TYPES } from "../../src/constants.ts";
import {
  closePosition,
  decreasePosition,
  depositCollateral,
  increasePosition,
  liquidate,
  matchOrders,
  openPosition,
  openPositionByManager,
  updateFundingRate,
  withdrawCollateral,
} from "../../src/user/trading.ts";
import {
  dummyBucketFloatPricePair,
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_RECEIVING_COINS,
} from "../helpers/ptb-test-dummies.ts";

const client = WaterXClient.testnet();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const receivingCoins = PTB_DUMMY_RECEIVING_COINS;

describe("user/trading PTB builders", () => {
  it("updateFundingRate", () => {
    const tx = new Transaction();
    const { base: basePriceResult } = dummyBucketFloatPricePair(tx);
    updateFundingRate(client, tx, {
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      basePriceResult,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("matchOrders", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    matchOrders(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      orderTypeTag: 0,
      triggerPrice: 65_000n,
      maxFills: 1n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("openPosition", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    openPosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 100_000_000n,
      isLong: true,
      size: 5000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("openPosition passes TransactionArgument size through to request", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    const sizeArg = tx.pure.u64(4242n);
    openPosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 100_000_000n,
      isLong: true,
      size: sizeArg,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("openPositionByManager", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    openPositionByManager(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      collateralCoin: PTB_DUMMY_DEPOSIT_COIN,
      isLong: true,
      size: 5000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    // senderRequest + open_position_request_by_keeper + execute + destroy_response + transferObjects
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("openPositionByManager uses TransactionArgument collateral coin and size", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    openPositionByManager(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      collateralCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
      isLong: true,
      size: tx.pure.u64(777n),
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("closePosition", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    closePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      acceptablePrice: 0n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("increasePosition", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    increasePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      receivingCoins,
      collateralAmount: 5_000_000n,
      size: 1000n,
      acceptablePrice: 0n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("increasePosition passes TransactionArgument size through", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    increasePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      receivingCoins,
      collateralAmount: 5_000_000n,
      size: tx.pure.u64(333n),
      acceptablePrice: 0n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("decreasePosition", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    decreasePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      size: 500n,
      acceptablePrice: 0n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("decreasePosition passes TransactionArgument size at runtime", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    decreasePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      size: tx.pure.u64(444n) as unknown as bigint,
      acceptablePrice: 0n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("depositCollateral", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    depositCollateral(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      receivingCoins,
      collateralAmount: 10_000_000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("withdrawCollateral", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    withdrawCollateral(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      amount: 1_000_000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });

  it("liquidate", () => {
    const tx = new Transaction();
    const { base, collateral } = dummyBucketFloatPricePair(tx);
    liquidate(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(5);
  });
});
