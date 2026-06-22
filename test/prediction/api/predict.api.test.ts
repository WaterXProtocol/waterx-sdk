import { describe, it, type TestContext } from "vitest";

import { PREDICT_PUBLIC_GET_ENDPOINTS } from "../helpers/api-endpoints.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { fetchReachableCatalog } from "../helpers/api-smoke.ts";

describe("predict catalog API — list shape (phase 2)", () => {
  const env = resolveApiEnvironment();

  for (const endpoint of PREDICT_PUBLIC_GET_ENDPOINTS) {
    if (endpoint.path.includes(":slug")) continue;
    // feed/browse list only — quotes/events have dedicated *.api.test.ts
    if (endpoint.path !== "/predict/feed" && endpoint.path !== "/predict/browse") continue;

    it(`GET ${endpoint.path}${endpoint.sampleQuery}`, async (ctx: TestContext) => {
      await fetchReachableCatalog(ctx, env, `${endpoint.path}${endpoint.sampleQuery}`);
    });
  }
});
