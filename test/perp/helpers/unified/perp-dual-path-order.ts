import { ORDER_LIMIT_BUY, ORDER_TAG_WILDCARD } from "../../../../src/constants.ts";
import {
  addPreOrderRequest,
  buildPlaceOrderArgument,
  cancelOrderRequest,
  cancelPreOrderRequest,
  placeOrderRequest,
  updateOrderRequest,
} from "../../../../src/user/order.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import {
  ACCOUNT_ID,
  baseOrderMain,
  caseMutate,
  COLLATERAL_TYPE,
  TICKER,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpOrderDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "buildPlaceOrderArgument",
    (c, tx) => {
      buildPlaceOrderArgument(c, tx, baseOrderMain);
    },
    (p, tx) => {
      p.buildPlaceOrderArgument(tx, baseOrderMain);
    },
  ),
  caseMutate(
    "placeOrderRequest",
    (c, tx) => {
      placeOrderRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        main: baseOrderMain,
      });
    },
    (p, tx) => {
      p.placeOrderRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        main: baseOrderMain,
      });
    },
  ),
  caseMutate(
    "cancelOrderRequest",
    (c, tx) => {
      cancelOrderRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_TAG_WILDCARD,
        orderId: 1n,
        triggerPrice: 0n,
      });
    },
    (p, tx) => {
      p.cancelOrderRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_TAG_WILDCARD,
        orderId: 1n,
        triggerPrice: 0n,
      });
    },
  ),
  caseMutate(
    "updateOrderRequest",
    (c, tx) => {
      updateOrderRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_LIMIT_BUY,
        orderId: 1n,
        currentTriggerPrice: rawPrice(95_000),
        newSize: rawPrice(0.002),
        newTriggerPrice: rawPrice(96_000),
      });
    },
    (p, tx) => {
      p.updateOrderRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_LIMIT_BUY,
        orderId: 1n,
        currentTriggerPrice: rawPrice(95_000),
        newSize: rawPrice(0.002),
        newTriggerPrice: rawPrice(96_000),
      });
    },
  ),
  caseMutate(
    "cancelPreOrderRequest",
    (c, tx) => {
      cancelPreOrderRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        mainOrderId: 1n,
        preOrderId: 2n,
      });
    },
    (p, tx) => {
      p.cancelPreOrderRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        mainOrderId: 1n,
        preOrderId: 2n,
      });
    },
  ),
  caseMutate(
    "addPreOrderRequest",
    (c, tx) => {
      addPreOrderRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
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
    },
    (p, tx) => {
      p.addPreOrderRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
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
    },
  ),
];
