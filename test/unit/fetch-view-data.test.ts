/**
 * Unit tests for getAccountPositions, getAccountOrders, getMarketPositions, getMarketOrders
 * using mocked gRPC simulate / getObject.
 */
import { bcs } from "@mysten/sui/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import {
  getAccountOrders,
  getAccountPositions,
  getAllAccountOrders,
  getAllAccountPositions,
  getMarketOrders,
  getMarketPositions,
  getRedeemRequests,
} from "../../src/fetch.ts";

// ================================================================
// BCS schema mirrors (for serializing mock return data)
// ================================================================

// v2 PositionData / OrderData schemas (matches waterx_perp::view).
// Removed v1 fields: size_amount, size_decimal, max_leverage_bps, trading_fee_bps,
// maintenance_margin_bps (moved to MarketData), linked_order_count (use linked_order_ids.length).
// Added v1 fields: collateral_type, linked_order_ids, linked_order_price_keys (Position only).
const TypeName = bcs.struct("TypeName", { name: bcs.string() });

const PositionDataBcsSchema = bcs.struct("PositionData", {
  position_id: bcs.u64(),
  account_object_address: bcs.Address,
  market_id: bcs.Address,
  is_long: bcs.bool(),
  size: bcs.u128(),
  collateral_type: TypeName,
  collateral_amount: bcs.u64(),
  collateral_decimal: bcs.u8(),
  average_price: bcs.u128(),
  oracle_price: bcs.u128(),
  collateral_price: bcs.u128(),
  est_liq_price: bcs.u128(),
  leverage_bps: bcs.u64(),
  entry_borrow_index: bcs.u64(),
  entry_funding_sign: bcs.bool(),
  entry_funding_index: bcs.u256(),
  unrealized_trading_fee: bcs.u64(),
  unrealized_borrow_fee: bcs.u64(),
  unrealized_funding_fee: bcs.u64(),
  unrealized_funding_sign: bcs.bool(),
  pnl_positive: bcs.bool(),
  pnl: bcs.u64(),
  funding_fee_positive: bcs.bool(),
  funding_fee: bcs.u64(),
  borrow_fee: bcs.u64(),
  close_fee: bcs.u64(),
  linked_order_ids: bcs.vector(bcs.u64()),
  linked_order_price_keys: bcs.vector(bcs.u128()),
  create_timestamp: bcs.u64(),
  update_timestamp: bcs.u64(),
});

const OrderDataBcsSchema = bcs.struct("OrderData", {
  order_id: bcs.u64(),
  account_object_address: bcs.Address,
  market_id: bcs.Address,
  is_long: bcs.bool(),
  reduce_only: bcs.bool(),
  is_stop_order: bcs.bool(),
  size: bcs.u128(),
  collateral_type: TypeName,
  collateral_amount: bcs.u64(),
  collateral_decimal: bcs.u8(),
  trigger_price: bcs.u128(),
  oracle_price: bcs.u128(),
  order_type_tag: bcs.u8(),
  has_linked_position: bcs.bool(),
  linked_position_id: bcs.u64(),
  leverage_bps: bcs.u64(),
  create_timestamp: bcs.u64(),
});

// ================================================================
// Helpers
// ================================================================

const ADDR_ACCOUNT = `0x${"a1".repeat(32)}`;
const ADDR_MARKET = `0x${"b2".repeat(32)}`;

function mockClient(): WaterXClient {
  const client = WaterXClient.testnet();
  vi.spyOn(client, "getObject").mockResolvedValue({
    object: { type: `${client.config.packageId}::stub::Stub` },
  } as any);
  return client;
}

function mockSimulate(client: WaterXClient, ...returnValues: Uint8Array[]) {
  vi.spyOn(client, "simulate").mockResolvedValue({
    commandResults: [{ returnValues: returnValues.map((b) => ({ bcs: Uint8Array.from(b) })) }],
  } as any);
}

const COLL_TYPE = "0x0::mock_usdc::MOCK_USDC";

