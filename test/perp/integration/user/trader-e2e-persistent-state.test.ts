/**
 * Integration: same on-chain seed as e2e preflight (`runE2ePersistentPreflight`).
 */
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance } from "../../../../src/perp/fetch.ts";
import { runE2ePersistentPreflight } from "../../helpers/e2e/e2e-persistent-preflight.ts";
import {
  activeE2ePersistentPerpTickers,
  E2E_PERSISTENT_WLP,
  e2ePersistentPerpTickersForClient,
} from "../helpers/e2e-persistent-state.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import { client, clientInit, isIntegrationTraderConfigured } from "../setup.ts";

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: e2e persistent state (per-ticker slots + WLP)",
  () => {
    let configuredTickers: string[] = [];

    beforeAll(async () => {
      await clientInit;
      configuredTickers = e2ePersistentPerpTickersForClient(
        client.config.packages.waterx_perp.markets ?? {},
      );
    }, 180_000);

    it("runE2ePersistentPreflight seeds keeper slots and wxa WLP", async () => {
      const report = await runE2ePersistentPreflight(client);

      for (const ticker of activeE2ePersistentPerpTickers()) {
        if (!configuredTickers.includes(ticker)) continue;
        const slot = report.perpSlots[ticker];
        expect(slot, ticker).toBeDefined();
        if (slot?.status === "skipped") continue;
        const rows = await listAccountPositionsInMarket(client, report.accountId, ticker);
        expect(rows.length, `${ticker} should have an open position`).toBeGreaterThan(0);
      }

      const wlpBal = await getAccountBalance(client, report.accountId, client.wlpType());
      if (report.wlp.status !== "skipped") {
        expect(wlpBal).toBeGreaterThanOrEqual(E2E_PERSISTENT_WLP.minBalanceRaw);
      }
    }, 600_000);
  },
);
