/**
 * E2E: market-form place order (oracle refresh + sponsor path), primary open simulate smoke.
 */
import { buildPlaceOrderTx } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  skipHermesIfFeedUnavailable,
  skipIfTransientInfrastructureError,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`trade open (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx simulates market-form entry on BTCUSD", async (ctx) => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    let tx;
    try {
      tx = await buildPlaceOrderTx(client, {
        ticker: "BTCUSD",
        accountId: DUMMY_ACCOUNT,
        collateralType,
        collateralTicker: "USDCUSD",
        main: {
          isLong: true,
          isStopOrder: false,
          reduceOnly: false,
          size: rawPrice(0.0001),
          acceptablePrice: rawPrice(200_000),
          collateralAmount: 1_000_000n,
        },
        skipOraclePriceRefresh: false,
        useSponsor: true,
      });
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);
});