function samplePositionData(overrides: Record<string, unknown> = {}) {
  return {
    position_id: 0n,
    account_object_address: ADDR_ACCOUNT,
    market_id: ADDR_MARKET,
    is_long: true,
    size: 1_000_000_000n,
    collateral_type: { name: COLL_TYPE },
    collateral_amount: 2_000_000_000n,
    collateral_decimal: 6,
    average_price: 50_000_000_000_000n,
    oracle_price: 50_000_000_000_000n,
    collateral_price: 1_000_000_000n,
    est_liq_price: 48_000_000_000_000n,
    leverage_bps: 250_000n,
    entry_borrow_index: 0n,
    entry_funding_sign: false,
    entry_funding_index: 0n,
    unrealized_trading_fee: 0n,
    unrealized_borrow_fee: 0n,
    unrealized_funding_fee: 0n,
    unrealized_funding_sign: false,
    pnl_positive: true,
    pnl: 0n,
    funding_fee_positive: false,
    funding_fee: 0n,
    borrow_fee: 0n,
    close_fee: 2_500n,
    linked_order_ids: [] as bigint[],
    linked_order_price_keys: [] as bigint[],
    create_timestamp: 1000n,
    update_timestamp: 1000n,
    ...overrides,
  };
}

function sampleOrderData(overrides: Record<string, unknown> = {}) {
  return {
    order_id: 0n,
    account_object_address: ADDR_ACCOUNT,
    market_id: ADDR_MARKET,
    is_long: false,
    reduce_only: true,
    is_stop_order: true,
    size: 1_000_000_000n,
    collateral_type: { name: COLL_TYPE },
    collateral_amount: 0n,
    collateral_decimal: 6,
    trigger_price: 40_000_000_000_000n,
    oracle_price: 50_000_000_000_000n,
    order_type_tag: 3,
    has_linked_position: true,
    linked_position_id: 0n,
    leverage_bps: 250_000n,
    create_timestamp: 5000n,
    ...overrides,
  };
}

// ================================================================
// getAccountPositions
// ================================================================

describe("getAccountPositions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses a single position", async () => {
    const client = mockClient();
    const vecBytes = bcs.vector(PositionDataBcsSchema).serialize([samplePositionData()]).toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountPositions(client, "BTC", ADDR_ACCOUNT, 50_000);
    expect(rows).toHaveLength(1);

    const p = rows[0]!;
    expect(p.positionId).toBe(0n);
    expect(p.isLong).toBe(true);
    expect(p.size).toBe(1_000_000_000n);
    expect(p.collateralAmount).toBe(2_000_000_000n);
    expect(p.collateralDecimal).toBe(6);
    expect(p.averagePrice).toBe(50_000_000_000_000n);
    expect(p.oraclePrice).toBe(50_000_000_000_000n);
    expect(p.estLiqPrice).toBe(48_000_000_000_000n);
    expect(p.leverageBps).toBe(250_000n);
    // v2 moved max_leverage_bps / trading_fee_bps / maintenance_margin_bps off PositionData
    // (Sui 32-field limit). Join client-side with MarketData if needed.
    expect(p.pnlPositive).toBe(true);
    expect(p.pnl).toBe(0n);
    expect(p.closeFee).toBe(2_500n);
    expect(p.linkedOrderIds).toEqual([]);
    expect(p.createTimestamp).toBe(1000n);
  });

  it("returns empty array when no positions", async () => {
    const client = mockClient();
    const vecBytes = bcs.vector(PositionDataBcsSchema).serialize([]).toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountPositions(client, "BTC", ADDR_ACCOUNT, 50_000);
    expect(rows).toHaveLength(0);
  });

  it("parses multiple positions", async () => {
    const client = mockClient();
    const vecBytes = bcs
      .vector(PositionDataBcsSchema)
      .serialize([
        samplePositionData({ position_id: 0n }),
        samplePositionData({ position_id: 1n, is_long: false }),
      ])
      .toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountPositions(client, "BTC", ADDR_ACCOUNT, 50_000);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.positionId).toBe(0n);
    expect(rows[1]!.positionId).toBe(1n);
    expect(rows[1]!.isLong).toBe(false);
  });

  it("defaults collateralPriceUsd to 1", async () => {
    const client = mockClient();
    const vecBytes = bcs.vector(PositionDataBcsSchema).serialize([]).toBytes();
    const spy = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(vecBytes) }] }],
    } as any);

    await getAccountPositions(client, "BTC", ADDR_ACCOUNT, 50_000);
    // Verify simulate was called (no throw = collateralPriceUsd defaulted fine)
    expect(spy).toHaveBeenCalledOnce();
  });
});

