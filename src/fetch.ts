/**
 * Read-only view functions using gRPC simulateTransaction + BCS return-value parsing.
 * Uses generated BCS types and moveCall helpers from sui-ts-codegen.
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "./client.ts";
import type { BaseAsset } from "./constants.ts";
import { Double as RewardDistributorDoubleBcs } from "./generated/reward_distributor/deps/bucket_v2_framework/double.ts";
import {
  getStakeData as getRewardDistributorStakeDataCall,
  realtimeRewardAmount as realtimeRewardAmountCall,
  StakeDataDisplay as RewardDistributorStakeDataBcs,
  rewarderFlowRate as rewarderFlowRateCall,
  totalStakeAmount as totalRewardDistributorStakeAmountCall,
} from "./generated/reward_distributor/reward_distributor.ts";
import { VecMap } from "./generated/waterx_perp/deps/sui/vec_map.ts";
import { accountPositions } from "./generated/waterx_perp/user_account.ts";
import {
  AccountData as AccountDataBcs,
  accountData as accountDataCall,
  getRedeemRequests as getRedeemRequestsCall,
  MarketData as MarketDataBcs,
  marketData as marketDataCall,
  OrderData as OrderDataBcs,
  PoolData as PoolDataBcs,
  poolData as poolDataCall,
  PositionData as PositionDataBcs,
  positionData as positionDataCall,
  positionExists as positionExistsCall,
  RedeemRequestData as RedeemRequestDataBcs,
  TokenPoolData as TokenPoolDataBcs,
  tokenPoolData as tokenPoolDataCall,
} from "./generated/waterx_perp/view.ts";
import type {
  AccountData,
  DelegateData,
  MarketData,
  OrderDataView,
  PoolData,
  PositionDataView,
  RedeemRequestDataView,
  RewardDistributorAprQuote,
  RewardDistributorStakeData,
  TokenPoolData,
} from "./view-types.ts";

export type {
  AccountData,
  DelegateData,
  PositionDataView,
  OrderDataView,
  MarketData,
  PoolData,
  RedeemRequestDataView,
  RewardDistributorAprQuote,
  RewardDistributorStakeData,
  TokenPoolData,
};

// ================================================================
// Internal helpers
// ================================================================

function extractReturnBytes(result: any, commandIndex = 0, returnIndex = 0): Uint8Array {
  if (result.$kind === "FailedTransaction") {
    const err = result.FailedTransaction.status.error;
    throw new Error(`Simulate transaction failed: ${err?.message ?? JSON.stringify(err)}`);
  }
  const cmdResults = result.commandResults;
  if (cmdResults?.[commandIndex]?.returnValues?.[returnIndex]?.bcs) {
    return new Uint8Array(cmdResults[commandIndex].returnValues[returnIndex].bcs);
  }
  const cmdResult = result.results?.[commandIndex];
  if (cmdResult?.returnValues?.[returnIndex]) {
    const [rawBytes] = cmdResult.returnValues[returnIndex];
    return new Uint8Array(rawBytes);
  }
  throw new Error(
    `No return value at command[${commandIndex}].returnValues[${returnIndex}]. ` +
      `Transaction may have failed.`,
  );
}

function resolveRewardDistributorPackageId(client: WaterXClient, packageId?: string): string {
  const resolved = packageId ?? client.config.rewardDistributorPackageId;
  if (!resolved) {
    throw new Error(
      "Reward distributor package ID is required. Pass params.packageId or set client.config.rewardDistributorPackageId.",
    );
  }
  return resolved;
}

function resolveRewardDistributorId(client: WaterXClient, distributorId?: string): string {
  const resolved = distributorId ?? client.config.rewardDistributorId;
  if (!resolved) {
    throw new Error(
      "Reward distributor ID is required. Pass params.distributorId or set client.config.rewardDistributorId.",
    );
  }
  return resolved;
}

function resolveRewardTokenType(client: WaterXClient, rewardTokenType?: string): string {
  const resolved = rewardTokenType ?? client.config.rewardDistributorRewardTokenTypes?.[0];
  if (!resolved) {
    throw new Error(
      "Reward token type is required. Pass params.rewardTokenType or set client.config.rewardDistributorRewardTokenTypes.",
    );
  }
  return resolved;
}

const FLOAT_SCALE = 1_000_000_000n;
const DOUBLE_SCALE = 1_000_000_000_000_000_000n;
const BPS_SCALE = 10_000n;
const MS_PER_YEAR = 365n * 24n * 60n * 60n * 1000n;

function pow10(decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Token decimals must be a non-negative integer. Received: ${decimals}`);
  }
  return 10n ** BigInt(decimals);
}

function priceUsdToScaled(priceUsd: number): bigint {
  if (!Number.isFinite(priceUsd) || priceUsd < 0) {
    throw new Error(`USD price must be a finite non-negative number. Received: ${priceUsd}`);
  }
  return BigInt(Math.round(priceUsd * Number(FLOAT_SCALE)));
}

function scaledToNumber(value: bigint, scale: bigint): number {
  return Number(value) / Number(scale);
}

function deriveWlpPriceUsdScaled(pool: PoolData): bigint {
  if (pool.totalLpSupply === 0n || pool.tvlUsd === 0n) {
    return 0n;
  }
  return (pool.tvlUsd * pow10(pool.lpDecimal)) / pool.totalLpSupply;
}

function typeNameToString(t: unknown): string {
  // Generated TypeName is { name: string }
  const obj = t as { name?: string } | string | null | undefined;
  if (typeof obj === "string") return obj;
  return obj?.name ?? "";
}

// ================================================================
// Account queries
// ================================================================

function mapAccountData(a: any): AccountData {
  return {
    accountId: a.account_id,
    accountObjectAddress: a.account_object_address,
    name: a.name,
    ownerAddress: a.owner_address,
    delegates: (a.delegates ?? []).map(
      (d: any): DelegateData => ({
        delegateAddress: d.delegate_address,
        permissions: d.permissions,
      }),
    ),
  };
}

export async function getAccountsByOwner(
  client: WaterXClient,
  owner: string,
): Promise<AccountData[]> {
  const tx = new Transaction();
  tx.add(
    accountDataCall({
      package: client.config.packageId,
      arguments: {
        registry: client.config.accountRegistry,
        owner,
      },
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  const parsed = bcs.vector(AccountDataBcs).parse(bytes);
  return parsed.map(mapAccountData);
}

/**
 * Returns delegate details for a specific account id.
 * `account_data` now inlines delegates, so this is a filter over the owner's accounts.
 * Requires knowing the owner; see `getAccountsByOwner` for bulk queries.
 */
