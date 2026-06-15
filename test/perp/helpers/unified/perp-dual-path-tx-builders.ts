import { ORDER_LIMIT_BUY, ORDER_TAG_WILDCARD } from "../../../../src/constants.ts";
import {
  buildAddPreOrderTx,
  buildCancelOrderTx,
  buildCancelPreOrderTx,
  buildCancelRedeemAndStakeWlpTx,
  buildClaimRewardsToAccountTx,
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildExecuteWithdrawalTx,
  buildIncreasePositionTx,
  buildMintAndStakeWlpTx,
  buildMintWlpTx,
  buildPlaceOrderTx,
  buildRedeemVaaTx,
  buildRequestCreditWithdrawTx,
  buildUnstakeAndRequestRedeemWlpTx,
  buildUpdateOrderTx,
  buildWithdrawCollateralTx,
} from "../../../../src/tx-builders.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import { MOCK_CUSTODY_ASSET_TYPE } from "../fixtures/mock-testnet-config.ts";
import {
  ACCOUNT_ID,
  baseOrderMain,
  caseAsyncTx,
  caseFactory,
  COLLATERAL_TYPE,
  commonTxOpts,
  REWARD_TYPE,
  TICKER,
  type PerpDualPathCase,
} from "./perp-dual-path-shared.ts";