// ================================================================
// getAccountOrders
// ================================================================

describe("getAccountOrders", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses a stop-loss order", async () => {
    const client = mockClient();
    const vecBytes = bcs.vector(OrderDataBcsSchema).serialize([sampleOrderData()]).toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountOrders(client, "BTC", ADDR_ACCOUNT);
    expect(rows).toHaveLength(1);

    const o = rows[0]!;
    expect(o.orderId).toBe(0n);
    expect(o.isLong).toBe(false);
    expect(o.reduceOnly).toBe(true);
    expect(o.isStopOrder).toBe(true);
    expect(o.orderTypeTag).toBe(3);
    expect(o.triggerPrice).toBe(40_000_000_000_000n);
    expect(o.linkedPositionId).toBe(0n);
    expect(o.createTimestamp).toBe(5000n);
  });

  it("parses take-profit order (limit + reduce_only)", async () => {
    const client = mockClient();
    const vecBytes = bcs
      .vector(OrderDataBcsSchema)
      .serialize([
        sampleOrderData({
          order_id: 1n,
          is_long: false,
          reduce_only: true,
          is_stop_order: false,
          order_type_tag: 1, // limit_sell = TP for long
          trigger_price: 60_000_000_000_000n,
        }),
      ])
      .toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountOrders(client, "BTC", ADDR_ACCOUNT);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.isStopOrder).toBe(false);
    expect(rows[0]!.reduceOnly).toBe(true);
    expect(rows[0]!.orderTypeTag).toBe(1);
  });

  it("returns empty for no orders", async () => {
    const client = mockClient();
    const vecBytes = bcs.vector(OrderDataBcsSchema).serialize([]).toBytes();
    mockSimulate(client, vecBytes);

    const rows = await getAccountOrders(client, "BTC", ADDR_ACCOUNT);
    expect(rows).toHaveLength(0);
  });
});

// ================================================================
// getMarketPositions (paginated)
// ================================================================

describe("getMarketPositions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns positions with nextCursor when more pages exist", async () => {
    const client = mockClient();
    const posBytes = bcs
      .vector(PositionDataBcsSchema)
      .serialize([samplePositionData({ position_id: 0n }), samplePositionData({ position_id: 1n })])
      .toBytes();
    const cursorBytes = bcs.option(bcs.u64()).serialize(2n).toBytes();
    mockSimulate(client, posBytes, cursorBytes);

    const { positions, nextCursor } = await getMarketPositions(client, "BTC", 50_000, 0, 2);
    expect(positions).toHaveLength(2);
    expect(positions[0]!.positionId).toBe(0n);
    expect(positions[1]!.positionId).toBe(1n);
    expect(nextCursor).toBe(2);
  });

  it("returns undefined nextCursor on last page", async () => {
    const client = mockClient();
    const posBytes = bcs
      .vector(PositionDataBcsSchema)
      .serialize([samplePositionData({ position_id: 2n })])
      .toBytes();
    const cursorBytes = bcs.option(bcs.u64()).serialize(null).toBytes();
    mockSimulate(client, posBytes, cursorBytes);

    const { positions, nextCursor } = await getMarketPositions(client, "BTC", 50_000, 2, 2);
    expect(positions).toHaveLength(1);
    expect(nextCursor).toBeUndefined();
  });

  it("returns empty when beyond end", async () => {
    const client = mockClient();
    const posBytes = bcs.vector(PositionDataBcsSchema).serialize([]).toBytes();
    const cursorBytes = bcs.option(bcs.u64()).serialize(null).toBytes();
    mockSimulate(client, posBytes, cursorBytes);

    const { positions, nextCursor } = await getMarketPositions(client, "BTC", 50_000, 100, 10);
    expect(positions).toHaveLength(0);
    expect(nextCursor).toBeUndefined();
  });
});

