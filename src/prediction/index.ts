export { PredictClient } from "./client.ts";
export type { CreateClientOptions } from "./client.ts";
export { clearConfigCache, defaultConfigUrl, loadConfig } from "./config.ts";
export type {
  LoadConfigOptions,
  WaterxAccountPackage,
  WaterxConfigPackageBase,
  WaterxPredictionConfig,
  WaterxPredictionConfigPackages,
  WaterxPredictionGiftPackage,
  WaterxPredictionPackage,
  WaterxReferralPackage,
} from "./config.ts";
export * from "./constants.ts";
export * from "./types.ts";
export * as user from "./user/index.ts";
export * as utils from "./utils/index.ts";

export {
  addDelegate,
  allowPredictionProtocolAsset,
  consumeDepositDirect,
  consumeWithdrawDirect,
  createAccount,
  deposit,
  disallowPredictionProtocolAsset,
  removeDelegate,
  resolveRegistryAccountId,
  requestDeposit,
  requestDepositFromReceivings,
  requestWithdraw,
  setDelegatePredictionPermission,
  transferCoinToAccount,
  whitelistPredictionProtocol,
  withdraw,
} from "./account.ts";
export type {
  AddDelegateParams,
  ConsumeDepositDirectParams,
  CreateAccountParams,
  ConsumeWithdrawDirectParams,
  PredictionProtocolAssetParams,
  RemoveDelegateParams,
  RequestDepositFromReceivingsParams,
  RequestDepositParams,
  RequestWithdrawParams,
  SetDelegatePredictionPermissionParams,
  TransferCoinToAccountParams,
  WhitelistPredictionProtocolParams,
} from "./account.ts";

export {
  addKeeper,
  adminWithdraw,
  createMarketRegistry,
  depositSettlement,
  pauseMarket,
  removeKeeper,
  setMinReserve,
  setOrderCancelCooldownMs,
  unpauseMarket,
} from "./admin.ts";
export type {
  AdminWithdrawParams,
  CreateMarketRegistryParams,
  DepositSettlementParams,
  KeeperAdminParams,
  MarketPauseParams,
  SetMinReserveParams,
  SetOrderCancelCooldownParams,
} from "./admin.ts";

export {
  adminPlaceOrderFor,
  batchClaim,
  batchForceClaim,
  buildBatchForceClaimTransactions,
  cancelClose,
  cancelOrder,
  claim,
  confirmClose,
  fillOrder,
  forceClaim,
  outcomeArg,
  placeOrder,
  requestClose,
  resolveMarket,
  selectionArg,
  selfCancelClose,
  selfCancelOrder,
} from "./prediction.ts";
export type {
  AdminPlaceOrderForParams,
  BatchClaimParams,
  BatchForceClaimParams,
  BuildBatchForceClaimTransactionsParams,
  CancelCloseParams,
  CancelOrderParams,
  ClaimParams,
  ConfirmCloseParams,
  FillOrderParams,
  ForceClaimParams,
  PlaceOrderParams,
  RequestCloseParams,
  ResolveMarketParams,
  SelfCancelCloseParams,
  SelfCancelOrderParams,
} from "./prediction.ts";

export {
  buildBatchClaimTx,
  buildPlaceOrderTx,
} from "./tx-builders.ts";
export type {
  BuildBatchClaimTxParams,
  BuildPlaceOrderTxParams,
  PredictCommonBuildOpts,
} from "./tx-builders.ts";

export {
  getAccountData,
  getAccountIds,
  getAccountOrderIds,
  getAccountOrderIdsByMarketId,
  getAccountPositionIds,
  getAccountPositionIdsByMarketId,
  getKeeperAddresses,
  getAllowedVersions,
  getMarketExposure,
  getMarketExposureByKey,
  getMarketById,
  getMarketByKey,
  getOrder,
  getOrderCursor,
  getPosition,
  getPositionCursor,
  getRegistry,
  getResolvedMarketCursor,
  getUnresolvedMarketCursor,
  isKeeper,
  isPredictionProtocolAssetAllowed,
} from "./fetch.ts";
export type { GetAccountIdsParams, ViewBaseParams } from "./fetch.ts";

export {
  base64UrlNoPadDecode,
  base64UrlNoPadEncode,
  buildClaimShareFlow,
  buildCreateGiftFlow,
  buildGiftClaimMessage,
  claimShare,
  createGift,
  deleteGift,
  deriveGiftAddress,
  deriveGiftKeypair,
  encodeGiftUrl,
  generateGiftSeed,
  getCreatorGiftCount,
  getCreatorGiftIds,
  getGift,
  getGiftConfigPaused,
  getGiftControllerAddress,
  getGiftHasClaimed,
  parseGiftUrl,
  signGiftClaim,
} from "./gift.ts";
export type {
  BuildClaimShareFlowParams,
  BuildClaimShareFlowResult,
  BuildCreateGiftFlowResult,
  ClaimShareParams,
  CreateGiftParams,
  DeleteGiftParams,
  GiftBaseParams,
  GiftReferralParams,
  GiftUrlParts,
  GiftView,
} from "./gift.ts";

export * as bucketFrameworkAccountCalls from "./generated/bucket_v2_framework/account.ts";
export * as waterxAccountCalls from "./generated/waterx_account/account.ts";
export * as predictionAccountDataCalls from "./generated/waterx_prediction/account_data.ts";
export * as predictionGlobalConfigCalls from "./generated/waterx_prediction/global_config.ts";
export * as predictionOutcomeCalls from "./generated/waterx_prediction/outcome.ts";
export * as predictionPositionCalls from "./generated/waterx_prediction/position.ts";
export * as predictionVersionCalls from "./generated/waterx_prediction/version.ts";
export * as predictionViewCalls from "./generated/waterx_prediction/view.ts";
export * as predictionCalls from "./generated/waterx_prediction/waterx_prediction.ts";
