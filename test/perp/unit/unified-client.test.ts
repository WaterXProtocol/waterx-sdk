import { describe, expect, it } from "vitest";

import * as perpFetch from "../../../src/fetch.ts";
import * as predAccount from "../../../src/prediction/account.ts";
import * as predAdmin from "../../../src/prediction/admin.ts";
import * as predFetch from "../../../src/prediction/fetch.ts";
import * as predOps from "../../../src/prediction/prediction.ts";
import { Client, perp, prediction, WaterXClient } from "../../../src/sdk.ts";
import * as perpTx from "../../../src/tx-builders.ts";
import * as perpUser from "../../../src/user/index.ts";

// Stub clients: the facade constructor only binds functions; it never touches
// the client until a builder is actually invoked, so empty stubs are enough.
const perpClient = {} as unknown as WaterXClient;
const predictClient = {} as never;

const fnNames = (ns: object): string[] =>
  Object.entries(ns)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k);

describe("unified Client facade", () => {
  const client = Client.fromClients(perpClient, predictClient);

  it("exposes both line namespaces and the raw line clients", () => {
    expect(typeof client.perp).toBe("object");
    expect(typeof client.predict).toBe("object");
    expect(client.perpClient).toBe(perpClient);
    expect(client.predictClient).toBe(predictClient);
  });

  it("root barrel keeps flat perp but never flattens prediction (name collisions)", () => {
    expect(WaterXClient).toBeTypeOf("function");
    expect(typeof perp).toBe("object");
    expect(typeof prediction).toBe("object");
    // Prediction must only be reachable via the namespace, not flat at the root.
    // (Asserted by the absence of a flat PredictClient export — see sdk.ts.)
    expect(perp.WaterXClient).toBe(WaterXClient);
    expect(prediction.PredictClient).toBeTypeOf("function");
  });

  it("disambiguates the builder names that collide across lines", () => {
    for (const name of ["createAccount", "requestDeposit", "requestWithdraw"]) {
      const a = (client.perp as Record<string, unknown>)[name];
      const b = (client.predict as Record<string, unknown>)[name];
      expect(a, `perp.${name}`).toBeTypeOf("function");
      expect(b, `predict.${name}`).toBeTypeOf("function");
      expect(a).not.toBe(b);
    }
    expect((client.predict as Record<string, unknown>).placeOrder).toBeTypeOf("function");
  });

  it("wraps (binds the client) rather than re-exporting the raw free function", () => {
    expect(client.perp.createAccount).not.toBe(perpUser.createAccount);
    expect(client.predict.placeOrder).not.toBe(predOps.placeOrder);
  });

  it("coverage guard: client-first builders are bound; non-client-first helpers are not", () => {
    // Helpers whose first arg is NOT the line client must not be exposed as bound
    // facade methods (binding would pass the client where a value is expected).
    const NON_CLIENT_FIRST = [
      "extractReturnBytes",
      "openPythSponsorFund",
      "reimbursePythSponsor",
      "refreshOraclePrices",
      "updatePythPrices",
    ];
    const expected = (ns: object) => fnNames(ns).filter((n) => !NON_CLIENT_FIRST.includes(n));

    const perpExpected = expected({ ...perpUser, ...perpTx, ...perpFetch });
    for (const name of perpExpected) {
      expect((client.perp as Record<string, unknown>)[name], `perp.${name} missing`).toBeTypeOf(
        "function",
      );
    }
    const predExpected = expected({ ...predAccount, ...predAdmin, ...predOps, ...predFetch });
    for (const name of predExpected) {
      expect(
        (client.predict as Record<string, unknown>)[name],
        `predict.${name} missing`,
      ).toBeTypeOf("function");
    }

    // Regression guard (bot-reported): a non-client-first helper exported from
    // fetch.ts must NOT be bound onto the facade.
    expect((client.predict as Record<string, unknown>).extractReturnBytes).toBeUndefined();

    // Sanity: the surfaces are non-trivial (guards against an empty-spread regression).
    expect(perpExpected.length).toBeGreaterThan(20);
    expect(predExpected.length).toBeGreaterThan(20);
  });
});
