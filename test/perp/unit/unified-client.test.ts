import { afterEach, describe, expect, it, vi } from "vitest";

import * as accountOps from "../../../src/account/index.ts";
import * as perpReferral from "../../../src/account/referral.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import * as perpFetch from "../../../src/perp/fetch.ts";
import * as perpTx from "../../../src/perp/tx-builders.ts";
import * as perpOrder from "../../../src/perp/user/order.ts";
import * as perpStaking from "../../../src/perp/user/staking.ts";
import * as perpTrading from "../../../src/perp/user/trading.ts";
import * as perpWlp from "../../../src/perp/user/wlp.ts";
import {
  allowPredictionProtocolAsset,
  disallowPredictionProtocolAsset,
  setDelegatePredictionPermission,
  whitelistPredictionProtocol,
} from "../../../src/prediction/account.ts";
import * as predAdmin from "../../../src/prediction/admin.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import * as predFetch from "../../../src/prediction/fetch.ts";
import * as predGift from "../../../src/prediction/gift.ts";
import * as predOps from "../../../src/prediction/prediction.ts";
import { Client, perp, prediction, WaterXClient } from "../../../src/sdk.ts";

const predAccountSpecific = {
  setDelegatePredictionPermission,
  whitelistPredictionProtocol,
  allowPredictionProtocolAsset,
  disallowPredictionProtocolAsset,
};

// Helpers whose first arg is NOT the line client must not be exposed as bound
// facade methods (binding would pass the client where a value is expected).
// Mirrors `NON_CLIENT_FIRST` in src/unified-client.ts.
const NON_CLIENT_FIRST = [
  "extractReturnBytes",
  "base64UrlNoPadEncode",
  "base64UrlNoPadDecode",
  "generateGiftSeed",
  "encodeGiftUrl",
  "parseGiftUrl",
  "deriveGiftKeypair",
  "buildGiftClaimMessage",
  "signGiftClaim",
];

const perpOps = {
  ...perpTrading,
  ...perpOrder,
  ...perpWlp,
  ...perpStaking,
  ...perpReferral,
  ...perpTx,
  ...perpFetch,
};
const predictOps = {
  ...predAccountSpecific,
  ...predAdmin,
  ...predOps,
  ...predFetch,
  ...predGift,
};

/** Method names across the whole prototype chain (own + inherited, e.g. BaseLineClient). */
const protoMethodNames = (ctor: { prototype: object }): Set<string> => {
  const names = new Set<string>();
  let proto: object | null = ctor.prototype;
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n !== "constructor") names.add(n);
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  return names;
};

// Stub clients: the umbrella constructor only grafts/binds functions; it never
// touches the client until a builder is actually invoked, so empty stubs are
// enough. `Object.assign` mutates the stub in place and returns it, so
// `client.perp === perpClient` holds.
const perpClient = {} as unknown as PerpClient;
const predictClient = {} as never;

const fnNames = (ns: object): string[] =>
  Object.entries(ns)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k);

