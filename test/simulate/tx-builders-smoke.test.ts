/**
 * E2E: dry-run a market-order place PTB (oracle refresh + request + execute).
 */
import { buildPlaceOrderTx } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  skipHermesIfFeedUnavailable,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`tx-builders smoke simulate (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx simulates (market form)", async (ctx) => {
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
      throw e;
    }
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);
});