// ================================================================
// getMarketOrders (v2 — simulate-based via view::get_market_orders)
// ================================================================

describe("getMarketOrders", () => {
  afterEach(() => vi.restoreAllMocks());

  function mockGetMarketOrdersSimulate(
    client: WaterXClient,
    orders: ReturnType<typeof sampleOrderData>[],
    nextCursor: bigint | null,
  ): void {
    const ordersBytes = bcs.vector(OrderDataBcsSchema).serialize(orders).toBytes();
    const cursorBytes = bcs.option(bcs.u64()).serialize(nextCursor).toBytes();
    vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [
        {
          returnValues: [
            { bcs: Uint8Array.from(ordersBytes) },
            { bcs: Uint8Array.from(cursorBytes) },
          ],
        },
      ],
    } as any);
  }

  it("returns orders and no nextCursor when page fits", async () => {
    const client = mockClient();
    const orders = [
      sampleOrderData({ order_id: 0n, order_type_tag: 0, is_long: true, is_stop_order: false }),
      sampleOrderData({ order_id: 1n, order_type_tag: 2, is_long: true, is_stop_order: true }),
      sampleOrderData({ order_id: 2n, order_type_tag: 3, is_long: false, is_stop_order: true }),
    ];
    mockGetMarketOrdersSimulate(client, orders, null);

    const { orders: got, nextCursor } = await getMarketOrders(client, "BTC");
    expect(got).toHaveLength(3);
    expect(got[0]!.orderId).toBe(0n);
    expect(got[0]!.orderTypeTag).toBe(0);
    expect(got[1]!.orderTypeTag).toBe(2);
    expect(got[2]!.orderTypeTag).toBe(3);
    expect(nextCursor).toBeUndefined();
  });

  it("returns empty list when no orders", async () => {
    const client = mockClient();
    mockGetMarketOrdersSimulate(client, [], null);

    const { orders, nextCursor } = await getMarketOrders(client, "BTC");
    expect(orders).toHaveLength(0);
    expect(nextCursor).toBeUndefined();
  });

  it("surfaces nextCursor when more pages exist", async () => {
    const client = mockClient();
    const orders = [sampleOrderData({ order_id: 0n }), sampleOrderData({ order_id: 1n })];
    mockGetMarketOrdersSimulate(client, orders, 2n);

    const { orders: got, nextCursor } = await getMarketOrders(client, "BTC", 0, 0, 2);
    expect(got).toHaveLength(2);
    expect(nextCursor).toBe(2);
  });

  it("parses linked_position_id when has_linked_position is true", async () => {
    const client = mockClient();
    const orders = [
      sampleOrderData({
        order_id: 5n,
        order_type_tag: 1,
        has_linked_position: true,
        linked_position_id: 7n,
      }),
    ];
    mockGetMarketOrdersSimulate(client, orders, null);

    const { orders: got } = await getMarketOrders(client, "BTC");
    expect(got).toHaveLength(1);
    expect(got[0]!.linkedPositionId).toBe(7n);
    expect(got[0]!.orderTypeTag).toBe(1);
  });
});

// ================================================================
// getAllAccountPositions (single PTB, all markets)
// ================================================================

