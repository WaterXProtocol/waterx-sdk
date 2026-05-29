/**
 * E2E: single position / order reads (`positionExists`, `getPosition`, `getOrder`).
 */
import { getOrder, getPosition, ORDER_LIMIT_BUY, positionExists } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";

describe(`read position + order (${e2eNetwork})`, () => {
  const ticker = "BTCUSD";

  it("positionExists false for huge id", async () => {
    const exists = await positionExists(client, { ticker, positionId: 999_999_999n });
    expect(exists).toBe(false);
  }, 60_000);

  it("getPosition rejects for missing position id", async () => {
    await expect(
      getPosition(client, {
        ticker,
        positionId: 999_999_999n,
        basePriceUsd: 0n,
        collateralPriceUsd: 0n,
      }),
    ).rejects.toThrow();
  }, 60_000);

  it("getOrder simulates for unlikely order id (may abort — still exercises builder)", async () => {
    await expect(
      getOrder(client, {
        ticker,
        orderId: 999_999_999n,
        orderTypeTag: ORDER_LIMIT_BUY,
        triggerPrice: rawPrice(50_000),
        basePriceUsd: rawPrice(50_000),
      }),
    ).rejects.toThrow();
  }, 60_000);
});
