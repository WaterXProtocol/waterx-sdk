/**
 * E2E: main leg + bundled TP/SL-style reduce-only pre-orders (shape coverage).
 */
import { buildPlaceOrderTx } from "@waterx/sdk";
import { describe, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipIfTransientInfrastructureError,
  skipSimulateIfOracleTransient,
  withInfrastructureRetry,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade pre-orders (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx with reduce-only pre-order legs (simulate)", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const sz = rawPrice(0.0001);
    const tpPx = rawPrice(120_000);
    const slPx = rawPrice(40_000);

    let tx;
    try {
      tx = await withInfrastructureRetry(() =>
        buildPlaceOrderTx(client, {
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
        }),
      );
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }

    tx.setSender(DUMMY_ACCOUNT);
    try {
      const sim = await simulateWithTransientRetry(() => client.simulate(tx), { attempts: 5 });
      if (skipSimulateIfOracleTransient(ctx, sim)) return;
      assertSimulateReached(sim);
    } catch (e) {
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
  }, 180_000);
});
