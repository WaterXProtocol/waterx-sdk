import { describe, it } from "vitest";

import { apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import {
  assertFeedDetailPhaseConsistent,
  assertFeedDetailRoundConsistent,
  assertMarketDetail,
  type MarketDetailData,
} from "../helpers/api-contract.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  discoverCatalogContext,
  fetchReachableCatalog,
  marketDetailPath,
} from "../helpers/api-smoke.ts";

describe("predict catalog API — feed ↔ detail consistency (phase 2)", () => {
  const env = resolveApiEnvironment();

  for (const segment of ["sport", "crypto"] as const) {
    it(`feed slug matches ${segment} detail.market.slug`, async (ctx) => {
      skipIfNoApiEnv(ctx, env);
      try {
        const catalog = await discoverCatalogContext(env!, { segment });
        if (!catalog) {
          ctx.skip(true, `no reachable ${segment} detail slug from feed`);
          return;
        }
        const data = await fetchReachableCatalog(
          ctx,
          env,
          `/predict/feed?type=${segment}&limit=30`,
        );
        const feedItem =
          data.items.find((i) => i.market.slug === catalog.marketSlug) ?? catalog.feedItem;
        if (!feedItem) {
          ctx.skip(
            true,
            `slug ${catalog.marketSlug} not in feed page — skipping phase cross-check`,
          );
          return;
        }

        const { envelope } = await apiGet<MarketDetailData>(
          env!,
          marketDetailPath(segment, catalog.marketSlug),
        );
        assertSuccessEnvelope(envelope);
        assertMarketDetail(envelope.data, catalog.marketSlug);
        assertFeedDetailPhaseConsistent(feedItem, envelope.data);
        assertFeedDetailRoundConsistent(feedItem, envelope.data);
      } catch (err) {
        skipIfUnreachable(ctx, err, env!.baseUrl);
        throw err;
      }
    });
  }
});
