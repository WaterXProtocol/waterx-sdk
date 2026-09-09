// ======== Core ========
export { PerpClient } from "./client.ts";
export type { CreateClientOptions } from "./client.ts";
// Deployment config — ONE loader over the canonical `waterx-config` document,
// shared by both lines (`src/config.ts`); the parsed document IS `client.config`.
export {
  REQUIRED_PACKAGES,
  assertRequiredPackages,
  clearConfigCache,
  loadConfig,
  parseConfigDocument,
} from "../config.ts";
export type {
  LoadConfigOptions,
  NativeCustodyAsset,
  PackageEntry,
  PerpMarketEntry,
  RequiredPackage,
  RewarderEntry,
  WaterXConfig,
} from "../config.ts";
export { WORMHOLE_DEFAULTS } from "../account/config.ts";
/** Public fullnode default per network — what a client uses when `grpcUrl` is unset. */
export { DEFAULT_GRPC_URLS } from "../base-client.ts";
export type { WormholeInfraConfig } from "../account/config.ts";
export type { PythAccessConfig, PythFetchPolicy, WaterxAccessConfig } from "../oracle/config.ts";

// ======== Constants & enums ========
export {
  ACTION_ADD_PRE_ORDER,
  ACTION_CANCEL_ORDER,
  ACTION_CANCEL_PRE_ORDER,
  ACTION_CLOSE_POSITION,
  ACTION_DECREASE_POSITION,
  ACTION_DEPOSIT_COLLATERAL,
  ACTION_INCREASE_POSITION,
  ACTION_LIQUIDATE,
  ACTION_OPEN_POSITION,
  ACTION_PLACE_ORDER,
  ACTION_UPDATE_ORDER,
  ACTION_WITHDRAW_COLLATERAL,
  BPS_SCALE,
  DOUBLE_SCALE,
  DRY_RUN_SENDER,
  FLOAT_SCALE,
  ORDER_LIMIT_BUY,
  ORDER_LIMIT_SELL,
  ORDER_STOP_BUY,
  ORDER_STOP_SELL,
  ORDER_TAG_WILDCARD,
  PERM_ALL,
  PERM_ALL_TRADING,
  PERM_CANCEL_ORDER,
  PERM_CLOSE_POSITION,
  PERM_DECREASE_POSITION,
  PERM_DEPOSIT_COLLATERAL,
  PERM_INCREASE_POSITION,
  PERM_MINT_WLP,
  PERM_OPEN_POSITION,
  PERM_PLACE_ORDER,
  PERM_REDEEM_WLP,
  PERM_WITHDRAW_COLLATERAL,
  STAKING_PERM_DEPOSIT_STAKE,
  STAKING_PERM_REDEEM_STAKE,
  STAKING_PERM_CLAIM_REWARD,
  STAKING_PERM_ALL,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_YEAR,
  SUI_DECIMALS,
  WLP_DECIMALS,
  COLLATERAL_DECIMALS,
  TOKEN_DECIMALS,
} from "./constants.ts";
export type { Network } from "./constants.ts";

// ======== Utilities ========
export { getMarketTickers } from "../utils/config.ts";
export {
  annualizedApyFromRatio,
  annualizeFundingRate,
  calcBorrowRate,
  calcBorrowRateAccrual,
  calcDynamicFeeBps,
  calcEffectiveCollateralUsd,
  calcEstLiqPrice,
  calcEstLiqPriceRaw,
  calcFee,
  calcFundingFeeUsd,
  calcFundingRate,
  calcImpactFeeRate,
  calcLeverage,
  calcMaxReducibleCollateralUsd,
  calcNotional,
  calcPositionBorrowFee,
  calcRealLiqNetCostUsd,
  calcTokenUtilizationBps,
  calcTotalTradingFeeRate,
  calcUnrealizedPnl,
  calcViewEstLiqFeesUsd,
  calcWlpIncentiveApy,
  calcWlpMintOut,
  calcWlpPrice,
  calcWlpRedeemOut,
  decodeFundingIndexDelta,
  rawPrice,
} from "../utils/math.ts";
export type { ExactDecimalUsd, LiqFeeBundle, RawPriceInput } from "../utils/math.ts";
export { formatFundingInterval } from "../utils/format.ts";
export { calcEstLiqPriceRawFromView } from "./liq-view.ts";
export type { EstLiqPriceViewOpts } from "./liq-view.ts";

// ======== Transaction builders (user-side) ========
export * from "./user/index.ts";

// ======== High-level Tx builders ========
export * from "./tx-builders.ts";

// ======== Read-only queries ========
export * from "./fetch.ts";

