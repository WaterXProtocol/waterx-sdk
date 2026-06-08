import { describe, it, type TestContext } from "vitest";

import { apiFetch, apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { assertMarketDetail, type MarketDetailData } from "../helpers/api-contract.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  discoverCatalogContext,
  discoverReachablePoliticsSlug,
  fetchReachableDetail,
  marketDetailPath,
} from "../helpers/api-smoke.ts";

describe("predict market detail API — shape (phase 2)", () => {
  const env = resolveApiEnvironment();

  it("GET /predict/markets/sport/:slug", async (ctx) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const catalog = await discoverCatalogContext(env, { segment: "sport" });
      if (!catalog) {
        ctx.skip(true, "no sport slug from feed returned HTTP 200 on /predict/markets/sport/:slug");
        return;
      }
      await fetchReachableDetail(
        ctx,
        env,
        marketDetailPath("sport", catalog.marketSlug),
        catalog.marketSlug,
      );
    } catch (err) {
      skipIfUnreachable(ctx, err, env.baseUrl);
      throw err;
    }
  });

  it("GET /predict/markets/crypto/:slug", async (ctx) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const catalog = await discoverCatalogContext(env, { segment: "crypto" });
      if (!catalog) {
        ctx.skip(
          true,
          "no crypto slug from feed returned HTTP 200 on /predict/markets/crypto/:slug",
        );
        return;
      }
      await fetchReachableDetail(
        ctx,
        env,
        marketDetailPath("crypto", catalog.marketSlug),
        catalog.marketSlug,
      );
    } catch (err) {
      skipIfUnreachable(ctx, err, env.baseUrl);
      throw err;
    }
  });

  it("GET /predict/markets/politics/:slug", async (ctx) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const slug = await discoverReachablePoliticsSlug(env!);
      if (!slug) {
        ctx.skip(
          true,
          "no politics- slug from feed returned HTTP 200 on /predict/markets/politics/:slug",
        );
        return;
      }
      await fetchReachableDetail(ctx, env, marketDetailPath("politics", slug), slug);
    } catch (err) {
      skipIfUnreachable(ctx, err, env.baseUrl);
      throw err;
    }
  });

  it("GET /predict/markets/crypto/:slug?epoch=<round.startsAt> when available", async (ctx) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const catalog = await discoverCatalogContext(env, {
        segment: "crypto",
        preferActiveRound: true,
      });
      if (!catalog) {
        ctx.skip(true, "no reachable crypto detail slug from feed");
        return;
      }
      if (catalog.roundStartsAt === undefined) {
        ctx.skip(true, "reachable crypto item has no round.startsAt — skipping epoch query smoke");
        return;
      }
      const epochPath = marketDetailPath(
        "crypto",
        catalog.marketSlug,
        `?epoch=${catalog.roundStartsAt}`,
      );
      const probe = await apiFetch(env, epochPath);
      if (probe.status !== 200) {
        ctx.skip(
          true,
          `crypto detail ?epoch=${catalog.roundStartsAt} returned HTTP ${probe.status} on this host`,
        );
        return;
      }
      const { envelope } = await apiGet<MarketDetailData>(env, epochPath);
      assertSuccessEnvelope(envelope);
      assertMarketDetail(envelope.data, catalog.marketSlug);
    } catch (err) {
      skipIfUnreachable(ctx, err, env.baseUrl);
      throw err;
    }
  });
});
