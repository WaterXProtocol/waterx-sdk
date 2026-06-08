import { describe, it, type TestContext } from "vitest";

import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  discoverReachableEventSlug,
  eventDetailPath,
  fetchReachableEvent,
} from "../helpers/api-smoke.ts";

describe("predict events API — response shape (phase 2)", () => {
  const env = resolveApiEnvironment();

  it("GET /predict/events/:slug", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const slug = await discoverReachableEventSlug(env!);
      if (!slug) {
        ctx.skip(
          true,
          "no reachable event slug — feed wire has no event.slug (sport-match is market-level); " +
            "set E2E_PREDICT_EVENT_SLUG or deploy event catalog on this host",
        );
        return;
      }
      await fetchReachableEvent(ctx, env, eventDetailPath(slug), slug);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
