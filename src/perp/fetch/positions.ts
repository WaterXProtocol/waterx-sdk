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
import { toU64, toU128 } from "../../utils/validate.ts";
import type { PerpClient } from "../client.ts";
import { DRY_RUN_SENDER } from "../constants.ts";
import { simulateAndExtract, toBytes, withLp, type SimulationResult } from "./simulate.ts";

/**
 * WHOLE-DOLLAR integer USD price for the `waterx_perp_view` read params
 * (`80000n` for BTC at $80k). The Move view applies `float::from(...)`
 * internally — do NOT pass a 1e9-scaled `rawPrice()` value or every
 * pnl/notional-derived field inflates by 1e9 (`rawPrice()` is for tx-build
 * args only; the u128 order-book `triggerPrice` key on `getOrder` is the one
 * view param that still takes that scale). Sub-$1 prices cannot be
 * represented (u64 whole dollars). The price only bases the
 * pnl / close-fee / notional-derived fields — `0n` zero-bases them (still
 * computed with price 0, not skipped).
 */
export type WholeDollarUsdPrice = bigint | number;

const PLAIN_INT_RE = /^-?\d+$/;

/**
 * Parse a user/env-supplied value into a whole-dollar u64 price
 * (`WholeDollarUsdPrice`) with NO silent rounding: throws `RangeError` on
 * fractional, negative, non-finite, non-numeric, or `> u64::MAX` input. If
 * rounding is ever wanted it must be explicit at the call site
 * (e.g. `parseWholeDollarU64(Math.round(x))`) — never baked in here.
 *
 * The numeric domain (finite → safe integer → non-negative → `<= u64::MAX`) is
 * `toU64`'s and is NOT restated here; this function only adds the string form,
 * whose digits parse exactly past the 2^53 f64 cliff.
 */
export function parseWholeDollarU64(value: string | number): bigint {
  const label = "whole-dollar USD price";
  if (typeof value !== "string") return toU64(value, label);

  const trimmed = value.trim();
  if (!PLAIN_INT_RE.test(trimmed)) {
    throw new RangeError(`${label} must be a plain integer string, got "${value}"`);
  }

  return toU64(BigInt(trimmed), label);
}

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
      positionId: toU64(args.positionId, "positionId"),
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
    basePriceUsd: WholeDollarUsdPrice;
    collateralPriceUsd: WholeDollarUsdPrice;
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
      basePriceUsd: toU64(args.basePriceUsd, "basePriceUsd"),
      collateralPriceUsd: toU64(args.collateralPriceUsd, "collateralPriceUsd"),
      positionId: toU64(args.positionId, "positionId"),
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
    /** Raw 1e9-scaled u128 order-book key — same scale as tx-build `rawPrice()`. */
    triggerPrice: bigint | number;
    basePriceUsd: WholeDollarUsdPrice;
    lpType?: string;
  },
): Promise<OrderDataView> {
  const tx = new Transaction();
  orderDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: toU64(args.basePriceUsd, "basePriceUsd"),
      orderTypeTag: args.orderTypeTag,
      triggerPrice: toU128(args.triggerPrice, "triggerPrice"),
      orderId: toU64(args.orderId, "orderId"),
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
    /** Defaults to `0n`. */
    basePriceUsd?: WholeDollarUsdPrice;
    lpType?: string;
  } & PageOpts,
): Promise<{ orders: OrderDataView[]; nextCursor?: bigint }> {
  const tx = new Transaction();
  getMarketOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: toU64(args.basePriceUsd ?? 0n, "basePriceUsd"),
      cursor: toU64(args.cursor ?? 0n, "cursor"),
      pageSize: toU64(args.pageSize ?? 100n, "pageSize"),
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
    basePriceUsd: WholeDollarUsdPrice;
    /** Defaults to `0n`. */
    collateralPriceUsd?: WholeDollarUsdPrice;
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
      basePriceUsd: toU64(args.basePriceUsd, "basePriceUsd"),
      collateralPriceUsd: toU64(args.collateralPriceUsd ?? 0n, "collateralPriceUsd"),
      cursor: toU64(args.cursor ?? 0n, "cursor"),
      pageSize: toU64(args.pageSize ?? 100n, "pageSize"),
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
    basePriceUsd: WholeDollarUsdPrice;
    /** Defaults to `0n`. */
    collateralPriceUsd?: WholeDollarUsdPrice;
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
      basePriceUsd: toU64(args.basePriceUsd, "basePriceUsd"),
      collateralPriceUsd: toU64(args.collateralPriceUsd ?? 0n, "collateralPriceUsd"),
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
    /** Defaults to `0n`. */
    basePriceUsd?: WholeDollarUsdPrice;
    lpType?: string;
  },
): Promise<OrderDataView[]> {
  const tx = new Transaction();
  getAccountOrdersCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: args.ticker,
      basePriceUsd: toU64(args.basePriceUsd ?? 0n, "basePriceUsd"),
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
      cursor: toU64(args.cursor ?? 0n, "cursor"),
      pageSize: toU64(args.pageSize ?? 100n, "pageSize"),
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