export async function getAccountDelegates(
  client: WaterXClient,
  owner: string,
  accountId: string,
): Promise<DelegateData[]> {
  const accounts = await getAccountsByOwner(client, owner);
  const normalized = accountId.replace(/^0x/i, "").toLowerCase();
  const hit = accounts.find((a) => a.accountId.replace(/^0x/i, "").toLowerCase() === normalized);
  return hit?.delegates ?? [];
}

/**
 * Returns the UserAccount object address for an account id owned by `owner`.
 * (In v2 `account_data` already includes `accountObjectAddress` for each account,
 * so look it up via `getAccountsByOwner`.)
 */
export async function getAccountObjectId(
  client: WaterXClient,
  owner: string,
  accountId: string,
): Promise<string> {
  const accounts = await getAccountsByOwner(client, owner);
  const normalized = accountId.replace(/^0x/i, "").toLowerCase();
  const hit = accounts.find((a) => a.accountId.replace(/^0x/i, "").toLowerCase() === normalized);
  if (!hit) throw new Error(`Account ${accountId} not found for owner ${owner}`);
  return hit.accountObjectAddress;
}

/**
 * Returns open-position ids recorded on `UserAccount.positions` for one market.
 * This is account-scoped and resilient on busy markets where global recent-id scans can miss.
 */
