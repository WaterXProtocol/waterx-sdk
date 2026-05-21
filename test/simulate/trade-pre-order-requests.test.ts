/**
 * E2E: standalone `add_pre_order` / `cancel_pre_order` **tx-builders** (ghost IDs — PTB still reaches simulate).
 */
import { buildAddPreOrderTx, buildCancelPreOrderTx } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade pre-order requests (${e2eNetwork})`, () => {
  it("buildCancelPreOrderTx simulates (ghost main/pre ids)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    let tx;
    try {
      tx = await buildCancelPreOrderTx(client, {
        ticker: "BTCUSD",
        accountId: DUMMY_ACCOUNT,
        collateralType,
        mainOrderId: 999_999_999n,
        preOrderId: 999_999_998n,
        collateralTicker: "USDCUSD",
        skipOraclePriceRefresh: false,
        useSponsor: true,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);

  it("buildAddPreOrderTx simulates reduce-only TP leg (ghost main order)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const sz = rawPrice(0.0001);
    let tx;
    try {
      tx = await buildAddPreOrderTx(client, {
        ticker: "BTCUSD",
        accountId: DUMMY_ACCOUNT,
        collateralType,
        mainOrderId: 999_999_999n,
        preOrder: {
          isLong: false,
          isStopOrder: false,
          reduceOnly: true,
          size: sz,
          triggerPrice: rawPrice(120_000),
          collateralAmount: 0n,
        },
        collateralTicker: "USDCUSD",
        skipOraclePriceRefresh: false,
        useSponsor: true,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);
});
