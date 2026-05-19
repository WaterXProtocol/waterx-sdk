import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { beforeAll, describe, expect, it } from "vitest";

import { positionExists } from "../../../src/fetch.ts";
import { buildClosePositionTx, buildOpenPositionTx } from "../../../src/tx-builders.ts";
import {
  LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC,
  LIFECYCLE_MIN_ACCOUNT_USDC,
  lifecycleRow,
} from "../../helpers/e2e/lifecycle-test-markets.ts";
import { runScratchTradingScenarioIntegration } from "../../helpers/scratch/run-scratch-trading-scenario-integration.ts";
import { scratchTradingScenarios } from "../../helpers/scratch/scratch-trading-scenarios.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import {
  assertMarketSnapshotTradeable,
  fetchIntegrationMarketSummaries,
  type IntegrationMarketSnapshotMap,
} from "../helpers/integration-market-snapshot.ts";
import {
  ensureScratchLifecycleMinUsdc,
  positionIdFromOpened,
  selectedIntegrationLifecycleBasesFromEnv,
} from "../helpers/scratch-lifecycle.ts";
import {
  assertSuccess,
  client,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipSupra,
  execTx,
  extractEvent,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

function scenariosForIntegrationEnv() {
  const bases = new Set(selectedIntegrationLifecycleBasesFromEnv(client));
  return scratchTradingScenarios(client).filter((s) => bases.has(s.base));
}

/**
 * Data-driven scratch lifecycle: {@link scratchTradingScenarios} × env-selected bases.
 * Opt-in `WATERX_INTEGRATION_APPROX_PRICE_CHAIN`: oracle-cached `approxPrice` open+close on first selected base.
 */
describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: data-driven scratch lifecycle (testnet)",
  () => {
    const scenarios = scenariosForIntegrationEnv();
    const approxPriceChainSmoke = Boolean(
      process.env.WATERX_INTEGRATION_APPROX_PRICE_CHAIN?.trim(),
    );
    let marketAtStart: IntegrationMarketSnapshotMap;

    beforeAll(async () => {
      marketAtStart = await fetchIntegrationMarketSummaries(
        client,
        scenarios.map((s) => s.base),
      );
    }, 180_000);

    const integrationDeps = (trader: Ed25519Keypair) => ({
      client,
      trader,
      execBuiltTxWithCooldownRetries,
      execIntegrationOrSkipSupra,
      extractEvent,
      assertSuccess,
      marketAtStart,
    });

    describe.each(scenarios)("$id — full chain", (scenario) => {
      it("open → deposit → withdraw → increase → decrease → close", async (ctx) => {
        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();
        console.info(`[integration scratch][${scenario.id}] start`);

        const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
        await ensureScratchLifecycleMinUsdc(
          client,
          trader,
          accountId,
          owner,
          LIFECYCLE_MIN_ACCOUNT_USDC,
          execTx,
        );

        await runScratchTradingScenarioIntegration(
          ctx,
          integrationDeps(trader),
          scenario,
          accountId,
        );
        console.info(`[integration scratch][${scenario.id}] done`);
      }, 600_000);
    });

    it.skipIf(!approxPriceChainSmoke)(
      "opt-in: first selected base — open + close via table approxPrice",
      async (ctx) => {
        const base = scenarios[0]!.base;
        const row = lifecycleRow(base);
        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();
        console.info(
          `[integration scratch][${base}] approxPrice chain (WATERX_INTEGRATION_APPROX_PRICE_CHAIN)`,
        );

        const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
        await ensureScratchLifecycleMinUsdc(
          client,
          trader,
          accountId,
          owner,
          LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC,
          execTx,
        );

        const entry = client.getMarketEntry(base);
        const cooldownMarketIds = [entry.marketId];
        const snap = marketAtStart[base]!;
        assertMarketSnapshotTradeable(snap, base);

        const lev = row.simulateLeverage ?? row.leverage;
        const collateral = row.simulateOpenCollateral;

        const openResult = await execIntegrationOrSkipSupra(ctx, () =>
          execBuiltTxWithCooldownRetries(
            () =>
              buildOpenPositionTx(client, {
                accountId,
                base,
                isLong: row.isLong,
                leverage: lev,
                collateralAmount: collateral,
              }),
            trader,
            { cooldownMarketIds },
          ),
        );
        if (openResult === undefined) return;
        assertSuccess(openResult);
        const opened = extractEvent(openResult, "PositionOpened");
        expect(opened).toBeDefined();
        const positionId = positionIdFromOpened(opened);
        expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(true);

        const closeResult = await execBuiltTxWithCooldownRetries(
          () =>
            buildClosePositionTx(client, {
              accountId,
              base,
              positionId,
              acceptablePrice: 0n,
            }),
          trader,
          { cooldownMarketIds },
        );
        assertSuccess(closeResult);
        expect(extractEvent(closeResult, "PositionClosed")).toBeDefined();
        expect(await positionExists(client, entry.marketId, positionId, entry.baseType)).toBe(
          false,
        );
        console.info(`[integration scratch][${base}] approxPrice chain done`);
      },
      600_000,
    );
  },
);
