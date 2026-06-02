import { Transaction } from "@mysten/sui/transactions";
import { placeOrder } from "~predict/prediction.ts";
import { describe, expect, it } from "vitest";

import { minimalPlaceOrderParams } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import { assertLastMoveCall, listMoveCalls } from "../helpers/ptb.ts";

describe("ptb helpers", () => {
  it("listMoveCalls ignores non-MoveCall commands", () => {
    const tx = new Transaction();
    tx.setSender("0xf036ca849843fab73fa08376ca87dc43389fc94606cb245046886722953fbc51");
    expect(listMoveCalls(tx)).toEqual([]);
  });

  it("assertLastMoveCall validates the final move call", () => {
    const client = createMockPredictClient();
    const tx = new Transaction();
    placeOrder(client, tx, minimalPlaceOrderParams(client));
    expect(() =>
      assertLastMoveCall(tx, {
        module: "waterx_prediction",
        function: "place_order",
        typeArguments: [client.settlementCoinType()],
      }),
    ).not.toThrow();
    expect(() => assertLastMoveCall(tx, { module: "account", function: "nope" })).toThrow(/module/);
  });
});
