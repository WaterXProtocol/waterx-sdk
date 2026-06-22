import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { Client } from "../../../src/sdk.ts";
import { placeOrderRequest } from "../../../src/user/order.ts";
import { rawPrice } from "../../../src/utils/math.ts";
import { MOCK_USDC_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

// Representative perp flow through the unified `Client` facade. Confirms that
// `client.perp.<fn>(...)` produces exactly what the underlying free function
// does with the same client pre-bound. Uses the perp mock client (no network);
// the prediction side is an unused stub.
describe("unified Client — perp representative flow", () => {
  const perpClient = createUnitTestClient();
  const client = Client.fromClients(perpClient, {} as never);

  const params = {
    ticker: "BTCUSD",
    accountId: PTB_DUMMY_ACCOUNT_ID,
    collateralType: MOCK_USDC_TYPE,
    main: {
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: rawPrice(0.001),
      acceptablePrice: rawPrice(100_000),
      collateralAmount: 10_000_000n,
    },
  };

  it("client.perp.placeOrderRequest builds the same PTB as the free function", () => {
    const viaFacade = new Transaction();
    client.perp.placeOrderRequest(viaFacade, params);

    const viaFree = new Transaction();
    placeOrderRequest(perpClient, viaFree, params);

    expect(viaFacade.getData().commands).toStrictEqual(viaFree.getData().commands);
    expect(viaFacade.getData().commands.length).toBeGreaterThanOrEqual(2);
  });

  it("client.perp pre-binds the same client passed to the facade", () => {
    expect(client.perpClient).toBe(perpClient);
    // Bound method is a wrapper, not the raw free function.
    expect(client.perp.placeOrderRequest).not.toBe(placeOrderRequest);
    expect(client.perp.placeOrderRequest).toBeTypeOf("function");
  });
});
