import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { beforeAll, describe, expect, it } from "vitest";

import { positionExists } from "../../../../src/fetch.ts";
import { buildClosePositionTx, buildPlaceOrderTx } from "../../../../src/tx-builders.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import {
  activeLifecycleTestBasesIntegration,
  LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC,
  LIFECYCLE_MIN_ACCOUNT_USDC,
  lifecycleTickerRow,
} from "../../helpers/e2e/lifecycle-test-markets.ts";
import { runScratchTradingScenarioIntegration } from "../../helpers/scratch/run-scratch-trading-scenario-integration.ts";
import { scratchTradingScenarios } from "../../helpers/scratch/scratch-trading-scenarios.ts";
import type { ScratchIntegrationDeps } from "../../helpers/trading/integration-scratch-lifecycle.ts";
import { buildMatchOrdersAfterRefreshTx } from "../../helpers/trading/run-trading-scenario.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import {
  assertMarketTickerTradeableSnapshot,
  fetchIntegrationMarketSummaries,
  tickerRowApproxAcceptableUsdHint,
  type IntegrationMarketSnapshotMap,
} from "../helpers/integration-market-snapshot.ts";
import {
  ensureScratchLifecycleMinUsdc,
  integrationLifecycleBasesConfiguredOrStaticDefault,
  positionIdFromOpened,
} from "../helpers/scratch-lifecycle.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipSupra as execOracleOrSkipDeprecated,
  execTx,
  extractEvent,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

const INTEGRATION_LIFECYCLE_VITEST_TICKERS = [
  ...integrationLifecycleBasesConfiguredOrStaticDefault(),
];

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: scratch lifecycle chains (place + fill + adjusts + close)",
  () => {
    const approxPriceChainSmoke = Boolean(
      process.env.WATERX_INTEGRATION_APPROX_PRICE_CHAIN?.trim(),
    );

    let marketAtStart: IntegrationMarketSnapshotMap;

    beforeAll(async () => {
      await clientInit;
      const deployed = new Set(activeLifecycleTestBasesIntegration(client));
      const want = INTEGRATION_LIFECYCLE_VITEST_TICKERS.filter((t) => deployed.has(t));
      const bases = want.length > 0 ? want : [...deployed];
      marketAtStart = await fetchIntegrationMarketSummaries(client, bases);
    }, 180_000);

    const integrationDeps = (trader: Ed25519Keypair): ScratchIntegrationDeps => ({
      client,
      trader,
      execBuiltTxWithCooldownRetries,
      execIntegrationOrSkipSupra: execOracleOrSkipDeprecated,
      extractEvent,
      assertSuccess,
      marketAtStart,
    });

    describe.each(INTEGRATION_LIFECYCLE_VITEST_TICKERS)("%s — full chain", (ticker) => {
      it("open → deposit → withdraw → increase → decrease → close", async (ctx) => {
        await clientInit;

        const deployed = activeLifecycleTestBasesIntegration(client);
        if (!deployed.includes(ticker)) {
          ctx.skip(`${ticker} not listed in waterx-config for this network`);
          return;
        }
        const scenario = scratchTradingScenarios(client).find((s) => s.base === ticker);
        if (!scenario) {
          ctx.skip(`scratch scenario missing for ${ticker}`);
          return;
        }

        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();
        console.info(`[integration][${scenario.id}] start`);

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
        console.info(`[integration][${scenario.id}] done`);
      }, 900_000);
    });

    it.skipIf(!approxPriceChainSmoke)(
      "opt-in: smallest scenario — simulate place + match sanity on first env-selected ticker",
      async (ctx) => {
        await clientInit;

        const deployed = activeLifecycleTestBasesIntegration(client);
        const ticker =
          INTEGRATION_LIFECYCLE_VITEST_TICKERS.find((t) => deployed.includes(t)) ?? deployed[0];
        if (!ticker) {
          ctx.skip("No lifecycle ticker deployed");
          return;
        }
        const scenario = scratchTradingScenarios(client).find((s) => s.base === ticker);
        if (!scenario) {
          ctx.skip(`No scratch scenario for ticker ${ticker}`);
          return;
        }
        const row = lifecycleTickerRow(ticker);
        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();

        const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);
        await ensureScratchLifecycleMinUsdc(
          client,
          trader,
          accountId,
          owner,
          LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC,
          execTx,
        );

        const snap = marketAtStart[ticker]!;
        assertMarketTickerTradeableSnapshot(snap, ticker);
        const ap = rawPrice(Number(tickerRowApproxAcceptableUsdHint(row)));
        const collateralType = client.getPoolTokenType("USDCUSD");

        const placeResult = await execOracleOrSkipDeprecated(ctx, () =>
          execBuiltTxWithCooldownRetries(
            () =>
              buildPlaceOrderTx(client, {
                ticker,
                accountId,
                collateralType,
                collateralTicker: "USDCUSD",
                main: {
                  isLong: row.isLong,
                  isStopOrder: false,
                  reduceOnly: false,
                  size: row.e2ePtb.openSize,
                  acceptablePrice: ap,
                  collateralAmount: scenario.integrationOpen.collateral,
                },
                skipOraclePriceRefresh: false,
                useSponsor: true,
              }),
            trader,
            { cooldownTickers: [ticker], gasBudget: integrationGasBudget("lifecycle") },
          ),
        );
        if (placeResult === undefined) return;
        assertSuccess(placeResult);

        const matchRaw = await execOracleOrSkipDeprecated(ctx, () =>
          execBuiltTxWithCooldownRetries(
            () => buildMatchOrdersAfterRefreshTx(client, { ticker, isLong: row.isLong }),
            trader,
            { cooldownTickers: [ticker], gasBudget: integrationGasBudget("lifecycle") },
          ),
        );
        if (matchRaw === undefined) return;
        assertSuccess(matchRaw);

        const openedEv =
          extractEvent(placeResult, "PositionOpened") ?? extractEvent(matchRaw, "PositionOpened");
        const positionIdBig = BigInt(positionIdFromOpened(openedEv));
        expect(await positionExists(client, { ticker, positionId: positionIdBig })).toBe(true);

        const closeResult = await execBuiltTxWithCooldownRetries(
          () =>
            buildClosePositionTx(client, {
              accountId,
              ticker,
              collateralType,
              positionId: positionIdBig,
              acceptablePrice: ap,
              collateralTicker: "USDCUSD",
              skipOraclePriceRefresh: false,
              useSponsor: true,
            }),
          trader,
          { cooldownTickers: [ticker] },
        );
        assertSuccess(closeResult);
        expect(extractEvent(closeResult, "PositionClosed")).toBeDefined();

        console.info(`[integration][approxPriceChain][${ticker}] done`);
      },
      900_000,
    );
  },
);
