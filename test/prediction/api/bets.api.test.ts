import { describe, it, type TestContext } from "vitest";

import { apiGet, assertSuccessEnvelope } from "../helpers/api-client.ts";
import type { BetsMeListData } from "../helpers/api-contract.ts";
import { PREDICT_AUTH_GET_ENDPOINTS } from "../helpers/api-endpoints.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  betDetailPath,
  fetchReachableBetDetail,
  fetchReachableBetsClaimable,
  fetchReachableBetsMe,
  fetchReachableBetsSummary,
  firstBetIdFromList,
} from "../helpers/api-smoke.ts";

describe("predict bets API — response shape (phase 2)", () => {
  const env = resolveApiEnvironment();

  for (const endpoint of PREDICT_AUTH_GET_ENDPOINTS) {
    if (endpoint.path.includes(":betId")) continue;

    it(`GET ${endpoint.path}${endpoint.sampleQuery}`, async (ctx: TestContext) => {
      const path = `${endpoint.path}${endpoint.sampleQuery}`;
      if (endpoint.path.endsWith("/claimable")) {
        await fetchReachableBetsClaimable(ctx, env, path);
        return;
      }
      if (endpoint.path.endsWith("/summary")) {
        await fetchReachableBetsSummary(ctx, env, path);
        return;
      }
      await fetchReachableBetsMe(ctx, env, path);
    });
  }

  it("GET /predict/bets/me/:betId/detail when list returns a betId", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const listPath = "/predict/bets/me?filter=all&limit=10";
      const listData = (await fetchReachableBetsMe(ctx, env, listPath)) as BetsMeListData;
      const betId = firstBetIdFromList(listData);
      if (!betId) {
        ctx.skip(true, "bets/me empty or rows lack betId — skipping detail smoke");
        return;
      }
      const { status, envelope } = await apiGet(env!, betDetailPath(betId));
      if (status === 404) {
        ctx.skip(true, `bet detail 404 for betId=${betId} (privacy collapse or indexer lag)`);
        return;
      }
      assertSuccessEnvelope(envelope);
      await fetchReachableBetDetail(ctx, env, betDetailPath(betId));
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
