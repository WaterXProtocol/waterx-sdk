import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { ORDER_LIMIT_BUY } from "../../src/constants.ts";
import { rawPrice } from "../../src/utils/math.ts";
import {
  batchLiquidate,
  closePositionByKeeper,
  closePositionRequest,
  decreasePositionRequest,
  depositCollateralRequest,
  executeTrading,
  increasePositionRequest,
  liquidate,
  matchOrders,
  openPositionByKeeper,
  updateFundingRate,
  withdrawCollateralRequest,
} from "../../src/user/trading.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const collateralType = MOCK_USDC_TYPE;
const ticker = "BTCUSD";

describe("user/trading PTB builders (v3)", () => {
  it("updateFundingRate", () => {
    const tx = new Transaction();
    updateFundingRate(client, tx, { ticker });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("matchOrders", () => {
    const tx = new Transaction();
    matchOrders(client, tx, {
      collateralType,
      ticker,
      orderTypeTag: ORDER_LIMIT_BUY,
      triggerPrice: rawPrice(65_000),
      maxFills: 1n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("liquidate + batchLiquidate", () => {
    const tx1 = new Transaction();
    liquidate(client, tx1, { collateralType, ticker, positionId: 1n });
    expect(tx1.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const tx2 = new Transaction();
    batchLiquidate(client, tx2, {
      collateralType,
      ticker,
      pageSize: 10n,
      pageIndex: 0n,
    });
    expect(tx2.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("openPositionByKeeper", () => {
    const tx = new Transaction();
    const coin = tx.object(PTB_DUMMY_DEPOSIT_COIN);
    openPositionByKeeper(client, tx, {
      collateralType,
      ticker,
      accountObjectAddress: accountId,
      collateralCoin: coin,
      isLong: true,
      size: rawPrice(0.001),
      acceptablePrice: rawPrice(100_000),
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("closePositionByKeeper", () => {
    const tx = new Transaction();
    closePositionByKeeper(client, tx, {
      collateralType,
      ticker,
      positionId: 1n,
      acceptablePrice: rawPrice(90_000),
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("request + executeTrading wiring", () => {
    const tx = new Transaction();
    const req = increasePositionRequest(client, tx, {
      collateralType,
      ticker,
      accountId,
      positionId: 1n,
      collateralAmount: 1_000_000n,
      size: rawPrice(0.001),
      acceptablePrice: rawPrice(100_000),
    });
    executeTrading(client, tx, { collateralType, ticker, request: req });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("decrease / deposit / withdraw collateral requests", () => {
    const tx = new Transaction();
    decreasePositionRequest(client, tx, {
      collateralType,
      ticker,
      accountId,
      positionId: 1n,
      size: rawPrice(0.0005),
      acceptablePrice: rawPrice(95_000),
    });
    depositCollateralRequest(client, tx, {
      collateralType,
      ticker,
      accountId,
      positionId: 1n,
      collateralAmount: 1_000_000n,
    });
    withdrawCollateralRequest(client, tx, {
      collateralType,
      ticker,
      accountId,
      positionId: 1n,
      amount: 500_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("closePositionRequest returns hot potato", () => {
    const tx = new Transaction();
    const req = closePositionRequest(client, tx, {
      collateralType,
      ticker,
      accountId,
      positionId: 1n,
      acceptablePrice: rawPrice(50_000),
    });
    expect(req).toBeDefined();
  });
});
