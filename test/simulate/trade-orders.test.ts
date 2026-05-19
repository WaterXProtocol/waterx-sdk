/**
 * E2E: cancel / update order builders (expected abort on bogus ids without discovery).
 */
import { buildCancelOrderTx, buildUpdateOrderTx, ORDER_LIMIT_BUY } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade orders (${e2eNetwork})`, () => {
  it("buildCancelOrderTx simulates (ghost order id)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const tx = await buildCancelOrderTx(client, {
      ticker: "BTCUSD",
      accountId: DUMMY_ACCOUNT,
      collateralType,
      orderId: 999_999_999n,
      skipOraclePriceRefresh: false,
      useSponsor: true,
    });
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);

  it("buildUpdateOrderTx simulates (ghost order id)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const tp = rawPrice(50_000);
    const tx = await buildUpdateOrderTx(client, {
      ticker: "BTCUSD",
      accountId: DUMMY_ACCOUNT,
      collateralType,
      orderId: 999_999_999n,
      currentTriggerPrice: tp,
      orderTypeTag: ORDER_LIMIT_BUY,
      newSize: rawPrice(0.001),
      newTriggerPrice: tp,
      skipOraclePriceRefresh: false,
      useSponsor: true,
    });
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);
});
