import { Transaction } from "@mysten/sui/transactions";
import { createGift, deriveGiftKeypair } from "~predict/gift.ts";
import { placeOrder } from "~predict/prediction.ts";
import { describe, expect, it } from "vitest";

import { Client } from "../../../src/sdk.ts";
import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

const FIXED_SEED = new Uint8Array(16);
const SOURCE_ACCOUNT = "0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51";

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
    expect(client.predict).toBe(predictClient);
    expect(client.predict.placeOrder).not.toBe(placeOrder);
    expect(client.predict.placeOrder).toBeTypeOf("function");
  });

  it("client.predict.createGift builds the same PTB as the free function", () => {
    const pubkey = deriveGiftKeypair(FIXED_SEED).getPublicKey().toRawBytes();
    const giftParams = {
      sourceAccountId: SOURCE_ACCOUNT,
      sourcePositionId: 7n,
      pubkey,
      shareCount: 5n,
      expiresAtMs: 99_999_999_999_999n,
    };

    const viaFacade = new Transaction();
    client.predict.createGift(viaFacade, giftParams);

    const viaFree = new Transaction();
    createGift(predictClient, viaFree, giftParams);

    expect(listMoveCalls(viaFacade)).toStrictEqual(listMoveCalls(viaFree));
    expect(listMoveCalls(viaFacade).at(-1)?.function).toBe("create_gift");
  });

  it("client.predict exposes gift runtime but not pure crypto helpers", () => {
    expect(client.predict.createGift).toBeTypeOf("function");
    expect(client.predict.getGift).toBeTypeOf("function");
    expect((client.predict as unknown as Record<string, unknown>).encodeGiftUrl).toBeUndefined();
  });
});
