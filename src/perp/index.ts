// ======== Core ========
export { PerpClient } from "./client.ts";
export type { CreateClientOptions } from "./client.ts";
export { PYTH_DEFAULTS, WORMHOLE_DEFAULTS, clearConfigCache, loadConfig } from "./config.ts";
export type {
  BasePackageEntry,
  ConstantFeedEntry,
  WaterxReferralPackage,
  LoadConfigOptions,
  NativeCustodyAsset,
  NativeCustodyPackage,
  PythInfraConfig,
  PythLazerRulePackage,
  PythRulePackage,
  PythSponsorRulePackage,
  SupraFeedEntry,
  SupraRulePackage,
  TestnetFaucetPackage,
  TrustedEmitterRow,
  WaterXConfig,
  WaterXPackages,
  WaterxCreditPackage,
  WaterxOraclePackage,
  WaterxPerpMarketEntry,
  WaterxPerpPackage,
  WaterxStakingPackage,
  WithdrawalQueuePackage,
  WlpPackage,
  WormholeBridgePackage,
  WormholeInfraConfig,
  WxaAccountPackage,
} from "./config.ts";

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
  CRYPTO_FEE_RATE,
  DOUBLE_SCALE,
  DRY_RUN_SENDER,
  FLOAT_SCALE,
  MAINTENANCE_MARGIN_RATE,
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
  STOCK_FEE_RATE,
  MS_PER_YEAR,
  SUI_DECIMALS,
  WLP_DECIMALS,
  COLLATERAL_DECIMALS,
  TOKEN_DECIMALS,
} from "./constants.ts";
export type { Network } from "./constants.ts";

// ======== Utilities ========
export { getMarketTickers, getCollateralAssets } from "../utils/config.ts";
export {
  annualizedApyFromRatio,
  annualizeFundingRate,
  calcBorrowRate,
  calcBorrowRateAccrual,
  calcDynamicFeeBps,
  calcEffectiveCollateralUsd,
  calcEstLiqPrice,
  calcFee,
  calcFundingFeeUsd,
  calcFundingRate,
  calcImpactFeeRate,
  calcLeverage,
  calcMaxReducibleCollateralUsd,
  calcNotional,
  calcPositionBorrowFee,
  calcTokenUtilizationBps,
  calcTotalTradingFeeRate,
  calcUnrealizedPnl,
  calcWlpIncentiveApy,
  calcWlpMintOut,
  calcWlpPrice,
  calcWlpRedeemOut,
  decodeFundingIndexDelta,
  rawPrice,
} from "../utils/math.ts";

// ======== Transaction builders (user-side) ========
export * from "./user/index.ts";

// ======== High-level Tx builders ========
export * from "./tx-builders.ts";

// ======== Read-only queries ========
export * from "./fetch.ts";

// ======== Oracle utilities (Pyth source + rule aggregation) ========
export {
  PythCache,
  aggregateTicker,
  aggregateTickerWithConstant,
  aggregateTickerWithPyth,
  buildPythPriceUpdateCalls,
  fetchPriceFeedsUpdateData,
  refreshOraclePrices,
  updatePythPrices,
} from "../oracle/index.ts";
export type { OracleSource, UpdateDataProvider } from "../oracle/index.ts";

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
export * as pythRuleCalls from "../generated/waterx_pyth_rule/pyth_rule.ts";
export * as pythSponsorRuleCalls from "../generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";
export * as referralCalls from "../generated/waterx_referral/referral_table.ts";
export * as nativeCustodyCalls from "../generated/native_custody/custody_vault.ts";
export * as withdrawalQueueCalls from "../generated/withdrawal_queue/withdrawal_queue.ts";
