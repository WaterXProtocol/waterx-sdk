// ======== Core ========
export { WaterXClient, createMainnetConfig, createTestnetConfig } from "./client.ts";
export type { WaterXConfig, MarketEntry } from "./client.ts";
export {
  MAINNET_PACKAGE_IDS,
  MAINNET_TYPES,
  MAINNET_OBJECTS,
  MAINNET_MARKETS,
  MAINNET_COLLATERALS,
  TESTNET_PACKAGE_IDS,
  TESTNET_OBJECTS,
  TESTNET_TYPES,
  TESTNET_MARKETS,
  TESTNET_COLLATERALS,
  PYTH_STATE_ID,
  PYTH_WORMHOLE_STATE_ID,
  PYTH_HERMES_ENDPOINT,
  PYTH_PRICE_FEED_IDS,
  PYTH_TESTNET_FEED_IDS,
  SENDER,
  // Permission constants
  PERM_OPEN_POSITION,
  PERM_CLOSE_POSITION,
  PERM_PLACE_ORDER,
  PERM_CANCEL_ORDER,
  PERM_INCREASE_COLLATERAL,
  PERM_RELEASE_COLLATERAL,
  PERM_DEPOSIT,
  PERM_WITHDRAW,
  PERM_TRANSFER,
  PERM_MINT_WLP,
  PERM_REDEEM_WLP,
  PERM_MANAGE_DELEGATES,
  PERM_ALL_TRADING,
  PERM_ALL,
  // Order type tags
  ORDER_LIMIT_BUY,
  ORDER_LIMIT_SELL,
  ORDER_STOP_BUY,
  ORDER_STOP_SELL,
} from "./constants.ts";
export type {
  BaseAsset,
  CollateralAsset,
  ExtendedBaseAsset,
  LegacyBaseAsset,
} from "./constants.ts";

// ======== Transaction Builders (User Actions) ========
export {
  // Trading
  openPosition,
  openPositionByManager,
  closePosition,
  increasePosition,
  decreasePosition,
  depositCollateral,
  withdrawCollateral,
  liquidate,
  matchOrders,
  updateFundingRate,
  executeTradingRequest,
  destroyTradingResponse,
  // Orders
  placeOrder,
  cancelOrder,
  // WLP Pool
  mintWlpCoin,
  mintWlp,
  requestRedeemWlp,
  cancelRedeemWlp,
  settleRedeemWlp,
  // Account (TTO pattern)
  createAccount,
  transferToAccount,
  receiveCoin,
  addDelegate,
  removeDelegate,
  updateDelegatePermissions,
  // Referral
  setReferralCode,
  useReferralCode,
  // Reward Distributor
  redeemRewardDistributorCoin,
  stakeRewardDistributor,
  unstakeRewardDistributor,
  claimRewardDistributor,
} from "./user/index.ts";
export type {
  MintWlpCoinParams,
  OpenPositionParams,
  OpenPositionByManagerParams,
  ClosePositionParams,
  IncreasePositionParams,
  DecreasePositionParams,
  DepositCollateralParams,
  WithdrawCollateralParams,
  LiquidateParams,
  MatchOrdersParams,
  UpdateFundingRateParams,
  CoinForReceiving,
  PlaceOrderParams,
  CancelOrderParams,
  MintWlpParams,
  RequestRedeemWlpParams,
  CancelRedeemWlpParams,
  SettleRedeemWlpParams,
  SetReferralCodeParams,
  UseReferralCodeParams,
  CreateAccountParams,
  AddDelegateParams,
  RemoveDelegateParams,
  UpdateDelegatePermissionsParams,
  RedeemRewardDistributorCoinParams,
  StakeRewardDistributorParams,
  UnstakeRewardDistributorParams,
  ClaimRewardDistributorParams,
} from "./user/index.ts";

// ======== View Functions (gRPC simulateTransaction reads) ========
export {
  getAccountsByOwner,
  getAccountDelegates,
  getAccountObjectId,
  getAccountCoins,
  getAccountBalance,
  selectCoinsForAmount,
  getMarketSummary,
  getMarketCooldownMs,
  getPoolSummary,
  getTokenPoolSummary,
  getPosition,
  positionExists,
  calculateRewardDistributorApr,
  calculateRewardDistributorIncentive,
  getRewardDistributorStakeData,
  // Enriched view functions
  getAccountPositions,
  getAllAccountPositions,
  getAccountOrders,
  getAllAccountOrders,
  getMarketPositions,
  getMarketOrders,
  getRedeemRequests,
} from "./fetch.ts";

// ======== View Types ========
export type {
  AccountData,
  DelegateData,
  PositionDataView,
  OrderDataView,
  MarketData,
  PoolData,
  TokenPoolData,
  RedeemRequestDataView,
  RewardDistributorAprQuote,
  RewardDistributorStakeData,
  // v1 → v2 compat aliases (deprecated)
  AccountInfo,
  DelegateDetail,
  PositionInfoView,
  MarketSummary,
  PoolSummary,
  TokenPoolSummary,
} from "./view-types.ts";

