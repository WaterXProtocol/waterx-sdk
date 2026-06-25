import { describe, expect, it } from "vitest";

import * as accountOps from "../../../src/account/index.ts";
import * as perpFetch from "../../../src/perp/fetch.ts";
import * as perpTx from "../../../src/perp/tx-builders.ts";
import * as perpOrder from "../../../src/perp/user/order.ts";
import * as perpReferral from "../../../src/perp/user/referral.ts";
import * as perpStaking from "../../../src/perp/user/staking.ts";
import * as perpTrading from "../../../src/perp/user/trading.ts";
import * as perpWlp from "../../../src/perp/user/wlp.ts";
import { Client } from "../../../src/sdk.ts";
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

// Builders bound on `client.perp` (trading / order / wlp / staking / referral +
// high-level tx-builders) vs the shared `client.account` namespace
// (waterx_account + credit + custody). Tracked separately so the coverage
// assertion names the right namespace.
const expectedPerpBuilders = fnNames({
  ...perpTrading,
  ...perpOrder,
  ...perpWlp,
  ...perpStaking,
  ...perpReferral,
  ...perpTx,
}).filter((n) => !NON_CLIENT_FIRST.has(n) && n !== "PythCache");
const expectedAccountBuilders = fnNames({ ...accountOps }).filter((n) => !NON_CLIENT_FIRST.has(n));

describe("unified Client — perp dual-path PTB equivalence", () => {
  const perpClient = createUnitTestClient();
  const unified = Client.fromClients(perpClient, {} as never);

  it("case registry covers every client-first perp builder (perp namespace)", () => {
    for (const name of expectedPerpBuilders) {
      expect(
        perpDualPathCaseNames.has(name),
        `missing dual-path case for client.perp.${name}`,
      ).toBe(true);
    }
  });

  it("case registry covers every account builder (account namespace)", () => {
    for (const name of expectedAccountBuilders) {
      expect(
        perpDualPathCaseNames.has(name),
        `missing dual-path case for client.account.${name}`,
      ).toBe(true);
    }
    expect(perpDualPathCases.length).toBeGreaterThanOrEqual(
      expectedPerpBuilders.length + expectedAccountBuilders.length,
    );
  });

  it.each(perpDualPathCases.map((c) => [c.name, c] as const))(
    "%s: client.perp.* / client.account.* matches legacy free function PTB",
    async (_name, caseDef) => {
      await assertDualPathTxCase(caseDef, perpClient, unified);
    },
  );

  it("fetch helpers are bound wrappers (async parity in e2e)", () => {
    for (const name of fnNames(perpFetch)) {
      expect((unified.perp as unknown as Record<string, unknown>)[name]).toBeTypeOf("function");
      expect((unified.perp as unknown as Record<string, unknown>)[name]).not.toBe(
        (perpFetch as Record<string, unknown>)[name],
      );
    }
  });

  // Pyth helpers (`openPythSponsorFund`, `refreshOraclePrices`, …) are `(tx, client, …)` —
  // not client-first. Dual-path registry skips them; keep using flat imports for those.
});
