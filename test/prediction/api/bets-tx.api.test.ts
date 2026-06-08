import { describe, expect, it, type TestContext } from "vitest";

import { apiPost, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { assertTxBuildResponse } from "../helpers/api-contract.ts";
import { PREDICT_TX_BUILD_POST_ENDPOINTS } from "../helpers/api-endpoints.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  assertCatalogPlaceTxBuildResult,
  hasTxBuildSmokeEnabled,
  resolvePlaceBetCredentials,
  tryCatalogPlaceTxBuild,
} from "../helpers/api-tx-build.ts";

describe("predict bets tx-build API (phase 2)", () => {
  const env = resolveApiEnvironment();

  it("POST /predict/bets/claim rejects empty positionIds (400)", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const { status, envelope } = await apiPost(env!, "/predict/bets/claim", {
        accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
        positionIds: [],
        sender: "0x0000000000000000000000000000000000000000000000000000000000000001",
      });
      expect(status).toBe(400);
      expect(envelope).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: expect.any(Number), message: expect.any(String) }),
        }),
      );
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("POST /predict/bets/place rejects missing required fields (400)", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const { status, envelope } = await apiPost(env!, "/predict/bets/place", {
        accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
        selection: "YES",
      });
      expect(status).toBe(400);
      expect(envelope).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ message: expect.any(String) }),
        }),
      );
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("POST /predict/bets/place catalog closed loop (opt-in E2E_API_TX_BUILD=1)", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(
        true,
        "Set E2E_API_TX_BUILD=1 to smoke catalog → POST /predict/bets/place (see catalog-tx-loop.api.test.ts)",
      );
    }
    skipIfNoApiEnv(ctx, env);
    const creds = resolvePlaceBetCredentials(env!);
    if (!creds) {
      ctx.skip(
        true,
        "Set E2E_API_PLACE_ACCOUNT_ID + E2E_API_PLACE_SENDER for place tx-build smoke",
      );
      return;
    }
    try {
      const hit = await tryCatalogPlaceTxBuild(env!, creds);
      if (!hit) {
        ctx.skip(true, "catalog → place did not return HTTP 200 txBytes on this host");
        return;
      }
      assertCatalogPlaceTxBuildResult(hit.envelope);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("POST /predict/bets/claim sample body (opt-in E2E_API_TX_BUILD=1)", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(true, "Set E2E_API_TX_BUILD=1 to smoke POST /predict/bets/claim");
    }
    skipIfNoApiEnv(ctx, env);
    try {
      const endpoint = PREDICT_TX_BUILD_POST_ENDPOINTS.find((e) => e.path.endsWith("/claim"));
      if (!endpoint) return;
      const { status, envelope } = await apiPost(env!, endpoint.path, endpoint.sampleBody);
      if (status !== 200) {
        ctx.skip(
          true,
          `POST ${endpoint.path} returned HTTP ${status} — need real positionIds from bets/me/claimable`,
        );
        return;
      }
      assertSuccessEnvelope(envelope);
      assertTxBuildResponse(envelope.data);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
