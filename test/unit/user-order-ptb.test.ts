import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { ORDER_LIMIT_BUY, ORDER_TAG_WILDCARD } from "../../src/constants.ts";
import {
  addPreOrderRequest,
  cancelOrderRequest,
  cancelPreOrderRequest,
  placeOrderRequest,
  updateOrderRequest,
} from "../../src/user/order.ts";
import { rawPrice } from "../../src/utils/math.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const client = createUnitTestClient();
const accountId = PTB_DUMMY_ACCOUNT_ID;
const collateralType = MOCK_USDC_TYPE;
const ticker = "BTCUSD";

describe("user/order PTB builders (v3)", () => {
  it("buildPlaceOrderArgument + placeOrderRequest (market form)", () => {
    const tx = new Transaction();
    const req = placeOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
        collateralAmount: 10_000_000n,
      },
    });
    expect(req).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("placeOrderRequest with limit trigger + pre-order legs", () => {
    const tx = new Transaction();
    placeOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.001),
        triggerPrice: rawPrice(95_000),
        collateralAmount: 10_000_000n,
      },
      preOrders: [
        {
          isLong: false,
          isStopOrder: true,
          reduceOnly: true,
          size: rawPrice(0.001),
          triggerPrice: rawPrice(110_000),
          collateralAmount: 0n,
        },
      ],
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("cancelOrderRequest wildcard", () => {
    const tx = new Transaction();
    cancelOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      orderTypeTag: ORDER_TAG_WILDCARD,
      orderId: 1n,
      triggerPrice: 0n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("cancelOrderRequest omits optional triggerPrice and orderTypeTag", () => {
    const tx = new Transaction();
    cancelOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      orderId: 42n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("cancelPreOrderRequest + addPreOrderRequest", () => {
    const tx = new Transaction();
    cancelPreOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      mainOrderId: 1n,
      preOrderId: 2n,
    });
    addPreOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      mainOrderId: 1n,
      preOrder: {
        isLong: false,
        isStopOrder: true,
        reduceOnly: true,
        size: rawPrice(0.001),
        triggerPrice: rawPrice(110_000),
        collateralAmount: 0n,
      },
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("updateOrderRequest", () => {
    const tx = new Transaction();
    updateOrderRequest(client, tx, {
      ticker,
      accountId,
      collateralType,
      orderTypeTag: ORDER_LIMIT_BUY,
      orderId: 1n,
      currentTriggerPrice: rawPrice(95_000),
      newSize: rawPrice(0.002),
      newTriggerPrice: rawPrice(96_000),
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});
