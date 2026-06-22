import { describe, expect, it } from "vitest";

import * as predAccount from "../../../src/prediction/account.ts";
import * as predAdmin from "../../../src/prediction/admin.ts";
import * as predFetch from "../../../src/prediction/fetch.ts";
import * as predOps from "../../../src/prediction/prediction.ts";
import { Client } from "../../../src/sdk.ts";
import { assertDualPathTxCase } from "../../helpers/unified-dual-path.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";
import {
  buildPredictDualPathCases,
  predictDualPathCaseNames,
} from "../helpers/unified/predict-dual-path-cases.ts";

const NON_CLIENT_FIRST = new Set([
  "extractReturnBytes",
  "base64UrlNoPadEncode",
  "base64UrlNoPadDecode",
  "generateGiftSeed",
  "encodeGiftUrl",
  "parseGiftUrl",
  "deriveGiftKeypair",
  "buildGiftClaimMessage",
  "signGiftClaim",
]);

const fnNames = (ns: object): string[] =>
  Object.entries(ns)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k);

const expectedPredictPtbBuilders = [
  ...fnNames(predAccount).filter((n) => n !== "resolveRegistryAccountId"),
  ...fnNames(predAdmin),
  ...fnNames(predOps),
].filter((n) => !NON_CLIENT_FIRST.has(n));

describe("unified Client — prediction dual-path PTB equivalence", () => {
  const predictClient = createMockPredictClient();
  const unified = Client.fromClients({} as never, predictClient);
  const cases = buildPredictDualPathCases(predictClient);
  const caseNames = predictDualPathCaseNames(predictClient);

  it("case registry covers every client-first prediction builder (account + admin + ops)", () => {
    for (const name of expectedPredictPtbBuilders) {
      expect(caseNames.has(name), `missing dual-path case for predict.${name}`).toBe(true);
    }
    expect(cases.length).toBeGreaterThanOrEqual(expectedPredictPtbBuilders.length);
  });

  it.each(cases.map((c) => [c.name, c] as const))(
    "%s: client.predict.* matches legacy free function PTB",
    async (_name, caseDef) => {
      await assertDualPathTxCase(caseDef, predictClient, unified.predict);
    },
  );

  it("fetch helpers are bound but distinct wrappers (e2e fetch parity tested separately)", () => {
    for (const name of fnNames(predFetch).filter((n) => !NON_CLIENT_FIRST.has(n))) {
      expect((unified.predict as Record<string, unknown>)[name]).toBeTypeOf("function");
      expect((unified.predict as Record<string, unknown>)[name]).not.toBe(
        (predFetch as Record<string, unknown>)[name],
      );
    }
  });

  it("extractReturnBytes is not bound on the facade", () => {
    expect((unified.predict as Record<string, unknown>).extractReturnBytes).toBeUndefined();
  });
});