export const perpTxBuilderDualPathCases: PerpDualPathCase[] = [
  caseAsyncTx(
    "buildPlaceOrderTx",
    (c) =>
      buildPlaceOrderTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        main: baseOrderMain,
      }),
    (p) =>
      p.buildPlaceOrderTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        main: baseOrderMain,
      }),
  ),
  caseAsyncTx(
    "buildClosePositionTx",
    (c) =>
      buildClosePositionTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      }),
    (p) =>
      p.buildClosePositionTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        acceptablePrice: rawPrice(90_000),
      }),
  ),
  caseAsyncTx(
    "buildIncreasePositionTx",
    (c) =>
      buildIncreasePositionTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        collateralAmount: 1_000_000n,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      }),
    (p) =>
      p.buildIncreasePositionTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        collateralAmount: 1_000_000n,
        size: rawPrice(0.001),
        acceptablePrice: rawPrice(100_000),
      }),
  ),
  caseAsyncTx(
    "buildDecreasePositionTx",
    (c) =>
      buildDecreasePositionTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        size: rawPrice(0.0005),
        acceptablePrice: rawPrice(95_000),
      }),
    (p) =>
      p.buildDecreasePositionTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        size: rawPrice(0.0005),
        acceptablePrice: rawPrice(95_000),
      }),
  ),
  caseAsyncTx(
    "buildDepositCollateralTx",
    (c) =>
      buildDepositCollateralTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        collateralAmount: 1_000_000n,
      }),
    (p) =>
      p.buildDepositCollateralTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        collateralAmount: 1_000_000n,
      }),
  ),
  caseAsyncTx(
    "buildWithdrawCollateralTx",
    (c) =>
      buildWithdrawCollateralTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        amount: 500_000n,
      }),
    (p) =>
      p.buildWithdrawCollateralTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        positionId: 1n,
        amount: 500_000n,
      }),
  ),
  caseAsyncTx(
    "buildCancelOrderTx",
    (c) =>
      buildCancelOrderTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_TAG_WILDCARD,
        orderId: 1n,
        triggerPrice: 0n,
      }),
    (p) =>
      p.buildCancelOrderTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_TAG_WILDCARD,
        orderId: 1n,
        triggerPrice: 0n,
      }),
  ),
  caseAsyncTx(
    "buildUpdateOrderTx",
    (c) =>
      buildUpdateOrderTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_LIMIT_BUY,
        orderId: 1n,
        currentTriggerPrice: rawPrice(95_000),
        newSize: rawPrice(0.002),
        newTriggerPrice: rawPrice(96_000),
      }),
    (p) =>
      p.buildUpdateOrderTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        orderTypeTag: ORDER_LIMIT_BUY,
        orderId: 1n,
        currentTriggerPrice: rawPrice(95_000),
        newSize: rawPrice(0.002),
        newTriggerPrice: rawPrice(96_000),
      }),
  ),
  caseAsyncTx(
    "buildCancelPreOrderTx",
    (c) =>
      buildCancelPreOrderTx(c, {
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        mainOrderId: 1n,
        preOrderId: 2n,
      }),
    (p) =>
      p.buildCancelPreOrderTx({
        ...commonTxOpts,
        ticker: TICKER,
        accountId: ACCOUNT_ID,
        collateralType: COLLATERAL_TYPE,
        mainOrderId: 1n,
        preOrderId: 2n,
      }),
  ),
  caseAsyncTx(
    "buildAddPreOrderTx",
    (c) =>
      buildAddPreOrderTx(c, {
        ...commonTxOpts,
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
      }),
    (p) =>
      p.buildAddPreOrderTx({
        ...commonTxOpts,
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
      }),
  ),
  caseAsyncTx(
    "buildMintWlpTx",
    (c) =>
      buildMintWlpTx(c, {
        accountId: ACCOUNT_ID,
        depositTokenType: COLLATERAL_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        skipOraclePriceRefresh: true,
      }),
    (p) =>
      p.buildMintWlpTx({
        accountId: ACCOUNT_ID,
        depositTokenType: COLLATERAL_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        skipOraclePriceRefresh: true,
      }),
  ),
  caseAsyncTx(
    "buildMintAndStakeWlpTx",
    (c) =>
      buildMintAndStakeWlpTx(c, {
        accountId: ACCOUNT_ID,
        depositTicker: "USDCUSD",
        depositTokenType: COLLATERAL_TYPE,
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        rewarderTypes: [REWARD_TYPE],
        skipOraclePriceRefresh: true,
      }),
    (p) =>
      p.buildMintAndStakeWlpTx({
        accountId: ACCOUNT_ID,
        depositTicker: "USDCUSD",
        depositTokenType: COLLATERAL_TYPE,
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        rewarderTypes: [REWARD_TYPE],
        skipOraclePriceRefresh: true,
      }),
  ),
  caseAsyncTx(
    "buildUnstakeAndRequestRedeemWlpTx",
    (c) =>
      buildUnstakeAndRequestRedeemWlpTx(c, {
        accountId: ACCOUNT_ID,
        redeemTokenType: COLLATERAL_TYPE,
        withdrawalAmount: 500_000n,
        rewarderTypes: [REWARD_TYPE],
        skipOraclePriceRefresh: true,
      }),
    (p) =>
      p.buildUnstakeAndRequestRedeemWlpTx({
        accountId: ACCOUNT_ID,
        redeemTokenType: COLLATERAL_TYPE,
        withdrawalAmount: 500_000n,
        rewarderTypes: [REWARD_TYPE],
        skipOraclePriceRefresh: true,
      }),
  ),
  caseFactory(
    "buildCancelRedeemAndStakeWlpTx",
    (c) =>
      buildCancelRedeemAndStakeWlpTx(c, {
        accountId: ACCOUNT_ID,
        requestId: 1n,
        stakeAmount: 1_000_000n,
        rewarderTypes: [REWARD_TYPE],
      }),
    (p) =>
      p.buildCancelRedeemAndStakeWlpTx({
        accountId: ACCOUNT_ID,
        requestId: 1n,
        stakeAmount: 1_000_000n,
        rewarderTypes: [REWARD_TYPE],
      }),
  ),
  caseFactory(
    "buildClaimRewardsToAccountTx",
    (c) =>
      buildClaimRewardsToAccountTx(c, {
        accountId: ACCOUNT_ID,
        rewarderTypes: [REWARD_TYPE],
      }),
    (p) =>
      p.buildClaimRewardsToAccountTx({
        accountId: ACCOUNT_ID,
        rewarderTypes: [REWARD_TYPE],
      }),
  ),
  caseFactory(
    "buildRedeemVaaTx",
    (c) => buildRedeemVaaTx(c, { vaaBytes: new Uint8Array([0x01]) }),
    (p) => p.buildRedeemVaaTx({ vaaBytes: new Uint8Array([0x01]) }),
  ),
  caseFactory(
    "buildRequestCreditWithdrawTx",
    (c) =>
      buildRequestCreditWithdrawTx(c, {
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
      }),
    (p) =>
      p.buildRequestCreditWithdrawTx({
        accountId: ACCOUNT_ID,
        amount: 1_000n,
        recipient: ACCOUNT_ID,
        route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
      }),
  ),
  caseFactory(
    "buildExecuteWithdrawalTx",
    (c) =>
      buildExecuteWithdrawalTx(c, {
        key: 1n,
        route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
      }),
    (p) =>
      p.buildExecuteWithdrawalTx({
        key: 1n,
        route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
      }),
  ),
];
