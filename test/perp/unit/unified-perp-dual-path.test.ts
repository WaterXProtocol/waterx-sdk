import { describe, expect, it } from "vitest";

import * as perpFetch from "../../../src/fetch.ts";
import { Client } from "../../../src/sdk.ts";
import * as perpTx from "../../../src/tx-builders.ts";
import * as perpUser from "../../../src/user/index.ts";
import { assertDualPathTxCase } from "../../helpers/unified-dual-path.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";
import {
  perpDualPathCaseNames,
  perpDualPathCases,
} from "../helpers/unified/perp-dual-path-cases.ts";

const NON_CLIENT_FIRST = new Set([
  "extractReturnBytes",
  "openPythSponsorFund",
  "reimbursePythSponsor",
  "refreshOraclePrices",
  "updatePythPrices",
  // Async gRPC sweep helpers — covered in tx-builders.test.ts with mocked getBalance/listCoins.
  "appendConsolidateToUsd",
  "appendConsolidateAddressCredit",
  "appendConsolidateForSpend",
  "buildConsolidateToUsdTx",
]);

const fnNames = (ns: object): string[] =>
  Object.entries(ns)
    .filter(([, v]) => typeof v === "function")
    .map(([k]) => k);

const expectedPerpPtbBuilders = fnNames({ ...perpUser, ...perpTx }).filter(
  (n) => !NON_CLIENT_FIRST.has(n) && n !== "PythCache",
);

describe("unified Client — perp dual-path PTB equivalence", () => {
  const perpClient = createUnitTestClient();
  const unified = Client.fromClients(perpClient, {} as never);

  it("case registry covers every client-first perp builder (user + tx-builders)", () => {
    for (const name of expectedPerpPtbBuilders) {
      expect(perpDualPathCaseNames.has(name), `missing dual-path case for perp.${name}`).toBe(true);
    }
    expect(perpDualPathCases.length).toBeGreaterThanOrEqual(expectedPerpPtbBuilders.length);
  });

  it.each(perpDualPathCases.map((c) => [c.name, c] as const))(
    "%s: client.perp.* matches legacy free function PTB",
    async (_name, caseDef) => {
      await assertDualPathTxCase(caseDef, perpClient, unified.perp);
    },
  );

  it("fetch helpers are bound wrappers (async parity in e2e)", () => {
    for (const name of fnNames(perpFetch)) {
      expect((unified.perp as Record<string, unknown>)[name]).toBeTypeOf("function");
      expect((unified.perp as Record<string, unknown>)[name]).not.toBe(
        (perpFetch as Record<string, unknown>)[name],
      );
    }
  });

  // Pyth helpers (`openPythSponsorFund`, `refreshOraclePrices`, …) are `(tx, client, …)` —
  // not client-first. Dual-path registry skips them; keep using flat imports for those.
});
