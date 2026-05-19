/**
 * E2E: main leg + bundled TP/SL-style reduce-only pre-orders (shape coverage).
 */
import { buildPlaceOrderTx } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade pre-orders (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx with reduce-only pre-order legs (simulate)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const sz = rawPrice(0.0001);
    const entryPx = rawPrice(50_000);
    const tpPx = rawPrice(120_000);
    const slPx = rawPrice(40_000);
    const tx = await buildPlaceOrderTx(client, {
      ticker: "BTCUSD",
      accountId: DUMMY_ACCOUNT,
      collateralType,
      collateralTicker: "USDCUSD",
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: sz,
        acceptablePrice: rawPrice(200_000),
        collateralAmount: 2_000_000n,
      },
      preOrders: [
        {
          isLong: false,
          isStopOrder: false,
          reduceOnly: true,
          size: sz,
          triggerPrice: tpPx,
          collateralAmount: 0n,
        },
        {
          isLong: false,
          isStopOrder: true,
          reduceOnly: true,
          size: sz,
          triggerPrice: slPx,
          collateralAmount: 0n,
        },
      ],
      skipOraclePriceRefresh: false,
      useSponsor: true,
    });
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await simulateWithTransientRetry(() => client.simulate(tx));
    if (skipSimulateIfOracleTransient(ctx, sim)) return;
    expect(sim).toBeDefined();
  }, 180_000);
});
