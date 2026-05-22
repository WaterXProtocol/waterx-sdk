/**
 * E2E: keeper entrypoints compose without PTB wiring errors (simulate may abort).
 */
import { Transaction } from "@mysten/sui/transactions";
import { liquidate, matchOrders, ORDER_LIMIT_BUY, updateFundingRate } from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { assertSimulateReached } from "../helpers/e2e/simulate-assertions.ts";
import { client, DUMMY_SENDER, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";

describe(`keeper (${e2eNetwork})`, () => {
  const collateralType = client.getPoolTokenType("USDCUSD");

  it("liquidate PTB simulates", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(80_000_000);
    liquidate(client, tx, {
      ticker: "BTCUSD",
      collateralType,
      positionId: 1n,
    });
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);

  it("matchOrders PTB simulates", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(120_000_000);
    matchOrders(client, tx, {
      ticker: "BTCUSD",
      collateralType,
      orderTypeTag: ORDER_LIMIT_BUY,
      triggerPrice: rawPrice(50_000),
      maxFills: 2n,
    });
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);

  it("updateFundingRate PTB simulates", async () => {
    const tx = new Transaction();
    tx.setSender(DUMMY_SENDER);
    tx.setGasBudget(40_000_000);
    updateFundingRate(client, tx, { ticker: "BTCUSD" });
    const sim = await client.simulate(tx);
    assertSimulateReached(sim);
  }, 120_000);
});
