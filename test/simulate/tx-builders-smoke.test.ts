/**
 * E2E: dry-run a market-order place PTB (oracle refresh + request + execute).
 */
import { buildPlaceOrderTx } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`tx-builders smoke simulate (${e2eNetwork})`, () => {
  it("buildPlaceOrderTx simulates (market form)", async () => {
    const collateralType = client.getPoolTokenType("USDCUSD");
    const tx = await buildPlaceOrderTx(client, {
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
    tx.setSender(DUMMY_ACCOUNT);
    const sim = await client.simulate(tx);
    expect(sim).toBeDefined();
    const kind = (sim as { $kind?: string }).$kind;
    expect(kind === "Success" || kind === "FailedTransaction").toBe(true);
  }, 120_000);
});
