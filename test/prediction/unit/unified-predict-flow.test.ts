import { Transaction } from "@mysten/sui/transactions";
import { placeOrder } from "~predict/prediction.ts";
import { describe, expect, it } from "vitest";

import { Client } from "../../../src/sdk.ts";
import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

// Representative prediction flow through the unified `Client` facade. Confirms
// `client.predict.<fn>(...)` builds exactly what the underlying free function
// does with the same client pre-bound. Uses the prediction mock client (no
// network); the perp side is an unused stub.
describe("unified Client — prediction representative flow", () => {
  const predictClient = createMockPredictClient();
  const client = Client.fromClients({} as never, predictClient);
  const params = minimalPlaceOrderParams(predictClient);

  it("client.predict.placeOrder builds the same PTB as the free function", () => {
    const viaFacade = new Transaction();
    client.predict.placeOrder(viaFacade, params);

    const viaFree = new Transaction();
    placeOrder(predictClient, viaFree, params);

    expect(listMoveCalls(viaFacade)).toStrictEqual(listMoveCalls(viaFree));
    expect(listMoveCalls(viaFacade).length).toBeGreaterThan(0);
  });

  it("client.predict pre-binds the same client passed to the facade", () => {
    expect(client.predictClient).toBe(predictClient);
    expect(client.predict.placeOrder).not.toBe(placeOrder);
    expect(client.predict.placeOrder).toBeTypeOf("function");
  });
});
