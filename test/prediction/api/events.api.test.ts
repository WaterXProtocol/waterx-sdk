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
          "events catalog not deployed on this host (browse+feed have no event.slug); " +
            "set E2E_PREDICT_EVENT_SLUG to probe a known slug",
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
