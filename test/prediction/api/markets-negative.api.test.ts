import { describe, expect, it } from "vitest";

import { apiFetch } from "../helpers/api-client.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import { marketDetailPath } from "../helpers/api-smoke.ts";

const INVALID_SLUG = "__sdk-invalid-slug__";

describe("predict market detail API — negative (phase 2)", () => {
  const env = resolveApiEnvironment();

  for (const segment of ["sport", "crypto", "politics"] as const) {
    it(`GET ${segment} detail returns 404 for invalid slug`, async (ctx) => {
      skipIfNoApiEnv(ctx, env);
      try {
        const { status, body } = await apiFetch(env!, marketDetailPath(segment, INVALID_SLUG));
        expect(status).toBe(404);
        expect(body).toEqual(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: expect.any(Number),
              message: expect.any(String),
            }),
          }),
        );
      } catch (err) {
        skipIfUnreachable(ctx, err, env!.baseUrl);
        throw err;
      }
    });
  }
});
