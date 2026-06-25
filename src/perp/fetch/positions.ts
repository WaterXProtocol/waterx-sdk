/**
 * Position / order reads + paginated market & account lists + redeem-request
 * list (`waterx_perp_view`).
 */

import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";

import {
  getAccountOrders as getAccountOrdersCall,
  getAccountPositions as getAccountPositionsCall,
  getMarketOrders as getMarketOrdersCall,
  getMarketPositions as getMarketPositionsCall,
  getRedeemRequests as getRedeemRequestsCall,
  OrderData,
  orderData as orderDataCall,
  PositionData,
  positionData as positionDataCall,
  positionExists as positionExistsCall,
  RedeemRequestData,
} from "../../generated/waterx_perp_view/view.ts";
import type { PerpClient } from "../client.ts";
import { DRY_RUN_SENDER } from "../constants.ts";
import { simulateAndExtract, toBytes, withLp, type SimulationResult } from "./simulate.ts";

// ============================================================================
// Position
// ============================================================================

export type PositionDataView = ReturnType<typeof PositionData.parse>;

export async function positionExists(
  client: PerpClient,
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
  client: PerpClient,
  args: {
    ticker: string;
    positionId: bigint | number;
    /** Human-readable USD prices for Pnl / liq price calc; pass 0n if unsure. */
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
  client: PerpClient,
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

export async function getMarketOrders(
  client: PerpClient,
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

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { orders: [] };
  const ordersBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!ordersBytes) return { orders: [] };
  const ordersBuf = ordersBytes;
  const orders = bcs.vector(OrderData).parse(ordersBuf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { orders, nextCursor };
}

export async function getMarketPositions(
  client: PerpClient,
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

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { positions: [] };
  const positionsBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!positionsBytes) return { positions: [] };
  const buf = positionsBytes;
  const positions = bcs.vector(PositionData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { positions, nextCursor };
}

export async function getAccountPositions(
  client: PerpClient,
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
  client: PerpClient,
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
  client: PerpClient,
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

  tx.setSender(DRY_RUN_SENDER);
  const sim = (await client.simulate(tx)) as unknown as SimulationResult;
  const ret = sim.commandResults?.[0]?.returnValues;
  if (!ret) return { requests: [] };
  const reqBytes = toBytes(ret[0]?.bcs) ?? toBytes(ret[0]?.value?.bcs);
  const cursorBytes = toBytes(ret[1]?.bcs) ?? toBytes(ret[1]?.value?.bcs);
  if (!reqBytes) return { requests: [] };
  const buf = reqBytes;
  const requests = bcs.vector(RedeemRequestData).parse(buf);
  let nextCursor: bigint | undefined;
  if (cursorBytes) {
    const cb = cursorBytes;
    const opt = bcs.option(bcs.u64()).parse(cb);
    if (opt) nextCursor = BigInt(opt);
  }
  return { requests, nextCursor };
}