// ======== Generated BCS Types (sui-ts-codegen) ========
// View structs — for BCS deserialization of simulateTransaction returns
export {
  AccountData as AccountDataBcs,
  DelegateData as DelegateDataBcs,
  PositionData as PositionDataBcs,
  OrderData as OrderDataBcs,
  MarketData as MarketDataBcs,
  PoolData as PoolDataBcs,
  TokenPoolData as TokenPoolDataBcs,
  RedeemRequestData as RedeemRequestDataBcs,
  // v1 → v2 BCS aliases (deprecated — underlying wire shape matches the v2 struct)
  /** @deprecated Use `AccountDataBcs`. */
  AccountData as AccountInfoBcs,
  /** @deprecated Use `DelegateDataBcs`. */
  DelegateData as DelegateDetailBcs,
  /** @deprecated Use `PositionDataBcs`. */
  PositionData as PositionInfoBcs,
  /** @deprecated Use `MarketDataBcs`. */
  MarketData as MarketSummaryBcs,
  /** @deprecated Use `PoolDataBcs`. */
  PoolData as PoolSummaryBcs,
  /** @deprecated Use `TokenPoolDataBcs`. */
  TokenPoolData as TokenPoolSummaryBcs,
} from "./generated/waterx_perp/view.ts";
// On-chain object structs — for parsing object BCS content
export { Position as PositionBcs, Order as OrderBcs } from "./generated/waterx_perp/position.ts";
export { Market as MarketBcs } from "./generated/waterx_perp/trading.ts";
export { MarketConfig as MarketConfigBcs } from "./generated/waterx_perp/market_config.ts";
// Generated moveCall helpers — typed wrappers for all contract functions
export * as viewCalls from "./generated/waterx_perp/view.ts";
export * as tradingCalls from "./generated/waterx_perp/trading.ts";
export * as lpPoolCalls from "./generated/waterx_perp/lp_pool.ts";
export * as userAccountCalls from "./generated/waterx_perp/user_account.ts";
export * as referralTableCalls from "./generated/waterx_perp/referral_table.ts";
export * as rewardDistributorCalls from "./generated/reward_distributor/reward_distributor.ts";

// ======== Pyth Oracle Utils ========
export {
  fetchPriceFeedsUpdateData,
  buildPythPriceUpdateCalls,
  updatePythPrices,
  buildPythRuleFeedCalls,
  PythCache,
} from "./utils/pyth.ts";
export type { PythConfig } from "./utils/pyth.ts";
export { buildReceivingVector } from "./utils/receiving.ts";

// ======== High-level Transaction Builders ========
export {
  buildOracleFeed,
  refreshAllPoolTokensAndGetDepositPriceResult,
  buildResolveSize,
  buildResolveOrderSize,
  buildOpenPositionTx,
  buildOpenPositionByManagerTx,
  buildClosePositionTx,
  buildIncreasePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildWithdrawCollateralTx,
  buildPlaceOrderTx,
  buildPlaceTpSlTx,
  buildCancelOrderTx,
  buildMintWlpTx,
  buildMintAndStakeWlpTx,
  buildRequestRedeemWlpTx,
  buildCancelRedeemWlpTx,
  buildSettleRedeemWlpTx,
  buildStakeRewardDistributorTx,
  buildUnstakeRewardDistributorTx,
  buildClaimRewardDistributorTx,
  buildUnstakeAndRequestRedeemWlpTx,
  buildTransferToAccountTx,
  buildReceiveCoinTx,
  buildLiquidateTx,
  buildBatchLiquidateTx,
  buildMatchOrdersTx,
  buildUpdateFundingRateTx,
  addPriceFeeds,
  reimburseSponsorFund,
} from "./tx-builders.ts";
export type {
  BuildOpenPositionParams,
  BuildOpenPositionByManagerParams,
  BuildClosePositionParams,
  BuildIncreasePositionParams,
  BuildDecreasePositionParams,
  BuildDepositCollateralParams,
  BuildWithdrawCollateralParams,
  BuildPlaceOrderParams,
  BuildPlaceTpSlParams,
  BuildCancelOrderParams,
  BuildMintWlpParams,
  BuildMintAndStakeWlpTxParams,
  BuildRequestRedeemWlpParams,
  BuildCancelRedeemWlpParams,
  BuildSettleRedeemWlpParams,
  BuildStakeRewardDistributorTxParams,
  BuildUnstakeRewardDistributorTxParams,
  BuildClaimRewardDistributorTxParams,
  BuildUnstakeAndRequestRedeemWlpTxParams,
  BuildTransferToAccountParams,
  BuildReceiveCoinParams,
  BuildLiquidateTxParams,
  BuildBatchLiquidateTxParams,
  BuildMatchOrdersTxParams,
  BuildUpdateFundingRateTxParams,
} from "./tx-builders.ts";
