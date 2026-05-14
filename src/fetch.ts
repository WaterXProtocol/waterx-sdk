/**
 * Read-only queries built on top of `waterx_perp_view`.
 *
 * Each helper builds a one-shot PTB, runs `client.simulate(tx)`, and
 * decodes the first command's return values into the matching generated
 * BCS struct. The simulated sender is the zero address.
 */

import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "./client.ts";
import { SENDER } from "./constants.ts";
import {
  AccountData,
  accountData as accountDataCall,
  getAccountOrders as getAccountOrdersCall,
  getAccountPositions as getAccountPositionsCall,
  getMarketOrders as getMarketOrdersCall,
  getMarketPositions as getMarketPositionsCall,
  getRedeemRequests as getRedeemRequestsCall,
  GlobalConfigData,
  globalConfigData as globalConfigDataCall,
  MarketData,
  marketData as marketDataCall,
  OrderData,
  orderData as orderDataCall,
  PoolData,
  poolData as poolDataCall,
  PositionData,
  positionData as positionDataCall,
  positionExists as positionExistsCall,
  RedeemRequestData,
  TokenPoolData,
  tokenPoolData as tokenPoolDataCall,
} from "./generated/waterx_perp_view/view.ts";

// ============================================================================
// Simulate / decode helpers
// ============================================================================

interface SimulationCommandResult {
  returnValues?: { value?: { bcs?: Uint8Array | string } }[];
}

interface SimulationResult {
  commandResults?: SimulationCommandResult[] | null;
  error?: string | null;
}

async function simulateAndExtract(
  client: WaterXClient,
  tx: Transaction,
  commandIndex = 0,
  returnIndex = 0,
): Promise<Uint8Array> {
  tx.setSender(SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  if (sim.error) throw new Error(`simulate failed: ${sim.error}`);
  const cmd = sim.commandResults?.[commandIndex];
  const ret = cmd?.returnValues?.[returnIndex];
  const bcsValue = ret?.value?.bcs;
  if (!bcsValue) {
    throw new Error(
      `simulate returned no BCS value at commandResults[${commandIndex}].returnValues[${returnIndex}]`,
    );
  }
  return typeof bcsValue === "string" ? fromBase64(bcsValue) : bcsValue;
}

function withLp(client: WaterXClient, lpType?: string): string {
  return lpType ?? client.wlpType();
}

// ============================================================================
// Account
// ============================================================================

export type AccountDataView = ReturnType<typeof AccountData.parse>;

/** Look up the registered AccountData for a given wxa account ID. */
export async function getAccountData(
  client: WaterXClient,
  accountId: string,
): Promise<AccountDataView> {
  const tx = new Transaction();
  accountDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      accountId,
    },
  })(tx);
  return AccountData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Market / Pool / Token pool
// ============================================================================

export type MarketDataView = ReturnType<typeof MarketData.parse>;
export type PoolDataView = ReturnType<typeof PoolData.parse>;
export type TokenPoolDataView = ReturnType<typeof TokenPoolData.parse>;
export type GlobalConfigDataView = ReturnType<typeof GlobalConfigData.parse>;

export async function getMarketData(
  client: WaterXClient,
  args: { ticker: string; lpType?: string },
): Promise<MarketDataView> {
  const tx = new Transaction();
  marketDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return MarketData.parse(await simulateAndExtract(client, tx));
}

export async function getPoolData(
  client: WaterXClient,
  args: { lpType?: string } = {},
): Promise<PoolDataView> {
  const tx = new Transaction();
  poolDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: { pool: tx.object(client.config.packages.wlp.wlp_pool) },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return PoolData.parse(await simulateAndExtract(client, tx));
}

export async function getTokenPoolData(
  client: WaterXClient,
  args: { tokenIndex: bigint | number; lpType?: string },
): Promise<TokenPoolDataView> {
  const tx = new Transaction();
  tokenPoolDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      tokenIndex: args.tokenIndex,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return TokenPoolData.parse(await simulateAndExtract(client, tx));
}

export async function getGlobalConfigData(client: WaterXClient): Promise<GlobalConfigDataView> {
  const tx = new Transaction();
  globalConfigDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: { cfg: tx.object(client.config.packages.waterx_perp.global_config) },
  })(tx);
  return GlobalConfigData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Position
// ============================================================================

export type PositionDataView = ReturnType<typeof PositionData.parse>;

export async function positionExists(
  client: WaterXClient,
  args: { ticker: string; positionId: bigint | number; lpType?: string },
): Promise<boolean> {
  const tx = new Transaction();
  positionExistsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      positionId: args.positionId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  const bytes = await simulateAndExtract(client, tx);
  return bcs.bool().parse(bytes);
}

