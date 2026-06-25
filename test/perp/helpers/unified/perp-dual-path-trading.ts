import { ORDER_LIMIT_BUY } from "../../../../src/constants.ts";
import {
  batchLiquidate,
  closePositionByKeeper,
  closePositionRequest,
  decreasePositionRequest,
  depositCollateralRequest,
  increasePositionRequest,
  liquidate,
  matchOrders,
  openPositionByKeeper,
  updateFundingRate,
  withdrawCollateralRequest,
} from "../../../../src/user/trading.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import { PTB_DUMMY_DEPOSIT_COIN } from "../fixtures/ptb-test-dummies.ts";
import {
  ACCOUNT_ID,
  buildExecuteTradingFacade,
  buildExecuteTradingTx,
  caseFactory,
  caseMutate,
  COLLATERAL_TYPE,
  TICKER,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpTradingDualPathCases: PerpDualPathCase[] = [
  caseMutate(
    "closePositionRequest",
    (c, tx) => {
      closePositionRequest(c, tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      });
    },
    (p, tx) => {
      p.perp.closePositionRequest(tx, {
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      });
    },
  ),
  caseMutate(
    "increasePositionRequest",
    (c, tx) => {
      increasePositionRequest(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        collateralAmount: 1_000_000n,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      });
    },
    (p, tx) => {
      p.perp.increasePositionRequest(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        collateralAmount: 1_000_000n,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      });
    },
  ),
  caseMutate(
    "decreasePositionRequest",
    (c, tx) => {
      decreasePositionRequest(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        size: rawPrice(0.0005),
        acceptablePrice: rawPrice(95_000),
      });
    },
    (p, tx) => {
      p.perp.decreasePositionRequest(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        size: rawPrice(0.0005),
        acceptablePrice: rawPrice(95_000),
      });
    },
  ),
  caseMutate(
    "depositCollateralRequest",
    (c, tx) => {
      depositCollateralRequest(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        collateralAmount: 1_000_000n,
      });
    },
    (p, tx) => {
      p.perp.depositCollateralRequest(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        collateralAmount: 1_000_000n,
      });
    },
  ),
  caseMutate(
    "withdrawCollateralRequest",
    (c, tx) => {
      withdrawCollateralRequest(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        amount: 500_000n,
      });
    },
    (p, tx) => {
      p.perp.withdrawCollateralRequest(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        positionId: 1n,
        amount: 500_000n,
      });
    },
  ),
  caseFactory("executeTrading", buildExecuteTradingTx, buildExecuteTradingFacade),
  caseMutate(
    "liquidate",
    (c, tx) =>
      liquidate(c, tx, { collateralType: COLLATERAL_TYPE, ticker: TICKER, positionId: 1n }),
    (p, tx) =>
      p.perp.liquidate(tx, { collateralType: COLLATERAL_TYPE, ticker: TICKER, positionId: 1n }),
  ),
  caseMutate(
    "batchLiquidate",
    (c, tx) =>
      batchLiquidate(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        pageSize: 10n,
        pageIndex: 0n,
      }),
    (p, tx) =>
      p.perp.batchLiquidate(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        pageSize: 10n,
        pageIndex: 0n,
      }),
  ),
  caseMutate(
    "matchOrders",
    (c, tx) =>
      matchOrders(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        orderTypeTag: ORDER_LIMIT_BUY,
        triggerPrice: rawPrice(65_000),
        maxFills: 1n,
      }),
    (p, tx) =>
      p.perp.matchOrders(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        orderTypeTag: ORDER_LIMIT_BUY,
        triggerPrice: rawPrice(65_000),
        maxFills: 1n,
      }),
  ),
  caseMutate(
    "updateFundingRate",
    (c, tx) => updateFundingRate(c, tx, { ticker: TICKER }),
    (p, tx) => p.perp.updateFundingRate(tx, { ticker: TICKER }),
  ),
  caseMutate(
    "openPositionByKeeper",
    (c, tx) => {
      openPositionByKeeper(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountObjectAddress: ACCOUNT_ID,
        collateralCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        isLong: true,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      });
    },
    (p, tx) => {
      p.perp.openPositionByKeeper(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        accountObjectAddress: ACCOUNT_ID,
        collateralCoin: tx.object(PTB_DUMMY_DEPOSIT_COIN),
        isLong: true,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      });
    },
  ),
  caseMutate(
    "closePositionByKeeper",
    (c, tx) =>
      closePositionByKeeper(c, tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      }),
    (p, tx) =>
      p.perp.closePositionByKeeper(tx, {
        collateralType: COLLATERAL_TYPE,
        ticker: TICKER,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      }),
  ),
];