describe("umbrella WaterXClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const client = WaterXClient.fromClients(perpClient, predictClient);

  it("exposes account/perp/predict; perp & predict ARE the sub-clients", () => {
    expect(typeof client.account).toBe("object");
    expect(typeof client.perp).toBe("object");
    expect(typeof client.predict).toBe("object");
    // No separate sub-client accessors — perp/predict are the clients.
    expect(client.perp).toBe(perpClient);
    expect(client.predict).toBe(predictClient);
    expect((client as unknown as Record<string, unknown>).perpClient).toBeUndefined();
    expect((client as unknown as Record<string, unknown>).predictClient).toBeUndefined();
  });

  it("root barrel: umbrella WaterXClient, flat PerpClient, deprecated Client alias", () => {
    expect(WaterXClient).toBeTypeOf("function");
    expect(Client).toBe(WaterXClient); // deprecated alias
    expect(typeof perp).toBe("object");
    expect(typeof prediction).toBe("object");
    // The perp sub-client is exported flat / via the perp namespace as PerpClient.
    expect(perp.PerpClient).toBeTypeOf("function");
    // Prediction is reachable only via its namespace.
    expect(prediction.PredictClient).toBeTypeOf("function");
  });

  it("single unified account: generic account ops live on client.account only", () => {
    for (const name of ["createAccount", "requestDeposit", "requestWithdraw"]) {
      expect(
        (client.account as unknown as Record<string, unknown>)[name],
        `account.${name}`,
      ).toBeTypeOf("function");
      // Moved out of perp & predict.
      expect(
        (client.perp as unknown as Record<string, unknown>)[name],
        `perp.${name}`,
      ).toBeUndefined();
      expect(
        (client.predict as unknown as Record<string, unknown>)[name],
        `predict.${name}`,
      ).toBeUndefined();
    }
    // Funding builders are on account too.
    expect((client.account as unknown as Record<string, unknown>).mintCredit).toBeTypeOf(
      "function",
    );
    expect((client.account as unknown as Record<string, unknown>).custodyMint).toBeTypeOf(
      "function",
    );
    // Line-specific builders stay on their line.
    expect((client.perp as unknown as Record<string, unknown>).placeOrderRequest).toBeTypeOf(
      "function",
    );
    expect((client.predict as unknown as Record<string, unknown>).placeOrder).toBeTypeOf(
      "function",
    );
    // Prediction-specific account ops stay on predict.
    expect(
      (client.predict as unknown as Record<string, unknown>).setDelegatePredictionPermission,
    ).toBeTypeOf("function");
  });

  it("wraps (binds the client) rather than re-exporting the raw free function", () => {
    expect(client.account.createAccount).not.toBe(accountOps.createAccount);
    expect(client.predict.placeOrder).not.toBe(predOps.placeOrder);
  });

  it("coverage guard: client-first builders are bound; non-client-first helpers are not", () => {
    const expected = (ns: object) => fnNames(ns).filter((n) => !NON_CLIENT_FIRST.includes(n));

    const accountExpected = expected({ ...accountOps });
    for (const name of accountExpected) {
      expect(
        (client.account as unknown as Record<string, unknown>)[name],
        `account.${name} missing`,
      ).toBeTypeOf("function");
    }

    const perpExpected = expected(perpOps);
    for (const name of perpExpected) {
      expect(
        (client.perp as unknown as Record<string, unknown>)[name],
        `perp.${name} missing`,
      ).toBeTypeOf("function");
    }

    const predExpected = expected(predictOps);
    for (const name of predExpected) {
      expect(
        (client.predict as unknown as Record<string, unknown>)[name],
        `predict.${name} missing`,
      ).toBeTypeOf("function");
    }

    // Regression guard (bot-reported): a non-client-first helper exported from
    // fetch.ts must NOT be bound onto the facade.
    expect(
      (client.predict as unknown as Record<string, unknown>).extractReturnBytes,
    ).toBeUndefined();
    expect((client.predict as unknown as Record<string, unknown>).encodeGiftUrl).toBeUndefined();

    // Sanity: the surfaces are non-trivial (guards against an empty-spread regression).
    expect(accountExpected.length).toBeGreaterThan(10);
    expect(perpExpected.length).toBeGreaterThan(20);
    expect(predExpected.length).toBeGreaterThan(20);
  });

  it("graft guard: builder names never collide with sub-client prototype methods", () => {
    // The umbrella grafts builders via `Object.assign(client, …)`, which writes
    // OWN props that silently shadow PROTOTYPE methods. This asserts no builder
    // name overlaps the sub-client's method chain (incl. inherited BaseLineClient
    // transport: simulate / getObject / signAndExecuteTransaction / …), turning
    // the "no collisions — verified" claim into a CI-enforced invariant.
    const isBound = (n: string) => !NON_CLIENT_FIRST.includes(n);

    const perpProto = protoMethodNames(PerpClient);
    const perpCollisions = fnNames(perpOps)
      .filter(isBound)
      .filter((n) => perpProto.has(n));
    expect(perpCollisions, `perp builder/prototype collisions: ${perpCollisions}`).toEqual([]);

    const predictProto = protoMethodNames(PredictClient);
    const predictCollisions = fnNames(predictOps)
      .filter(isBound)
      .filter((n) => predictProto.has(n));
    expect(predictCollisions, `predict builder/prototype collisions: ${predictCollisions}`).toEqual(
      [],
    );

    // Sanity: the prototype chains actually include inherited transport methods,
    // so the guard is checking against a real surface (not an empty set).
    expect(perpProto.has("simulate")).toBe(true);
    expect(perpProto.has("signAndExecuteTransaction")).toBe(true);
    expect(predictProto.has("simulate")).toBe(true);
  });

  it("WaterXClient.create loads perp + predict configs and wires both lines", async () => {
    const perpSpy = vi.spyOn(PerpClient, "create").mockResolvedValue(perpClient);
    const predictSpy = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(predictClient as unknown as PredictClient);

    const unified = await WaterXClient.create({
      network: "TESTNET",
      configUrl: "https://waterx.test/testnet.json",
      configRef: "abc1234",
      perp: { cache: true },
      predict: { grpcUrl: "https://rpc.test:443" },
    });

    expect(unified.perp).toBe(perpClient);
    expect(unified.predict).toBe(predictClient);
    expect(perpSpy).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({
        configUrl: "https://waterx.test/testnet.json",
        configRef: "abc1234",
        cache: true,
      }),
    );
    expect(predictSpy).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({
        configUrl: "https://waterx.test/testnet.json",
        configRef: "abc1234",
        grpcUrl: "https://rpc.test:443",
      }),
    );
  });

  it("WaterXClient.create defaults both lines to TESTNET when called with no args", async () => {
    const perpSpy = vi.spyOn(PerpClient, "create").mockResolvedValue(perpClient);
    const predictSpy = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(predictClient as unknown as PredictClient);

    await WaterXClient.create();

    expect(perpSpy).toHaveBeenCalledWith("TESTNET", expect.any(Object));
    expect(predictSpy).toHaveBeenCalledWith("TESTNET", expect.any(Object));
  });

  it("WaterXClient.create honors per-line network overrides", async () => {
    const perpSpy = vi.spyOn(PerpClient, "create").mockResolvedValue(perpClient);
    const predictSpy = vi
      .spyOn(PredictClient, "create")
      .mockResolvedValue(predictClient as unknown as PredictClient);

    await WaterXClient.create({
      network: "TESTNET",
      perp: { network: "MAINNET" },
      predict: { network: "TESTNET", grpcUrl: "https://predict.rpc:443" },
    });

    expect(perpSpy).toHaveBeenCalledWith("MAINNET", expect.any(Object));
    expect(predictSpy).toHaveBeenCalledWith(
      "TESTNET",
      expect.objectContaining({ grpcUrl: "https://predict.rpc:443" }),
    );
  });
});