// ======== Oracle utilities (sources + rule aggregation + read planes) ========
export {
  FetchPolicyError,
  LazerApiKeyMissingError,
  LazerNotEntitledError,
  OracleTickerUnservedError,
  OracleWeightCoverageError,
  OracleWeightUnreadableError,
  OracleSourceNotImplementedError,
  aggregateTicker,
  aggregateTickerWithConstant,
  ORACLE_SOURCES,
  assertOracleWeightCoverage,
  assertOracleWriteCoverage,
  fetchPythProHistory,
  fetchPythSymbolCatalog,
  fetchWaterxSignedLeaves,
  fetchWaterxSignedUpdate,
  fetchWaterxUpdateData,
  getMarketStatus,
  isFreshWaterxEntry,
  deriveOracleSources,
  missingOracleCredentials,
  parsePythSchedule,
  PythProHistoryError,
  PythScheduleParseError,
  // THE quote-center route ladder (leaves-first, envelope only where there is
  // no leaf route). Both SDK planes go through it, so a consumer running its
  // own prefetch reaches for the same one rather than re-deriving the ladder.
  pullWaterxQuotes,
  readLazerPrices,
  readPlanTickers,
  readQuoteCenterPrices,
  refreshOraclePrices,
  resolveOracleReadPlan,
  resolveOracleRule,
  // `refreshOraclePrices`' OWN acceptance predicate. Consumers filtering a
  // ticker list before a build must use this rather than re-deriving "some
  // listed source carries it", or they drift from what the build accepts.
  servableTickers,
  WATERX_MAX_PRICE_AGE_MS,
  waterxEnvelopeOf,
  // Leaves are the DEFAULT waterx wire shape, so their accessor + parser belong
  // on the same surface as `waterxEnvelopeOf` (and on the root, which re-exports
  // this file). A prefetch cache written against the envelope-only surface would
  // otherwise get `null` from its only accessor on the normal path and have to
  // discover `@waterx/sdk/oracle` to fix it.
  waterxLeavesOf,
  parseSignedLeaves,
  MERKLE_ROOT_INTENT,
  waterxQuoteCenterEndpoint,
} from "../oracle/index.ts";
export type {
  FetchPolicy,
  HolidayDate,
  MarketStatusResult,
  OracleCredentialKind,
  OraclePriceEntry,
  // The return type of the exported `refreshOraclePrices` /
  // `refreshWlpPoolOracles` — a consumer inspecting `skipped` (the whole point
  // of the return value) must be able to name it.
  OracleRefreshSummary,
  OracleReadPlan,
  OracleSource,
  ParsedPythSchedule,
  PythSymbolRecord,
  TradingHours,
  TradingSession,
  UpdateDataProvider,
  // Payload types for the update-data cache seam: a consumer implementing
  // `UpdateDataProvider` has to name what it caches, in either shape.
  WaterxBatchItem,
  WaterxEnvelopePayload,
  WaterxLeafPayload,
  WaterxSignedEnvelope,
  WaterxSignedLeaf,
  WaterxUpdatePayload,
} from "../oracle/index.ts";

// ======== Wormhole / Wormholescan utilities (credit bridge) ========
export {
  fetchDepositVaa,
  fetchVaa,
  listBridgeWithdrawalVaas,
  listVaasByEmitter,
  padEvmEmitter,
  toWormholescanEmitter,
  vaaBase64ToBytes,
  vaaBase64ToHex,
  vaaBytesToBase64,
  waitForVaa,
} from "../account/funding/wormhole.ts";
export type { VaaListItem, VaaResponse, WormholescanOptions } from "../account/funding/wormhole.ts";

// ======== Generated BCS types (sui-ts-codegen) ========
export {
  AccountData as AccountDataBcs,
  GlobalConfigData as GlobalConfigDataBcs,
  MarketData as MarketDataBcs,
  OrderData as OrderDataBcs,
  PoolData as PoolDataBcs,
  PositionData as PositionDataBcs,
  RedeemRequestData as RedeemRequestDataBcs,
  TokenPoolData as TokenPoolDataBcs,
} from "../generated/waterx_perp_view/view.ts";
export { Position as PositionBcs, Order as OrderBcs } from "../generated/waterx_perp/position.ts";
export { Market as MarketBcs } from "../generated/waterx_perp/trading.ts";
export { MarketConfig as MarketConfigBcs } from "../generated/waterx_perp/market_config.ts";

// Re-export entire generated namespaces for power users.
export * as tradingCalls from "../generated/waterx_perp/trading.ts";
export * as lpPoolCalls from "../generated/waterx_perp/lp_pool.ts";
export * as viewCalls from "../generated/waterx_perp_view/view.ts";
export * as wxaAccountCalls from "../generated/waterx_account/account.ts";
export * as stakingCalls from "../generated/waterx_staking/waterx_staking.ts";
export * as oracleCalls from "../generated/waterx_oracle/oracle.ts";
export * as referralCalls from "../generated/waterx_referral/referral_table.ts";
export * as nativeCustodyCalls from "../generated/native_custody/custody_vault.ts";
export * as withdrawalQueueCalls from "../generated/withdrawal_queue/withdrawal_queue.ts";
