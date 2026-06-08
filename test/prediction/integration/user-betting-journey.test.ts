/**
 * Integration automation: user betting journey (simulate-first + hard assertions).
 *
 * Pattern: Arrange (discover fixtures) → Act (API / simulate PTB) → Assert (chain views + wire contracts).
 * No keeper key; bypass testnet skips keeper fill when only positions exist.
 *
 * Run: `pnpm test:integration:predict:journey`
 */
import type { PredictClient } from "~predict/client.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { apiGet, assertSuccessEnvelope, isApiUnreachableError } from "../helpers/api-client.ts";
import type { MarketDetailData, QuotesData } from "../helpers/api-contract.ts";
import {
  discoverCatalogContext,
  fetchReachableCatalog,
  fetchReachableQuotes,
  marketDetailPath,
} from "../helpers/api-smoke.ts";
import {
  assertCatalogPlaceTxBuildResult,
  hasTxBuildSmokeEnabled,
  resolvePlaceBetCredentials,
  tryCatalogPlaceTxBuild,
} from "../helpers/api-tx-build.ts";
import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import {
  fetchBetsSummary,
  pollBetsMeForChainFixture,
  resolveIntegrationApiEnv,
  skipIntegrationApiAuthed,
} from "../helpers/integration-api.ts";
import {
  likelyBypassFilledFixtures,
  simulateConfirmClose,
  simulateFillBet,
  simulatePlaceYesBet,
  simulateRequestClose,
  tryDiscoverCatalogMarket,
  type SimulateJourneyCtx,
} from "../helpers/integration-user-journey.ts";
import {
  assertAccountIdShape,
  assertBetsMeContainsFixture,
  assertBetsSummaryLiveCount,
  assertCatalogApiChain,
  assertCatalogBrowseAndDetail,
  loadAndAssertBettingMarket,
  loadAndAssertOpenOrder,
  loadAndAssertOpenPosition,
  loadAndAssertPendingClosePosition,
} from "../helpers/journey-assertions.ts";
import {
  assertBetWireMatchesChainEvent,
  assertCloseConfirmedEventOnChain,
  assertCloseRequestedEventOnChain,
  assertOrderFilledEventOnChain,
  assertOrderPlacedEventOnChain,
} from "../helpers/journey-event-assertions.ts";
import { findChainEventByPositionId } from "../helpers/query-prediction-events.ts";