export async function getAccountPositionIdsByMarket(
  client: WaterXClient,
  accountObjectId: string,
  marketObjectId: string,
): Promise<bigint[]> {
  const tx = new Transaction();
  tx.add(
    accountPositions({
      package: client.config.packageId,
      arguments: {
        account: accountObjectId,
      },
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  const parsed = VecMap(bcs.Address, bcs.vector(bcs.u64())).parse(bytes) as {
    contents?: { key?: string; value?: Array<string | number | bigint> }[];
  };

  const marketNorm = marketObjectId.replace(/^0x/i, "").toLowerCase();
  const rows = parsed.contents ?? [];
  const hit = rows.find((r) => {
    const key = String(r.key ?? "");
    return key.replace(/^0x/i, "").toLowerCase() === marketNorm;
  });
  if (!hit?.value) return [];
  return hit.value.map((id) => BigInt(id));
}

export async function getAccountCoins(
  client: WaterXClient,
  accountObjectId: string,
  coinType?: string,
): Promise<
  {
    objectId: string;
    type: string;
    balance: string;
    version: string;
    digest: string;
  }[]
> {
  if (coinType) {
    const result = await client.grpcClient.listCoins({
      owner: accountObjectId,
      coinType,
    });
    return result.objects.map((c: any) => ({
      objectId: c.objectId,
      type: c.type ?? `0x2::coin::Coin<${coinType}>`,
      balance: c.balance ?? "0",
      version: String(c.version ?? "0"),
      digest: c.digest ?? "",
    }));
  }

  const result = await client.grpcClient.listOwnedObjects({
    owner: accountObjectId,
    type: "0x2::coin::Coin",
  });
  return result.objects.map((obj: any) => ({
    objectId: obj.objectId,
    type: obj.type ?? "",
    balance: obj.json?.balance ?? "0",
    version: String(obj.version ?? "0"),
    digest: obj.digest ?? "",
  }));
}

export async function getAccountBalance(
  client: WaterXClient,
  accountObjectId: string,
  coinType: string,
): Promise<bigint> {
  const coins = await getAccountCoins(client, accountObjectId, coinType);
  let total = 0n;
  for (const c of coins) {
    total += BigInt(c.balance);
  }
  return total;
}

export async function selectCoinsForAmount(
  client: WaterXClient,
  accountObjectId: string,
  coinType: string,
  requiredAmount: bigint,
): Promise<{
  coins: { objectId: string; version: string; digest: string }[];
  totalBalance: bigint;
}> {
  const allCoins = await getAccountCoins(client, accountObjectId, coinType);
  allCoins.sort((a, b) => {
    const ba = BigInt(a.balance);
    const bb = BigInt(b.balance);
    return ba > bb ? -1 : ba < bb ? 1 : 0;
  });

  let accumulated = 0n;
  const selected: typeof allCoins = [];

  for (const coin of allCoins) {
    selected.push(coin);
    accumulated += BigInt(coin.balance);
    if (accumulated >= requiredAmount) break;
  }

  if (accumulated < requiredAmount) {
    throw new Error(
      `Insufficient balance: need ${requiredAmount}, have ${accumulated} ` +
        `across ${allCoins.length} coins in account ${accountObjectId}`,
    );
  }

  return {
    coins: selected.map((c) => ({
      objectId: c.objectId,
      version: c.version,
      digest: c.digest,
    })),
    totalBalance: accumulated,
  };
}

// ================================================================
// Market queries
// ================================================================

function mapMarketData(m: any): MarketData {
  return {
    marketId: m.market_id,
    baseToken: typeNameToString(m.base_token),
    lpToken: typeNameToString(m.lp_token),
    isActive: m.is_active,
    longOi: BigInt(m.long_oi),
    shortOi: BigInt(m.short_oi),
    maxLongOi: BigInt(m.max_long_oi),
    maxShortOi: BigInt(m.max_short_oi),
    maxLeverageBps: BigInt(m.max_leverage_bps),
    tradingFeeBps: BigInt(m.trading_fee_bps),
    maxImpactFeeBps: BigInt(m.max_impact_fee_bps),
    allocatedLpExposureBps: BigInt(m.allocated_lp_exposure_bps),
    impactFeeCurvature: BigInt(m.impact_fee_curvature),
    impactFeeScale: BigInt(m.impact_fee_scale),
    maintenanceMarginBps: BigInt(m.maintenance_margin_bps),
    minCollValue: BigInt(m.min_coll_value),
    cooldownMs: BigInt(m.cooldown_ms),
    basicFundingRate: BigInt(m.basic_funding_rate),
    fundingIntervalMs: BigInt(m.funding_interval_ms),
    orderPriceTick: BigInt(m.order_price_tick),
    cumulativeFundingSign: m.cumulative_funding_sign,
    cumulativeFundingIndex: BigInt(m.cumulative_funding_index),
    lastFundingTimestamp: BigInt(m.last_funding_timestamp),
    nextPositionId: BigInt(m.next_position_id),
    nextOrderId: BigInt(m.next_order_id),
  };
}

export async function getMarketSummary(
  client: WaterXClient,
  marketObjectId: string,
  baseTokenType: string,
  lpTokenType?: string,
): Promise<MarketData> {
  const tx = new Transaction();
  tx.add(
    marketDataCall({
      package: client.config.packageId,
      arguments: { market: marketObjectId },
      typeArguments: [baseTokenType, lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return mapMarketData(MarketDataBcs.parse(bytes));
}

/**
 * Reads `Market.config.cooldown_ms` from a published `Market` shared object via gRPC `getObject`
 * (`include.json`). Does not depend on `view::market_data`; works without upgrading the view module.
 *
 * @returns Cooldown in milliseconds; `0n` means the chain does not enforce this check.
 */
export async function getMarketCooldownMs(
  client: WaterXClient,
  marketObjectId: string,
): Promise<bigint> {
  const { object } = await client.grpcClient.getObject({
    objectId: marketObjectId,
    include: { json: true },
  });
  const json = object?.json as Record<string, unknown> | null | undefined;
  if (!json || typeof json !== "object") {
    throw new Error(`getMarketCooldownMs: missing object JSON for ${marketObjectId}`);
  }
  const root = (json.fields as Record<string, unknown> | undefined) ?? json;
  const config = root.config as Record<string, unknown> | undefined;
  if (!config || typeof config !== "object") {
    throw new Error(`getMarketCooldownMs: Market ${marketObjectId} has no config in JSON`);
  }
  const cfgBody = (config.fields as Record<string, unknown> | undefined) ?? config;
  const raw = cfgBody.cooldown_ms;
  if (raw === undefined || raw === null) {
    throw new Error(`getMarketCooldownMs: missing cooldown_ms in Market.config`);
  }
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(Math.trunc(raw));
  if (typeof raw === "string" && raw.trim() !== "" && /^-?\d+$/.test(raw.trim())) {
    return BigInt(raw.trim());
  }
  throw new Error(`getMarketCooldownMs: unexpected cooldown_ms type: ${typeof raw}`);
}

// ================================================================
// Pool queries
// ================================================================

function mapPoolData(p: any): PoolData {
  return {
    lpToken: typeNameToString(p.lp_token),
    isActive: p.is_active,
    lpDecimal: p.lp_decimal,
    totalLpSupply: BigInt(p.total_lp_supply),
    tvlUsd: BigInt(p.tvl_usd),
    tokenCount: BigInt(p.token_count),
  };
}

export async function getPoolSummary(
  client: WaterXClient,
  lpTokenType?: string,
): Promise<PoolData> {
  const tx = new Transaction();
  tx.add(
    poolDataCall({
      package: client.config.packageId,
      arguments: { pool: client.config.wlpPool },
      typeArguments: [lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return mapPoolData(PoolDataBcs.parse(bytes));
}

function mapTokenPoolData(tp: any): TokenPoolData {
  return {
    tokenType: typeNameToString(tp.token_type),
    tokenDecimal: tp.token_decimal,
    liquidityAmount: BigInt(tp.liquidity_amount),
    reservedAmount: BigInt(tp.reserved_amount),
    valueUsd: BigInt(tp.value_usd),
    targetWeightBps: BigInt(tp.target_weight_bps),
    mintFeeBps: BigInt(tp.mint_fee_bps),
    burnFeeBps: BigInt(tp.burn_fee_bps),
    cumulativeBorrowRate: BigInt(tp.cumulative_borrow_rate),
    lastPriceRefreshTimestamp: BigInt(tp.last_price_refresh_timestamp),
  };
}

export async function getTokenPoolSummary(
  client: WaterXClient,
  tokenIndex: number | bigint,
  lpTokenType?: string,
): Promise<TokenPoolData> {
  const tx = new Transaction();
  tx.add(
    tokenPoolDataCall({
      package: client.config.packageId,
      arguments: { pool: client.config.wlpPool, tokenIndex },
      typeArguments: [lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return mapTokenPoolData(TokenPoolDataBcs.parse(bytes));
}

// ================================================================
// Reward Distributor queries
// ================================================================

export interface CalculateRewardDistributorIncentiveParams {
  distributorId?: string;
  account: string;
  stakeTokenType: string;
  rewardTokenType?: string;
  packageId?: string;
}

export interface CalculateRewardDistributorAprParams {
  distributorId?: string;
  stakeTokenType: string;
  rewardTokenType?: string;
  packageId?: string;
  rewardTokenPriceUsd: number;
  rewardTokenDecimals: number;
  stakeTokenPriceUsd?: number;
  stakeTokenDecimals?: number;
}

function buildRewardDistributorAprQuote(params: {
  stakeTokenType: string;
  rewardTokenType: string;
  totalStakeAmount: bigint;
  rewardFlowRate: bigint;
  rewardTokenPriceUsd: number;
  rewardTokenDecimals: number;
  stakeTokenPriceUsd: number;
  stakeTokenDecimals: number;
  stakePriceSource: "params" | "wlp_pool";
}): RewardDistributorAprQuote {
  const annualRewardAmount = (params.rewardFlowRate * MS_PER_YEAR) / DOUBLE_SCALE;
  const rewardTokenPriceUsdScaled = priceUsdToScaled(params.rewardTokenPriceUsd);
  const stakeTokenPriceUsdScaled = priceUsdToScaled(params.stakeTokenPriceUsd);
  const annualRewardValueUsdScaled =
    (annualRewardAmount * rewardTokenPriceUsdScaled) / pow10(params.rewardTokenDecimals);
  const totalStakedValueUsdScaled =
    (params.totalStakeAmount * stakeTokenPriceUsdScaled) / pow10(params.stakeTokenDecimals);
  const rewardAprBps =
    totalStakedValueUsdScaled > 0n
      ? (annualRewardValueUsdScaled * BPS_SCALE) / totalStakedValueUsdScaled
      : 0n;

  return {
    stakeCoinType: params.stakeTokenType,
    rewardCoinType: params.rewardTokenType,
    totalStakeAmount: params.totalStakeAmount,
    rewardFlowRate: params.rewardFlowRate,
    annualRewardAmount,
    rewardTokenDecimals: params.rewardTokenDecimals,
    rewardTokenPriceUsd: params.rewardTokenPriceUsd,
    stakeTokenDecimals: params.stakeTokenDecimals,
    stakeTokenPriceUsd: params.stakeTokenPriceUsd,
    stakePriceSource: params.stakePriceSource,
    annualRewardValueUsd: scaledToNumber(annualRewardValueUsdScaled, FLOAT_SCALE),
    totalStakedValueUsd: scaledToNumber(totalStakedValueUsdScaled, FLOAT_SCALE),
    rewardAprBps,
    rewardApr: scaledToNumber(rewardAprBps, 100n),
  };
}

/**
 * Reads the current claimable incentive amount for a staker.
 * This maps to `reward_distributor::realtime_reward_amount`.
 */
export async function calculateRewardDistributorIncentive(
  client: WaterXClient,
  params: CalculateRewardDistributorIncentiveParams,
): Promise<bigint> {
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const rewardTokenType = resolveRewardTokenType(client, params.rewardTokenType);
  const tx = new Transaction();
  tx.add(
    realtimeRewardAmountCall({
      package: resolveRewardDistributorPackageId(client, params.packageId),
      arguments: {
        self: distributorId,
        account: params.account,
      },
      typeArguments: [params.stakeTokenType, rewardTokenType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return BigInt(bcs.u64().parse(bytes));
}

/**
 * Calculates the current rewarder APR for a single reward token.
 *
 * If `stakeTokenPriceUsd` / `stakeTokenDecimals` are omitted and the staked
 * asset is the configured WLP type, the SDK derives WLP spot price and
 * decimals from `waterx_perp::view::pool_data`.
 */
export async function calculateRewardDistributorApr(
  client: WaterXClient,
  params: CalculateRewardDistributorAprParams,
): Promise<RewardDistributorAprQuote> {
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const rewardTokenType = resolveRewardTokenType(client, params.rewardTokenType);
  const packageId = resolveRewardDistributorPackageId(client, params.packageId);
  const needsWlpPoolData =
    params.stakeTokenType === client.config.wlpType &&
    (params.stakeTokenPriceUsd == null || params.stakeTokenDecimals == null);

  if (!needsWlpPoolData && params.stakeTokenPriceUsd == null) {
    throw new Error(
      "Stake token USD price is required. Pass params.stakeTokenPriceUsd or use the configured WLP stake token so the SDK can derive price from the pool.",
    );
  }

  if (!needsWlpPoolData && params.stakeTokenDecimals == null) {
    throw new Error(
      "Stake token decimals are required. Pass params.stakeTokenDecimals or use the configured WLP stake token so the SDK can derive decimals from the pool.",
    );
  }

  const tx = new Transaction();
  tx.add(
    rewarderFlowRateCall({
      package: packageId,
      arguments: {
        self: distributorId,
      },
      typeArguments: [params.stakeTokenType, rewardTokenType],
    }),
  );
  tx.add(
    totalRewardDistributorStakeAmountCall({
      package: packageId,
      arguments: {
        self: distributorId,
      },
      typeArguments: [params.stakeTokenType],
    }),
  );
  if (needsWlpPoolData) {
    tx.add(
      poolDataCall({
        package: client.config.packageId,
        arguments: {
          pool: client.config.wlpPool,
        },
        typeArguments: [client.config.wlpType],
      }),
    );
  }

  const result = await client.simulate(tx);
  const rewardFlowRateBytes = extractReturnBytes(result, 0);
  const totalStakeAmountBytes = extractReturnBytes(result, 1);
  const rewardFlowRate = BigInt(RewardDistributorDoubleBcs.parse(rewardFlowRateBytes).value);
  const totalStakeAmount = BigInt(bcs.u64().parse(totalStakeAmountBytes));

  let stakeTokenPriceUsd = params.stakeTokenPriceUsd;
  let stakeTokenDecimals = params.stakeTokenDecimals;
  let stakePriceSource: "params" | "wlp_pool" = "params";

  if (needsWlpPoolData) {
    const poolBytes = extractReturnBytes(result, 2);
    const parsedSummary = mapPoolData(PoolDataBcs.parse(poolBytes));
    stakeTokenPriceUsd = scaledToNumber(deriveWlpPriceUsdScaled(parsedSummary), FLOAT_SCALE);
    stakeTokenDecimals = parsedSummary.lpDecimal;
    stakePriceSource = "wlp_pool";
  }

  return buildRewardDistributorAprQuote({
    stakeTokenType: params.stakeTokenType,
    rewardTokenType,
    totalStakeAmount,
    rewardFlowRate,
    rewardTokenPriceUsd: params.rewardTokenPriceUsd,
    rewardTokenDecimals: params.rewardTokenDecimals,
    stakeTokenPriceUsd: stakeTokenPriceUsd!,
    stakeTokenDecimals: stakeTokenDecimals!,
    stakePriceSource,
  });
}

export interface GetRewardDistributorStakeDataParams {
  distributorId?: string;
  account: string;
  stakeTokenType: string;
  rewardTokenType?: string;
  packageId?: string;
}

/**
 * Reads the full stake snapshot for an account, including claimable rewards.
 */
export async function getRewardDistributorStakeData(
  client: WaterXClient,
  params: GetRewardDistributorStakeDataParams,
): Promise<RewardDistributorStakeData> {
  const distributorId = resolveRewardDistributorId(client, params.distributorId);
  const rewardTokenType = resolveRewardTokenType(client, params.rewardTokenType);
  const tx = new Transaction();
  tx.add(
    getRewardDistributorStakeDataCall({
      package: resolveRewardDistributorPackageId(client, params.packageId),
      arguments: {
        self: distributorId,
        account: params.account,
      },
      typeArguments: [params.stakeTokenType, rewardTokenType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  const data = RewardDistributorStakeDataBcs.parse(bytes);

  return {
    stakeCoinType: data.stake_coin_type,
    rewardCoinType: data.reward_coin_type,
    stakeAmount: BigInt(data.stake_amount),
    claimableRewardAmount: BigInt(data.claimable_reward_amount),
    cumulativeRewardAmount: BigInt(data.cumulative_reward_amount),
  };
}

// ================================================================
// Position queries
// ================================================================

function parsePositionData(raw: any): PositionDataView {
  return {
    positionId: BigInt(raw.position_id),
    accountObjectAddress: raw.account_object_address,
    marketId: raw.market_id,
    isLong: raw.is_long,
    size: BigInt(raw.size),
    collateralType: typeNameToString(raw.collateral_type),
    collateralAmount: BigInt(raw.collateral_amount),
    collateralDecimal: raw.collateral_decimal,
    averagePrice: BigInt(raw.average_price),
    oraclePrice: BigInt(raw.oracle_price),
    collateralPrice: BigInt(raw.collateral_price),
    estLiqPrice: BigInt(raw.est_liq_price),
    leverageBps: BigInt(raw.leverage_bps),
    entryBorrowIndex: BigInt(raw.entry_borrow_index),
    entryFundingSign: raw.entry_funding_sign,
    entryFundingIndex: BigInt(raw.entry_funding_index),
    unrealizedTradingFee: BigInt(raw.unrealized_trading_fee),
    unrealizedBorrowFee: BigInt(raw.unrealized_borrow_fee),
    unrealizedFundingFee: BigInt(raw.unrealized_funding_fee),
    unrealizedFundingSign: raw.unrealized_funding_sign,
    pnlPositive: raw.pnl_positive,
    pnl: BigInt(raw.pnl),
    fundingFeePositive: raw.funding_fee_positive,
    fundingFee: BigInt(raw.funding_fee),
    borrowFee: BigInt(raw.borrow_fee),
    closeFee: BigInt(raw.close_fee),
    linkedOrderIds: (raw.linked_order_ids ?? []).map((v: any) => BigInt(v)),
    linkedOrderPriceKeys: (raw.linked_order_price_keys ?? []).map((v: any) => BigInt(v)),
    createTimestamp: BigInt(raw.create_timestamp),
    updateTimestamp: BigInt(raw.update_timestamp),
  };
}

function parseOrderData(raw: any): OrderDataView {
  return {
    orderId: BigInt(raw.order_id),
    accountObjectAddress: raw.account_object_address,
    marketId: raw.market_id,
    isLong: raw.is_long,
    reduceOnly: raw.reduce_only,
    isStopOrder: raw.is_stop_order,
    size: BigInt(raw.size),
    collateralType: typeNameToString(raw.collateral_type),
    collateralAmount: BigInt(raw.collateral_amount),
    collateralDecimal: raw.collateral_decimal,
    triggerPrice: BigInt(raw.trigger_price),
    oraclePrice: BigInt(raw.oracle_price),
    orderTypeTag: raw.order_type_tag,
    linkedPositionId: raw.has_linked_position ? BigInt(raw.linked_position_id) : null,
    leverageBps: BigInt(raw.leverage_bps),
    createTimestamp: BigInt(raw.create_timestamp),
  };
}

export async function getPosition(
  client: WaterXClient,
  marketObjectId: string,
  positionId: number | bigint,
  baseTokenType: string,
  lpTokenType?: string,
  basePriceUsd: number | bigint = 0,
  collateralPriceUsd: number | bigint = 1,
): Promise<PositionDataView> {
  const tx = new Transaction();
  tx.add(
    positionDataCall({
      package: client.config.packageId,
      arguments: {
        market: marketObjectId,
        pool: client.config.wlpPool,
        basePriceUsd: BigInt(basePriceUsd),
        collateralPriceUsd: BigInt(collateralPriceUsd),
        positionId,
      },
      typeArguments: [baseTokenType, lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return parsePositionData(PositionDataBcs.parse(bytes));
}

export async function positionExists(
  client: WaterXClient,
  marketObjectId: string,
  positionId: number | bigint,
  baseTokenType: string,
  lpTokenType?: string,
): Promise<boolean> {
  const tx = new Transaction();
  tx.add(
    positionExistsCall({
      package: client.config.packageId,
      arguments: { market: marketObjectId, positionId },
      typeArguments: [baseTokenType, lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  return bcs.bool().parse(bytes);
}

// ================================================================
// Enriched position / order queries
// ================================================================

/**
 * Get all enriched positions for an account in a single market.
 * Uses view::get_account_positions via simulateTransaction.
 */
export async function getAccountPositions(
  client: WaterXClient,
  base: BaseAsset,
  accountObjectAddress: string,
  basePriceUsd: number,
  collateralPriceUsd = 1,
): Promise<PositionDataView[]> {
  const pkg = client.config.packageId;
  const market = client.getMarketEntry(base);
  const cfg = client.config;
  const tx = new Transaction();

  tx.moveCall({
    target: `${pkg}::view::get_account_positions`,
    arguments: [
      tx.object(market.marketId),
      tx.object(cfg.wlpPool),
      tx.object(cfg.accountRegistry),
      tx.pure.u64(basePriceUsd),
      tx.pure.u64(collateralPriceUsd),
      tx.pure.address(accountObjectAddress),
    ],
    typeArguments: [market.baseType, cfg.wlpType],
  });

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  const parsed = bcs.vector(PositionDataBcs).parse(bytes);
  return parsed.map((p: any) => parsePositionData(p));
}

/**
 * Get all enriched positions for an account across ALL configured markets in a single PTB.
 * One `get_account_positions` moveCall per market, one simulateTransaction round-trip.
 * `prices` maps BaseAsset → USD price (e.g. `{ BTC: 50000, ETH: 3000 }`).
 * Markets without a price entry are skipped.
 */
export async function getAllAccountPositions(
  client: WaterXClient,
  accountObjectAddress: string,
  prices: Partial<Record<BaseAsset, number>>,
  collateralPriceUsd = 1,
): Promise<PositionDataView[]> {
  const pkg = client.config.packageId;
  const cfg = client.config;
  const bases = client.getBaseAssets();
  const tx = new Transaction();

  const cmdBases: BaseAsset[] = [];
  for (const { asset } of bases) {
    const price = prices[asset];
    if (price == null) continue;
    const market = client.getMarketEntry(asset);
    tx.moveCall({
      target: `${pkg}::view::get_account_positions`,
      arguments: [
        tx.object(market.marketId),
        tx.object(cfg.wlpPool),
        tx.object(cfg.accountRegistry),
        tx.pure.u64(price),
        tx.pure.u64(collateralPriceUsd),
        tx.pure.address(accountObjectAddress),
      ],
      typeArguments: [market.baseType, cfg.wlpType],
    });
    cmdBases.push(asset);
  }

  if (cmdBases.length === 0) return [];

  const result = await client.simulate(tx);
  const all: PositionDataView[] = [];
  for (let i = 0; i < cmdBases.length; i++) {
    const bytes = extractReturnBytes(result, i, 0);
    const parsed = bcs.vector(PositionDataBcs).parse(bytes);
    for (const p of parsed) {
      all.push(parsePositionData(p));
    }
  }
  return all;
}

/**
 * Get all orders for an account across ALL configured markets in a single PTB.
 */
export async function getAllAccountOrders(
  client: WaterXClient,
  accountObjectAddress: string,
): Promise<OrderDataView[]> {
  const pkg = client.config.packageId;
  const cfg = client.config;
  const bases = client.getBaseAssets();
  const tx = new Transaction();

  for (const { asset } of bases) {
    const market = client.getMarketEntry(asset);
    tx.moveCall({
      target: `${pkg}::view::get_account_orders`,
      arguments: [
        tx.object(market.marketId),
        tx.pure.u64(0),
        tx.pure.address(accountObjectAddress),
      ],
      typeArguments: [market.baseType, cfg.wlpType],
    });
  }

  if (bases.length === 0) return [];

  const result = await client.simulate(tx);
  const all: OrderDataView[] = [];
  for (let i = 0; i < bases.length; i++) {
    const bytes = extractReturnBytes(result, i, 0);
    const parsed = bcs.vector(OrderDataBcs).parse(bytes);
    for (const o of parsed) {
      all.push(parseOrderData(o));
    }
  }
  return all;
}

/**
 * Get all orders for an account in a single market.
 * Uses view::get_account_orders via simulateTransaction (scans all 4 order maps on-chain).
 */
export async function getAccountOrders(
  client: WaterXClient,
  base: BaseAsset,
  accountObjectAddress: string,
): Promise<OrderDataView[]> {
  const pkg = client.config.packageId;
  const market = client.getMarketEntry(base);
  const cfg = client.config;
  const tx = new Transaction();

  tx.moveCall({
    target: `${pkg}::view::get_account_orders`,
    arguments: [
      tx.object(market.marketId),
      tx.pure.u64(0), // oracle price unused for orders
      tx.pure.address(accountObjectAddress),
    ],
    typeArguments: [market.baseType, cfg.wlpType],
  });

  const result = await client.simulate(tx);
  const bytes = extractReturnBytes(result);
  const parsed = bcs.vector(OrderDataBcs).parse(bytes);
  return parsed.map((o: any) => parseOrderData(o));
}

/**
 * Paginated list of all positions in a market with enriched data.
 */
export async function getMarketPositions(
  client: WaterXClient,
  base: BaseAsset,
  basePriceUsd: number,
  cursor = 0,
  pageSize = 50,
  collateralPriceUsd = 1,
): Promise<{ positions: PositionDataView[]; nextCursor?: number }> {
  const pkg = client.config.packageId;
  const market = client.getMarketEntry(base);
  const cfg = client.config;
  const tx = new Transaction();

  tx.moveCall({
    target: `${pkg}::view::get_market_positions`,
    arguments: [
      tx.object(market.marketId),
      tx.object(cfg.wlpPool),
      tx.pure.u64(basePriceUsd),
      tx.pure.u64(collateralPriceUsd),
      tx.pure.u64(cursor),
      tx.pure.u64(pageSize),
    ],
    typeArguments: [market.baseType, cfg.wlpType],
  });

  const result = await client.simulate(tx);
  const posBytes = extractReturnBytes(result, 0, 0);
  const cursorBytes = extractReturnBytes(result, 0, 1);

  const parsed = bcs.vector(PositionDataBcs).parse(posBytes);
  const nextCursorOpt = bcs.option(bcs.u64()).parse(cursorBytes);

  return {
    positions: parsed.map((p: any) => parsePositionData(p)),
    nextCursor: nextCursorOpt != null ? Number(nextCursorOpt) : undefined,
  };
}

/**
 * Paginated list of all orders in a market with enriched data.
 * Uses `view::get_market_orders` via simulateTransaction; scans all 4 order
 * books (limit_buys / limit_sells / stop_buys / stop_sells). `cursor` is an
 * opaque flat index; pass `0` for the first page, then the `nextCursor` from
 * the previous result.
 *
 * `basePriceUsd` is stamped into each returned `OrderData.oraclePrice` for
 * client-side display (contract does not use it for filtering).
 */
export async function getMarketOrders(
  client: WaterXClient,
  base: BaseAsset,
  basePriceUsd = 0,
  cursor = 0,
  pageSize = 50,
): Promise<{ orders: OrderDataView[]; nextCursor?: number }> {
  const pkg = client.config.packageId;
  const market = client.getMarketEntry(base);
  const cfg = client.config;
  const tx = new Transaction();

  tx.moveCall({
    target: `${pkg}::view::get_market_orders`,
    arguments: [
      tx.object(market.marketId),
      tx.pure.u64(basePriceUsd),
      tx.pure.u64(cursor),
      tx.pure.u64(pageSize),
    ],
    typeArguments: [market.baseType, cfg.wlpType],
  });

  const result = await client.simulate(tx);
  const ordersBytes = extractReturnBytes(result, 0, 0);
  const cursorBytes = extractReturnBytes(result, 0, 1);

  const parsed = bcs.vector(OrderDataBcs).parse(ordersBytes);
  const nextCursorOpt = bcs.option(bcs.u64()).parse(cursorBytes);

  return {
    orders: parsed.map((o: any) => parseOrderData(o)),
    nextCursor: nextCursorOpt != null ? Number(nextCursorOpt) : undefined,
  };
}

// ================================================================
// Redeem-request queue queries
// ================================================================

function parseRedeemRequestData(raw: any): RedeemRequestDataView {
  return {
    requestId: BigInt(raw.request_id),
    recipient: raw.recipient,
    lpAmount: BigInt(raw.lp_amount),
    tokenType: typeNameToString(raw.token_type),
    requestTimestamp: BigInt(raw.request_timestamp),
  };
}

/**
 * Paginated snapshot of pending WLP redeem requests for the configured pool.
 * Uses `view::get_redeem_requests<LP_TOKEN>` via simulateTransaction.
 *
 * `cursor` is the 0-based starting index into `pool.redeem_requests`. Pass
 * `0` for the first page; if `nextCursor` is returned, feed it back to
 * fetch the next page.
 *
 * @param lpTokenType Override LP token type. Defaults to `client.config.wlpType`.
 */
export async function getRedeemRequests(
  client: WaterXClient,
  cursor = 0,
  pageSize = 50,
  lpTokenType?: string,
): Promise<{ requests: RedeemRequestDataView[]; nextCursor?: number }> {
  const tx = new Transaction();
  tx.add(
    getRedeemRequestsCall({
      package: client.config.packageId,
      arguments: {
        pool: client.config.wlpPool,
        cursor,
        pageSize,
      },
      typeArguments: [lpTokenType ?? client.config.wlpType],
    }),
  );

  const result = await client.simulate(tx);
  const requestsBytes = extractReturnBytes(result, 0, 0);
  const cursorBytes = extractReturnBytes(result, 0, 1);

  const parsed = bcs.vector(RedeemRequestDataBcs).parse(requestsBytes);
  const nextCursorOpt = bcs.option(bcs.u64()).parse(cursorBytes);

  return {
    requests: parsed.map((r: any) => parseRedeemRequestData(r)),
    nextCursor: nextCursorOpt != null ? Number(nextCursorOpt) : undefined,
  };
}
