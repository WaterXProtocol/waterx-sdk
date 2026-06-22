import { describe, it, type TestContext } from "vitest";

import { apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { assertQuotesConsistentWithRounds, type QuotesData } from "../helpers/api-contract.ts";
import type { MarketDetailData } from "../helpers/api-contract.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  collectRoundIdsFromCatalog,
  discoverCatalogContext,
  fetchReachableCatalog,
  fetchReachableQuotes,
  marketDetailPath,
} from "../helpers/api-smoke.ts";

describe("predict quotes API — response shape (phase 2)", () => {
  const env = resolveApiEnvironment();

  it("GET /predict/quotes with no rounds returns empty map", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      await fetchReachableQuotes(ctx, env, "/predict/quotes");
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("GET /predict/quotes?rounds=… when catalog exposes roundId", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const catalogCtx = await discoverCatalogContext(env!);
      let roundIds = catalogCtx?.roundId ? [catalogCtx.roundId] : [];
      if (roundIds.length === 0) {
        const catalog = await fetchReachableCatalog(ctx, env, "/predict/feed?limit=20");
        roundIds = collectRoundIdsFromCatalog(catalog);
      }
      if (roundIds.length === 0) {
        ctx.skip(true, "feed items have no round.id — skipping rounds query smoke");
        return;
      }
      const quotesPath = `/predict/quotes?rounds=${roundIds.join(",")}`;
      const quotes = (await fetchReachableQuotes(ctx, env, quotesPath)) as QuotesData;
      if (catalogCtx?.roundId && catalogCtx.marketSlug && catalogCtx.segment) {
        const { envelope } = await apiGet<MarketDetailData>(
          env!,
          marketDetailPath(catalogCtx.segment, catalogCtx.marketSlug),
        );
        assertSuccessEnvelope(envelope);
        assertQuotesConsistentWithRounds(quotes, roundIds, envelope.data.detail.round);
      }
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