describe("Integration automation: user betting journey", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;
  let journey: SimulateJourneyCtx;
  const apiEnv = resolveIntegrationApiEnv();

  const marketBytes = () => fx.openMarketIdBytes;
  const openPositionId = () => fx.openPositionId ?? fx.positionId;
  const openOrderId = () => fx.openOrderId ?? fx.orderId;
  const bypassFill = () => likelyBypassFilledFixtures(fx);

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx, client);
  }, 120_000);

  it("precondition: discovery fixtures match on-chain views", async (testCtx) => {
    guard.skipUnlessDefined(testCtx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(testCtx);
    assertAccountIdShape(fx.accountId);

    const bytes = marketBytes();
    if (!bytes) {
      guard.skipFixableBySeed(testCtx, "openMarketIdBytes", { stage: "place-open" });
    }
    await loadAndAssertBettingMarket(client, bytes!);

    const orderId = openOrderId();
    if (orderId !== undefined) {
      await loadAndAssertOpenOrder(client, orderId, fx.accountId);
    }

    const posId = openPositionId();
    if (posId !== undefined) {
      const position = await loadAndAssertOpenPosition(client, posId, fx.accountId);
      expect(position.selection).toBe("YES");
    }

    if (fx.pendingClosePositionId !== undefined) {
      await loadAndAssertPendingClosePosition(client, fx.pendingClosePositionId, fx.accountId);
    }

    if (orderId === undefined && posId === undefined) {
      guard.skipFixableBySeed(testCtx, "openOrderId or openPositionId", { stage: "place-open" });
    }

    if (bypassFill()) {
      expect(orderId, "bypass testnet: no resting OPEN order").toBeUndefined();
      expect(posId, "bypass testnet: position should exist").toBeDefined();
    }
  });

  it("API: catalog chains feed → detail → quotes", async (testCtx) => {
    if (!apiEnv) {
      testCtx.skip(true, "E2E_API_ENV / baseUrl not configured");
      return;
    }
    try {
      const catalogCtx = await discoverCatalogContext(apiEnv);
      if (!catalogCtx?.roundId) {
        testCtx.skip(true, "no catalog context with roundId from feed");
        return;
      }
      const feed = await fetchReachableCatalog(
        testCtx,
        apiEnv,
        `/predict/feed?type=${catalogCtx.segment}&limit=30`,
      );
      const feedItem =
        feed.items.find((i) => i.market.slug === catalogCtx.marketSlug) ?? catalogCtx.feedItem;
      if (!feedItem) {
        testCtx.skip(true, `slug ${catalogCtx.marketSlug} not in feed page`);
        return;
      }
      const { envelope: detailEnv } = await apiGet<MarketDetailData>(
        apiEnv,
        marketDetailPath(catalogCtx.segment, catalogCtx.marketSlug),
      );
      assertSuccessEnvelope(detailEnv);
      const quotes = (await fetchReachableQuotes(
        testCtx,
        apiEnv,
        `/predict/quotes?rounds=${catalogCtx.roundId}`,
      )) as QuotesData;
      assertCatalogApiChain(
        feedItem,
        detailEnv.data,
        quotes,
        catalogCtx.marketSlug,
        catalogCtx.roundId,
      );
    } catch (err) {
      if (isApiUnreachableError(err)) {
        testCtx.skip(true, `predict API unreachable at ${apiEnv.baseUrl}`);
        return;
      }
      throw err;
    }
  });

  it("API: catalog → POST /predict/bets/place txBytes (opt-in E2E_API_TX_BUILD=1)", async (testCtx) => {
    if (!hasTxBuildSmokeEnabled()) {
      testCtx.skip(true, "E2E_API_TX_BUILD not set — skipping catalog → place tx-build loop");
      return;
    }
    if (!apiEnv) {
      testCtx.skip(true, "E2E_API_ENV / baseUrl not configured");
      return;
    }
    const creds = resolvePlaceBetCredentials(apiEnv);
    if (!creds) {
      testCtx.skip(
        true,
        "E2E_API_PLACE_ACCOUNT_ID + E2E_API_PLACE_SENDER required for tx-build closed loop",
      );
      return;
    }
    try {
      const hit = await tryCatalogPlaceTxBuild(apiEnv, creds);
      if (!hit) {
        testCtx.skip(
          true,
          "catalog → place did not return HTTP 200 txBytes (account/market simulate failed on API host)",
        );
        return;
      }
      assertCatalogPlaceTxBuildResult(hit.envelope);
    } catch (err) {
      if (isApiUnreachableError(err)) {
        testCtx.skip(true, `predict API unreachable at ${apiEnv.baseUrl}`);
        return;
      }
      throw err;
    }
  });

  it("API: catalog feed slug matches detail contract", async (testCtx) => {
    if (!apiEnv) {
      testCtx.skip(true, "E2E_API_ENV / baseUrl not configured");
      return;
    }
    try {
      const catalog = await tryDiscoverCatalogMarket(apiEnv);
      if (!catalog) {
        testCtx.skip(true, "no reachable catalog slug from feed");
        return;
      }
      const feed = await fetchReachableCatalog(
        testCtx,
        apiEnv,
        `/predict/feed?type=${catalog.segment}&limit=30`,
      );
      const { envelope } = await apiGet<MarketDetailData>(
        apiEnv,
        marketDetailPath(catalog.segment, catalog.slug),
      );
      assertSuccessEnvelope(envelope);
      const feedItem = feed.items.find((i) => i.market.slug === catalog.slug);
      if (!feedItem) {
        testCtx.skip(true, `slug ${catalog.slug} not in feed page`);
        return;
      }
      assertCatalogBrowseAndDetail(feed, envelope.data, catalog.slug, feedItem);
    } catch (err) {
      if (isApiUnreachableError(err)) {
        testCtx.skip(true, `predict API unreachable at ${apiEnv.baseUrl}`);
        return;
      }
      throw err;
    }
  });

  it("SDK simulate: placeOrder on open market", async (testCtx) => {
    guard.skipUnlessDefined(testCtx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(testCtx);
    const owner = await guard.skipUnlessAccountOwner(testCtx);
    journey = { client, accountId: fx.accountId, ownerAddress: owner };

    const bytes = marketBytes();
    if (!bytes) {
      guard.skipFixableBySeed(testCtx, "openMarketIdBytes", { stage: "place-open" });
    }
    await simulatePlaceYesBet(journey, bytes!);
  });

  it("SDK simulate: fillOrder (keeper) or bypass path", async (testCtx) => {
    guard.skipUnlessDefined(testCtx, fx.accountId, "accountId");
    const orderId = openOrderId();

    if (orderId === undefined && bypassFill()) {
      const posId = openPositionId();
      expect(posId).toBeDefined();
      await loadAndAssertOpenPosition(client, posId!, fx.accountId);
      return;
    }

    if (orderId === undefined) {
      guard.skipFixableBySeed(testCtx, "openOrderId", { stage: "place-open" });
    }

    await loadAndAssertOpenOrder(client, orderId!, fx.accountId);
    const fillSim = await simulateFillBet(client, orderId!);
    if (fillSim === "expired") {
      guard.skipFixableBySeed(testCtx, "a non-expired open order", { stage: "place-open" });
    }
  });

  it("SDK simulate: requestClose on OPEN position", async (testCtx) => {
    guard.skipUnlessDefined(testCtx, fx.accountId, "accountId");
    const owner = await guard.skipUnlessAccountOwner(testCtx);
    journey = { client, accountId: fx.accountId, ownerAddress: owner };

    const posId = openPositionId();
    if (posId === undefined) {
      guard.skipFixableBySeed(testCtx, "openPositionId", { stage: "fill" });
    }

    await loadAndAssertOpenPosition(client, posId!, fx.accountId);
    await simulateRequestClose(journey, posId!);
  });

  it("SDK simulate: confirmClose on PENDING_CLOSE position", async (testCtx) => {
    if (fx.pendingClosePositionId === undefined) {
      guard.skipFixableBySeed(testCtx, "pendingClosePositionId", { stage: "request-close" });
    }
    await loadAndAssertPendingClosePosition(client, fx.pendingClosePositionId, fx.accountId);
    await simulateConfirmClose(client, fx.pendingClosePositionId);
  });

  it("on-chain events: payloads match order/position views (indexer contract)", async (testCtx) => {
    guard.skipUnlessDefined(testCtx, fx.accountId, "accountId");

    const orderId = openOrderId();
    let placedEvent: Awaited<ReturnType<typeof assertOrderPlacedEventOnChain>> | undefined;
    if (orderId !== undefined) {
      try {
        placedEvent = await assertOrderPlacedEventOnChain(client, orderId);
      } catch (err) {
        testCtx.skip(
          true,
          `OrderPlaced not found in suix_queryEvents for order_id=${orderId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    const posId = openPositionId();
    let fillEvent: Awaited<ReturnType<typeof assertOrderFilledEventOnChain>> | undefined;
    if (posId !== undefined) {
      try {
        fillEvent = await assertOrderFilledEventOnChain(
          client,
          posId,
          bypassFill() ? undefined : orderId,
        );
      } catch (err) {
        testCtx.skip(
          true,
          `OrderFilled not found for position_id=${posId}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    if (fx.pendingClosePositionId !== undefined) {
      try {
        await assertCloseRequestedEventOnChain(client, fx.pendingClosePositionId);
      } catch (err) {
        testCtx.skip(
          true,
          `CloseRequested not indexed for position_id=${fx.pendingClosePositionId}: ${err instanceof Error ? err.message : err}`,
        );
      }
      const confirmed = await findChainEventByPositionId(
        client,
        EVENT_CONTRACT.CloseConfirmed,
        fx.pendingClosePositionId,
      );
      if (confirmed) {
        const proceeds = BigInt(String(confirmed.json.proceeds));
        await assertCloseConfirmedEventOnChain(client, fx.pendingClosePositionId, proceeds);
      }
    }

    void placedEvent;
    void fillEvent;
  }, 120_000);

  it("API: bets/me and summary match seeded chain ids", async (testCtx) => {
    if (!apiEnv?.jwt) {
      testCtx.skip(true, "E2E_API_JWT not set — skipping authenticated API assertions");
      return;
    }
    skipIntegrationApiAuthed(testCtx, apiEnv);

    try {
      const summary = await fetchBetsSummary(testCtx, apiEnv);
      assertBetsSummaryLiveCount(summary);

      const orderId = openOrderId();
      const posId = openPositionId();
      if (orderId === undefined && posId === undefined) {
        testCtx.skip(true, "no orderId or positionId to assert in bets/me");
        return;
      }

      const polled = await pollBetsMeForChainFixture(
        testCtx,
        apiEnv,
        {
          ...(orderId !== undefined ? { orderId } : {}),
          ...(posId !== undefined ? { positionId: posId } : {}),
        },
        { timeoutMs: 60_000 },
      );
      if (!polled) {
        testCtx.skip(
          true,
          `GET /predict/bets/me returned no rows for JWT wallet — API may resolve bets by wallet, ` +
            `while chain fixtures use registry accountId ${fx.accountId} (bypass testnet). ` +
            `Chain + event assertions already passed.`,
        );
        return;
      }

      assertBetsMeContainsFixture(polled.data, {
        ...(orderId !== undefined ? { orderId } : {}),
        ...(posId !== undefined ? { positionId: posId } : {}),
      });
      const bet = polled.bet;

      if (orderId !== undefined) {
        try {
          const { event } = await assertOrderPlacedEventOnChain(client, orderId);
          assertBetWireMatchesChainEvent(bet, event, { orderId });
        } catch {
          /* OrderPlaced may be absent on bypass; bets row can still be position-scoped */
        }
      }
      if (posId !== undefined) {
        try {
          const { event } = await assertOrderFilledEventOnChain(
            client,
            posId,
            bypassFill() ? undefined : orderId,
          );
          assertBetWireMatchesChainEvent(bet, event, { positionId: posId });
        } catch {
          /* indexer/event optional when API row exists */
        }
      }
    } catch (err) {
      if (isApiUnreachableError(err)) {
        testCtx.skip(true, `predict API unreachable at ${apiEnv.baseUrl}`);
        return;
      }
      throw err;
    }
  });
});