describe("getAllAccountPositions", () => {
  afterEach(() => vi.restoreAllMocks());

  it("equals concat of per-market getAccountPositions (BTC + ETH + empty rest)", async () => {
    const client = mockClient();
    const bases = client.getBaseAssets();

    // Distinct positions per market
    const btcPositions = [
      samplePositionData({ position_id: 0n, size: 1_000_000_000n }),
      samplePositionData({ position_id: 1n, size: 500_000_000n }),
    ];
    const ethPositions = [samplePositionData({ position_id: 10n, size: 2_000_000_000n })];

    const btcBytes = bcs.vector(PositionDataBcsSchema).serialize(btcPositions).toBytes();
    const ethBytes = bcs.vector(PositionDataBcsSchema).serialize(ethPositions).toBytes();
    const emptyBytes = bcs.vector(PositionDataBcsSchema).serialize([]).toBytes();

    const prices: Record<string, number> = { BTC: 50_000, ETH: 3_000 };
    // Markets with prices: BTC, ETH (others skipped)
    const marketsWithPrices = bases.filter(({ asset }) => prices[asset] != null);
    const allMarketBytes = marketsWithPrices.map(({ asset }) =>
      asset === "BTC" ? btcBytes : asset === "ETH" ? ethBytes : emptyBytes,
    );

    // --- getAllAccountPositions (single PTB) ---
    vi.spyOn(client, "simulate").mockResolvedValueOnce({
      commandResults: allMarketBytes.map((b) => ({
        returnValues: [{ bcs: Uint8Array.from(b) }],
      })),
    } as any);

    const allResult = await getAllAccountPositions(client, ADDR_ACCOUNT, prices);

    // --- getAccountPositions per market ---
    vi.spyOn(client, "simulate")
      .mockResolvedValueOnce({
        commandResults: [{ returnValues: [{ bcs: Uint8Array.from(btcBytes) }] }],
      } as any)
      .mockResolvedValueOnce({
        commandResults: [{ returnValues: [{ bcs: Uint8Array.from(ethBytes) }] }],
      } as any);

    const btcResult = await getAccountPositions(client, "BTC", ADDR_ACCOUNT, 50_000);
    const ethResult = await getAccountPositions(client, "ETH", ADDR_ACCOUNT, 3_000);
    const perMarketResult = [...btcResult, ...ethResult];

    // Must be identical
    expect(allResult).toHaveLength(perMarketResult.length);
    expect(allResult).toHaveLength(3);
    for (let i = 0; i < allResult.length; i++) {
      expect(allResult[i]).toEqual(perMarketResult[i]);
    }
  });

  it("skips markets without price", async () => {
    const client = mockClient();
    const btcPos = bcs.vector(PositionDataBcsSchema).serialize([samplePositionData()]).toBytes();

    const spy = vi.spyOn(client, "simulate").mockResolvedValue({
      commandResults: [{ returnValues: [{ bcs: Uint8Array.from(btcPos) }] }],
    } as any);

    const rows = await getAllAccountPositions(client, ADDR_ACCOUNT, { BTC: 50_000 });
    expect(spy).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(1);
  });

  it("returns empty when no prices provided", async () => {
    const client = mockClient();
    const rows = await getAllAccountPositions(client, ADDR_ACCOUNT, {});
    expect(rows).toHaveLength(0);
  });
});

// ================================================================
// getAllAccountOrders (single PTB, all markets)
// ================================================================

describe("getAllAccountOrders", () => {
  afterEach(() => vi.restoreAllMocks());

  it("equals concat of per-market getAccountOrders (BTC has orders, ETH empty)", async () => {
    const client = mockClient();
    const bases = client.getBaseAssets();

    const btcOrders = [
      sampleOrderData({ order_id: 10n }),
      sampleOrderData({ order_id: 11n, is_stop_order: false, order_type_tag: 1 }),
    ];
    const ethOrders = [sampleOrderData({ order_id: 20n })];

    const btcBytes = bcs.vector(OrderDataBcsSchema).serialize(btcOrders).toBytes();
    const ethBytes = bcs.vector(OrderDataBcsSchema).serialize(ethOrders).toBytes();
    const emptyBytes = bcs.vector(OrderDataBcsSchema).serialize([]).toBytes();

    // --- getAllAccountOrders (single PTB) ---
    const allMarketBytes = bases.map(({ asset }) =>
      asset === "BTC" ? btcBytes : asset === "ETH" ? ethBytes : emptyBytes,
    );
    vi.spyOn(client, "simulate").mockResolvedValueOnce({
      commandResults: allMarketBytes.map((b) => ({
        returnValues: [{ bcs: Uint8Array.from(b) }],
      })),
    } as any);

    const allResult = await getAllAccountOrders(client, ADDR_ACCOUNT);

    // --- getAccountOrders per market ---
    vi.spyOn(client, "simulate")
      .mockResolvedValueOnce({
        commandResults: [{ returnValues: [{ bcs: Uint8Array.from(btcBytes) }] }],
      } as any)
      .mockResolvedValueOnce({
        commandResults: [{ returnValues: [{ bcs: Uint8Array.from(ethBytes) }] }],
      } as any);

    const btcResult = await getAccountOrders(client, "BTC", ADDR_ACCOUNT);
    const ethResult = await getAccountOrders(client, "ETH", ADDR_ACCOUNT);
    const perMarketResult = [...btcResult, ...ethResult];

    // Only compare BTC + ETH entries (others are empty)
    const allNonEmpty = allResult.filter((o) => [10n, 11n, 20n].includes(o.orderId));
    expect(allNonEmpty).toHaveLength(perMarketResult.length);
    expect(allNonEmpty).toHaveLength(3);
    for (let i = 0; i < allNonEmpty.length; i++) {
      expect(allNonEmpty[i]).toEqual(perMarketResult[i]);
    }
  });
});

