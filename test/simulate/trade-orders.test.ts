/**
 * E2E: cancel / update order builders (expected abort on bogus ids without discovery).
 */
import { buildCancelOrderTx, buildUpdateOrderTx, ORDER_LIMIT_BUY } from "@waterx/sdk";
import { describe, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipIfTransientInfrastructureError,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade orders (${e2eNetwork})`, () => {
  it("buildCancelOrderTx simulates (ghost order id)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    let tx;
    try {
      tx = await buildCancelOrderTx(client, {
        ticker: "BTCUSD",
        accountId: DUMMY_ACCOUNT,
        collateralType,
        orderId: 999_999_999n,
        skipOraclePriceRefresh: false,
        useSponsor: true,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    assertSimulateReached(sim);
  }, 180_000);

  it("buildUpdateOrderTx simulates (ghost order id)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const tp = rawPrice(50_000);
    let tx;
    try {
      tx = await buildUpdateOrderTx(client, {
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
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    assertSimulateReached(sim);
  }, 180_000);
});
