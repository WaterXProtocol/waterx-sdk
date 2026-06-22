/**
 * E2E: paginated market orders / positions (`cursor` + `pageSize`).
 */
import { getMarketOrders, getMarketPositions } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";

describe(`read pagination (${e2eNetwork})`, () => {
  const ticker = "BTCUSD";
  const basePx = rawPrice(50_000);

  it("lists market orders with cursor + pageSize", async () => {
    const first = await getMarketOrders(client, {
      ticker,
      basePriceUsd: basePx,
      cursor: 0n,
      pageSize: 5n,
    });
    expect(Array.isArray(first.orders)).toBe(true);
    if (first.nextCursor != null) {
      const second = await getMarketOrders(client, {
        ticker,
        basePriceUsd: basePx,
        cursor: first.nextCursor,
        pageSize: 5n,
      });
      expect(Array.isArray(second.orders)).toBe(true);
    }
  }, 90_000);

  it("lists market positions with cursor + pageSize", async () => {
    const first = await getMarketPositions(client, {
      ticker,
      basePriceUsd: basePx,
      collateralPriceUsd: 1n,
      cursor: 0n,
      pageSize: 5n,
    });
    expect(Array.isArray(first.positions)).toBe(true);
    if (first.nextCursor != null) {
      const second = await getMarketPositions(client, {
        ticker,
        basePriceUsd: basePx,
        collateralPriceUsd: 1n,
        cursor: first.nextCursor,
        pageSize: 5n,
      });
      expect(Array.isArray(second.positions)).toBe(true);
    }
  }, 90_000);
});
