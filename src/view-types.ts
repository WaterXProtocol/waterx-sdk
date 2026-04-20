/**
 * TypeScript interfaces matching the waterx_perp::view return structs (v2).
 * Field naming mirrors the Move structs (snake_case → camelCase).
 */

export interface DelegateData {
  delegateAddress: string;
  permissions: number;
}

export interface AccountData {
  /** Account id (Sui object id / address) */
  accountId: string;
  accountObjectAddress: string;
  name: string;
  ownerAddress: string;
  delegates: DelegateData[];
}

export interface MarketData {
  marketId: string;
  /** Stringified `TypeName` of the base token (e.g. `market_symbol::BTC_USD`) */
  baseToken: string;
  /** Stringified `TypeName` of the LP token */
  lpToken: string;
  isActive: boolean;
  /** Open interest — Float scaled val (u128, 1e9) */
  longOi: bigint;
  shortOi: bigint;
  maxLongOi: bigint;
  maxShortOi: bigint;
  maxLeverageBps: bigint;
  tradingFeeBps: bigint;
  maxImpactFeeBps: bigint;
  allocatedLpExposureBps: bigint;
  impactFeeCurvature: bigint;
  impactFeeScale: bigint;
  maintenanceMarginBps: bigint;
  /** Minimum position collateral USD value (Float scaled u64, 1e9) */
  minCollValue: bigint;
  cooldownMs: bigint;
  /** Float scaled val (u128) */
  basicFundingRate: bigint;
  fundingIntervalMs: bigint;
  /** Float scaled val (u128) — order-price normalization tick */
  orderPriceTick: bigint;
  cumulativeFundingSign: boolean;
  /** Double scaled val (u256, 1e18) */
  cumulativeFundingIndex: bigint;
  lastFundingTimestamp: bigint;
  nextPositionId: bigint;
  nextOrderId: bigint;
}

export interface PoolData {
  lpToken: string;
  isActive: boolean;
  lpDecimal: number;
  totalLpSupply: bigint;
  /** Float scaled val (u128) */
  tvlUsd: bigint;
  tokenCount: bigint;
}

export interface TokenPoolData {
  tokenType: string;
  tokenDecimal: number;
  liquidityAmount: bigint;
  reservedAmount: bigint;
  /** Float scaled val (u128) */
  valueUsd: bigint;
  targetWeightBps: bigint;
  mintFeeBps: bigint;
  burnFeeBps: bigint;
  cumulativeBorrowRate: bigint;
  lastPriceRefreshTimestamp: bigint;
}

/** Pending WLP redeem request snapshot from `view::get_redeem_requests`. */
export interface RedeemRequestDataView {
  requestId: bigint;
  /** Address that will receive the redeemed token (wallet or Bucket Account). */
  recipient: string;
  /** WLP burned for this request (raw units, lp_decimal). */
  lpAmount: bigint;
  /** Stringified `TypeName` of the token to be received on settle. */
  tokenType: string;
  /** ms since epoch — settlement is allowed `MIN_REDEEM_DELAY_MS` after this. */
  requestTimestamp: bigint;
}

export interface RewardDistributorStakeData {
  stakeCoinType: string;
  rewardCoinType: string;
  stakeAmount: bigint;
  claimableRewardAmount: bigint;
  cumulativeRewardAmount: bigint;
}

export interface RewardDistributorAprQuote {
  stakeCoinType: string;
  rewardCoinType: string;
  totalStakeAmount: bigint;
  rewardFlowRate: bigint; // Double.value (u256, 1e18 scaled), raw reward units per ms
  annualRewardAmount: bigint; // raw reward units per year
  rewardTokenDecimals: number;
  rewardTokenPriceUsd: number;
  stakeTokenDecimals: number;
  stakeTokenPriceUsd: number;
  stakePriceSource: "params" | "wlp_pool";
  annualRewardValueUsd: number;
  totalStakedValueUsd: number;
  rewardAprBps: bigint;
  rewardApr: number;
}

/**
 * Enriched position snapshot from view::position_data / get_account_positions.
 * `size` is Float-scaled u128 (1e9).
 * Fields removed from v1 PositionDataView (max_leverage_bps, trading_fee_bps,
 * maintenance_margin_bps) — read those from MarketData and join client-side.
 */
export interface PositionDataView {
  positionId: bigint;
  accountObjectAddress: string;
  marketId: string;
  isLong: boolean;
  /** Float scaled val (u128, 1e9) — replaces v1 sizeAmount+sizeDecimal */
  size: bigint;
  collateralType: string;
  collateralAmount: bigint;
  collateralDecimal: number;
  averagePrice: bigint; // Float scaled val (u128, 1e9)
  oraclePrice: bigint;
  collateralPrice: bigint;
  estLiqPrice: bigint;
  leverageBps: bigint;
  entryBorrowIndex: bigint;
  entryFundingSign: boolean;
  entryFundingIndex: bigint; // Double (u256)
  unrealizedTradingFee: bigint;
  unrealizedBorrowFee: bigint;
  unrealizedFundingFee: bigint;
  unrealizedFundingSign: boolean;
  pnlPositive: boolean;
  pnl: bigint; // raw collateral units
  fundingFeePositive: boolean;
  fundingFee: bigint;
  borrowFee: bigint;
  closeFee: bigint;
  linkedOrderIds: bigint[];
  linkedOrderPriceKeys: bigint[];
  createTimestamp: bigint;
  updateTimestamp: bigint;
}

/** Enriched order snapshot from view::order_data / get_account_orders. */
export interface OrderDataView {
  orderId: bigint;
  accountObjectAddress: string;
  marketId: string;
  isLong: boolean;
  reduceOnly: boolean;
  isStopOrder: boolean;
  /** Float scaled val (u128, 1e9) */
  size: bigint;
  collateralType: string;
  collateralAmount: bigint;
  collateralDecimal: number;
  triggerPrice: bigint;
  oraclePrice: bigint;
  orderTypeTag: number; // 0=limit_buy, 1=limit_sell, 2=stop_buy, 3=stop_sell
  linkedPositionId: bigint | null;
  leverageBps: bigint;
  createTimestamp: bigint;
}

// ============================================================================
// v1 → v2 compat aliases (deprecated — prefer the new names)
// ============================================================================

/** @deprecated v2 renamed to `AccountData`. */
export type AccountInfo = AccountData;
/** @deprecated v2 renamed to `DelegateData`. */
export type DelegateDetail = DelegateData;
/** @deprecated v2 renamed to `MarketData`. Field changes: `min_size` / `lot_size` / `size_decimal` removed; `minCollValue` / `baseToken` / `lpToken` / impact fee params added. */
export type MarketSummary = MarketData;
/** @deprecated v2 renamed to `PoolData`. `lpToken: TypeName` added. */
export type PoolSummary = PoolData;
/** @deprecated v2 renamed to `TokenPoolData`. `tokenType: TypeName` added. */
export type TokenPoolSummary = TokenPoolData;
/** @deprecated v2 renamed to `PositionDataView`. Field changes: `sizeAmount` + `sizeDecimal` → `size`; `maxLeverageBps` / `tradingFeeBps` / `maintenanceMarginBps` moved to `MarketData`; `linkedOrderCount` → `linkedOrderIds.length`. */
export type PositionInfoView = PositionDataView;