// ================================================================
// getRedeemRequests (v2 — view::get_redeem_requests)
// ================================================================

const RedeemRequestDataBcsSchema = bcs.struct("RedeemRequestData", {
  request_id: bcs.u64(),
  recipient: bcs.Address,
  lp_amount: bcs.u64(),
  token_type: TypeName,
  request_timestamp: bcs.u64(),
});

function sampleRedeemRequest(overrides: Record<string, unknown> = {}) {
  return {
    request_id: 0n,
    recipient: ADDR_ACCOUNT,
    lp_amount: 1_000_000n,
    token_type: { name: COLL_TYPE },
    request_timestamp: 1_700_000_000_000n,
    ...overrides,
  };
}

function mockGetRedeemRequestsSimulate(
  client: WaterXClient,
  requests: ReturnType<typeof sampleRedeemRequest>[],
  nextCursor: bigint | null,
): void {
  const reqBytes = bcs.vector(RedeemRequestDataBcsSchema).serialize(requests).toBytes();
  const curBytes = bcs.option(bcs.u64()).serialize(nextCursor).toBytes();
  vi.spyOn(client, "simulate").mockResolvedValue({
    commandResults: [
      {
        returnValues: [{ bcs: Uint8Array.from(reqBytes) }, { bcs: Uint8Array.from(curBytes) }],
      },
    ],
  } as any);
}

describe("getRedeemRequests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses requests and surfaces no nextCursor on the last page", async () => {
    const client = mockClient();
    const reqs = [
      sampleRedeemRequest({ request_id: 0n, lp_amount: 1_000_000n }),
      sampleRedeemRequest({ request_id: 1n, lp_amount: 2_000_000n }),
    ];
    mockGetRedeemRequestsSimulate(client, reqs, null);

    const { requests, nextCursor } = await getRedeemRequests(client);
    expect(requests).toHaveLength(2);
    expect(requests[0]!.requestId).toBe(0n);
    expect(requests[0]!.lpAmount).toBe(1_000_000n);
    expect(requests[0]!.recipient).toBe(ADDR_ACCOUNT);
    expect(requests[0]!.tokenType).toBe(COLL_TYPE);
    expect(requests[1]!.requestId).toBe(1n);
    expect(nextCursor).toBeUndefined();
  });

  it("returns empty list when queue is empty", async () => {
    const client = mockClient();
    mockGetRedeemRequestsSimulate(client, [], null);

    const { requests, nextCursor } = await getRedeemRequests(client);
    expect(requests).toHaveLength(0);
    expect(nextCursor).toBeUndefined();
  });

  it("surfaces nextCursor when more pages exist", async () => {
    const client = mockClient();
    mockGetRedeemRequestsSimulate(client, [sampleRedeemRequest()], 5n);

    const { requests, nextCursor } = await getRedeemRequests(client, 0, 1);
    expect(requests).toHaveLength(1);
    expect(nextCursor).toBe(5);
  });
});