export async function getPosition(
  client: WaterXClient,
  args: {
    ticker: string;
    positionId: bigint | number;
    /** Human-readable USD prices for PnL / liq price calc; pass 0n if unsure. */
    basePriceUsd: bigint | number;
    collateralPriceUsd: bigint | number;
    lpType?: string;
  },
): Promise<PositionDataView> {
  const tx = new Transaction();
  positionDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd,
      positionId: args.positionId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return PositionData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Order
// ============================================================================

export type OrderDataView = ReturnType<typeof OrderData.parse>;

export async function getOrder(
  client: WaterXClient,
  args: {
    ticker: string;
    orderId: bigint | number;
    orderTypeTag: number;
    triggerPrice: bigint | number;
    basePriceUsd: bigint | number;
    lpType?: string;
  },
): Promise<OrderDataView> {
  const tx = new Transaction();
  orderDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd,
      orderTypeTag: args.orderTypeTag,
      triggerPrice: args.triggerPrice,
      orderId: args.orderId,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return OrderData.parse(await simulateAndExtract(client, tx));
}

// ============================================================================
// Paginated lists
// ============================================================================

export interface PageOpts {
  cursor?: bigint | number;
  pageSize?: bigint | number;
}

const VECTOR_PAGE = (struct: ReturnType<typeof bcs.vector>) => struct;

export async function getMarketOrders(
  client: WaterXClient,
  args: {
    ticker: string;
    basePriceUsd?: bigint | number;
    lpType?: string;
  } & PageOpts,
): Promise<{ orders: OrderDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getMarketOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd ?? 0n,
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { orders: [] };
  const ordersBytes = ret[0]?.value?.bcs;
  const cursorBytes = ret[1]?.value?.bcs;
  if (!ordersBytes) return { orders: [] };
  const ordersBuf = typeof ordersBytes === "string" ? fromBase64(ordersBytes) : ordersBytes;
  const orders = bcs.vector(OrderData).parse(ordersBuf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = typeof cursorBytes === "string" ? fromBase64(cursorBytes) : cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { orders, nextCursor };
}

export async function getMarketPositions(
  client: WaterXClient,
  args: {
    ticker: string;
    basePriceUsd: bigint | number;
    collateralPriceUsd?: bigint | number;
    lpType?: string;
  } & PageOpts,
): Promise<{ positions: PositionDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getMarketPositionsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd ?? 0n,
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { positions: [] };
  const positionsBytes = ret[0]?.value?.bcs;
  const cursorBytes = ret[1]?.value?.bcs;
  if (!positionsBytes) return { positions: [] };
  const buf = typeof positionsBytes === "string" ? fromBase64(positionsBytes) : positionsBytes;
  const positions = bcs.vector(PositionData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = typeof cursorBytes === "string" ? fromBase64(cursorBytes) : cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { positions, nextCursor };
}

export async function getAccountPositions(
  client: WaterXClient,
  args: {
    ticker: string;
    accountObjectAddress: string;
    basePriceUsd: bigint | number;
    collateralPriceUsd?: bigint | number;
    lpType?: string;
  },
): Promise<PositionDataView[]> {
  const tx = new Transaction();
  getAccountPositionsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      wxaRegistry: tx.object(client.config.packages.waterx_account.account_registry),
      basePriceUsd: args.basePriceUsd,
      collateralPriceUsd: args.collateralPriceUsd ?? 0n,
      accountObjectAddress: args.accountObjectAddress,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return bcs.vector(PositionData).parse(await simulateAndExtract(client, tx));
}

export async function getAccountOrders(
  client: WaterXClient,
  args: {
    ticker: string;
    accountObjectAddress: string;
    basePriceUsd?: bigint | number;
    lpType?: string;
  },
): Promise<OrderDataView[]> {
  const tx = new Transaction();
  getAccountOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: args.basePriceUsd ?? 0n,
      accountObjectAddress: args.accountObjectAddress,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);
  return bcs.vector(OrderData).parse(await simulateAndExtract(client, tx));
}

export type RedeemRequestDataView = ReturnType<typeof RedeemRequestData.parse>;

export async function getRedeemRequests(
  client: WaterXClient,
  args: { lpType?: string } & PageOpts = {},
): Promise<{ requests: RedeemRequestDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getRedeemRequestsCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      pool: tx.object(client.config.packages.wlp.wlp_pool),
      cursor: args.cursor ?? 0n,
      pageSize: args.pageSize ?? 100n,
    },
    typeArguments: [withLp(client, args.lpType)],
  })(tx);

  tx.setSender(SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { requests: [] };
  const reqBytes = ret[0]?.value?.bcs;
  const cursorBytes = ret[1]?.value?.bcs;
  if (!reqBytes) return { requests: [] };
  const buf = typeof reqBytes === "string" ? fromBase64(reqBytes) : reqBytes;
  const requests = bcs.vector(RedeemRequestData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = typeof cursorBytes === "string" ? fromBase64(cursorBytes) : cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { requests, nextCursor };
}

// Silence unused import warning until VECTOR_PAGE is wired into a public helper.
void VECTOR_PAGE;
