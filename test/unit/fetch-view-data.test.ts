/**
 * Unit tests for fetch.ts view helpers (mocked simulate).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAccountData,
  getAccountOrders,
  getAccountPositions,
  getMarketData,
  getMarketOrders,
  getMarketPositions,
  getOrder,
  getPoolData,
  getPosition,
  getRedeemRequests,
  getRefererFor,
  getTokenPoolData,
  isValidReferralCode,
  positionExists,
  referralCodeExists,
} from "../../src/fetch.ts";
import {
  accountDataNoneBytes,
  accountDataSomeBytes,
  addressOptionBytes,
  boolBytes,
  cursorNoneBytes,
  cursorSomeBytes,
  marketDataBytes,
  orderDataBytes,
  poolDataBytes,
  positionDataBytes,
  redeemRequestDataBytes,
  tokenPoolDataBytes,
  vectorOrderBytes,
  vectorPositionBytes,
  vectorRedeemBytes,
} from "../helpers/fixtures/fetch-mock-bcs.ts";
import {
  mockSimulateNoReturnValues,
  mockSimulatePaged,
  mockSimulatePagedNested,
  mockSimulateReturn,
} from "../helpers/fixtures/mock-simulate.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";
import { mockSuiAddress } from "../helpers/fixtures/sui-mock-fixtures.ts";

describe("fetch view helpers (mocked simulate)", () => {
  const client = createUnitTestClient();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getAccountData returns parsed account", async () => {
    mockSimulateReturn(client, [{ bcs: accountDataSomeBytes() }]);
    const data = await getAccountData(client, mockSuiAddress("aa"));
    expect(data?.account_id).toBe(mockSuiAddress("aa"));
  });

  it("getAccountData returns undefined when option is none", async () => {
    mockSimulateReturn(client, [{ bcs: accountDataNoneBytes() }]);
    const data = await getAccountData(client, mockSuiAddress("aa"));
    expect(data).toBeUndefined();
  });

  it("getMarketData / getPoolData / getTokenPoolData", async () => {
    mockSimulateReturn(client, [{ bcs: marketDataBytes() }]);
    const market = await getMarketData(client, { ticker: "BTCUSD" });
    expect(market.symbol).toBe("BTCUSD");

    mockSimulateReturn(client, [{ bcs: marketDataBytes() }]);
    const customLp = "0xcustom::wlp::WLP";
    await getMarketData(client, { ticker: "BTCUSD", lpType: customLp });

    mockSimulateReturn(client, [{ bcs: poolDataBytes() }]);
    const pool = await getPoolData(client, { lpType: customLp });
    expect(pool.is_active).toBe(true);

    mockSimulateReturn(client, [{ bcs: tokenPoolDataBytes() }]);
    const token = await getTokenPoolData(client, { tokenIndex: 0, lpType: customLp });
    expect(token.token_decimal).toBe(6);
  });

  it("positionExists + getPosition + getOrder", async () => {
    mockSimulateReturn(client, [{ bcs: boolBytes(true) }]);
    expect(await positionExists(client, { ticker: "BTCUSD", positionId: 1n })).toBe(true);

    mockSimulateReturn(client, [{ bcs: positionDataBytes() }]);
    const pos = await getPosition(client, {
      ticker: "BTCUSD",
      positionId: 1n,
      basePriceUsd: 50_000n,
      collateralPriceUsd: 1n,
    });
    expect(pos.position_id).toBe("1");

    mockSimulateReturn(client, [{ bcs: orderDataBytes() }]);
    const order = await getOrder(client, {
      ticker: "BTCUSD",
      orderId: 1n,
      orderTypeTag: 0,
      triggerPrice: 50_000_000_000_000n,
      basePriceUsd: 50_000n,
    });
    expect(order.order_id).toBe("1");
  });

  it("getMarketOrders with pagination cursor", async () => {
    mockSimulatePaged(client, vectorOrderBytes(2), cursorSomeBytes(99n));
    const page = await getMarketOrders(client, {
      ticker: "BTCUSD",
      basePriceUsd: 50_000n,
      cursor: 5n,
      pageSize: 2n,
      lpType: "0xcustom::wlp::WLP",
    });
    expect(page.orders).toHaveLength(2);
    expect(page.nextCursor).toBe(99n);
  });

  it("getMarketOrders reads nested value.bcs and returns empty without order bytes", async () => {
    mockSimulatePagedNested(client, vectorOrderBytes(1), cursorSomeBytes(3n));
    const nested = await getMarketOrders(client, { ticker: "BTCUSD" });
    expect(nested.orders).toHaveLength(1);
    expect(nested.nextCursor).toBe(3n);

    mockSimulateReturn(client, [{}, { bcs: cursorNoneBytes() }]);
    const empty = await getMarketOrders(client, { ticker: "BTCUSD" });
    expect(empty.orders).toEqual([]);
  });

  it("getMarketOrders returns empty when simulate has no return values", async () => {
    mockSimulateReturn(client, []);
    const page = await getMarketOrders(client, { ticker: "BTCUSD" });
    expect(page.orders).toEqual([]);
  });

  it("getMarketOrders returns empty when commandResults lack returnValues", async () => {
    mockSimulateNoReturnValues(client);
    const page = await getMarketOrders(client, { ticker: "BTCUSD" });
    expect(page.orders).toEqual([]);
  });

  it("getMarketPositions with positions and cursor", async () => {
    mockSimulatePaged(client, vectorPositionBytes(1), cursorNoneBytes());
    const page = await getMarketPositions(client, {
      ticker: "BTCUSD",
      basePriceUsd: 1n,
      collateralPriceUsd: 1n,
      cursor: 0n,
      pageSize: 50n,
      lpType: "0xcustom::wlp::WLP",
    });
    expect(page.positions).toHaveLength(1);
    expect(page.nextCursor).toBeUndefined();

    mockSimulatePagedNested(client, vectorPositionBytes(2), cursorSomeBytes(11n));
    const nested = await getMarketPositions(client, { ticker: "BTCUSD", basePriceUsd: 1n });
    expect(nested.positions).toHaveLength(2);
    expect(nested.nextCursor).toBe(11n);

    mockSimulateReturn(client, [{}, { bcs: cursorNoneBytes() }]);
    const empty = await getMarketPositions(client, { ticker: "BTCUSD", basePriceUsd: 1n });
    expect(empty.positions).toEqual([]);

    mockSimulateNoReturnValues(client);
    const noRet = await getMarketPositions(client, { ticker: "BTCUSD", basePriceUsd: 1n });
    expect(noRet.positions).toEqual([]);
  });

  it("getAccountPositions + getAccountOrders", async () => {
    mockSimulateReturn(client, [{ bcs: vectorPositionBytes(1) }]);
    const positions = await getAccountPositions(client, {
      ticker: "BTCUSD",
      accountObjectAddress: mockSuiAddress("aa"),
      basePriceUsd: 1n,
    });
    expect(positions).toHaveLength(1);

    mockSimulateReturn(client, [{ bcs: vectorOrderBytes(1) }]);
    const orders = await getAccountOrders(client, {
      ticker: "BTCUSD",
      accountObjectAddress: mockSuiAddress("aa"),
    });
    expect(orders).toHaveLength(1);
  });

  it("getRedeemRequests paginated", async () => {
    mockSimulatePaged(client, vectorRedeemBytes(1), cursorSomeBytes(7n));
    const page = await getRedeemRequests(client, { pageSize: 10n, lpType: "0xcustom::wlp::WLP" });
    expect(page.requests).toHaveLength(1);
    expect(page.nextCursor).toBe(7n);
  });

  it("getRedeemRequests returns empty when primary BCS is missing", async () => {
    mockSimulateReturn(client, [{}, { bcs: cursorNoneBytes() }]);
    const page = await getRedeemRequests(client);
    expect(page.requests).toEqual([]);
  });

  it("getRedeemRequests returns empty when simulate has no returnValues array", async () => {
    mockSimulateNoReturnValues(client);
    const page = await getRedeemRequests(client, { cursor: 1n, pageSize: 5n });
    expect(page.requests).toEqual([]);
  });

  it("getRedeemRequests reads nested cursor bytes", async () => {
    mockSimulatePagedNested(client, vectorRedeemBytes(2), cursorSomeBytes(12n));
    const page = await getRedeemRequests(client);
    expect(page.requests).toHaveLength(2);
    expect(page.nextCursor).toBe(12n);
  });

  it("referral simulate helpers", async () => {
    mockSimulateReturn(client, [{ bcs: addressOptionBytes() }]);
    expect(await getRefererFor(client, mockSuiAddress("dd"))).toBeUndefined();

    mockSimulateReturn(client, [{ bcs: addressOptionBytes(mockSuiAddress("cc")) }]);
    const referer = await getRefererFor(client, mockSuiAddress("dd"));
    expect(referer).toBe(mockSuiAddress("cc"));

    mockSimulateReturn(client, [{ bcs: boolBytes(true) }]);
    expect(await isValidReferralCode(client, "abc")).toBe(true);

    mockSimulateReturn(client, [{ bcs: boolBytes(false) }]);
    expect(await referralCodeExists(client, "unused")).toBe(false);
  });

  it("throws when referral package missing", async () => {
    const bare = createUnitTestClient();
    delete (bare.config.packages as { bucket_referral?: unknown }).bucket_referral;
    await expect(getRefererFor(bare, mockSuiAddress("aa"))).rejects.toThrow(
      /referral package not configured/,
    );
  });
});
