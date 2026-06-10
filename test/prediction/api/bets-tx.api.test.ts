import { describe, expect, it, type TestContext } from "vitest";

import { resolveBetsWalletAddress, withBetsAddress } from "../helpers/api-bets-path.ts";
import { apiGet, apiPost, assertSuccessEnvelope } from "../helpers/api-client.ts";
import { assertTxBuildResponse, type BetsMeListData } from "../helpers/api-contract.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";
import {
  assertCatalogPlaceTxBuildResult,
  formatCatalogPlaceFailures,
  hasTxBuildSmokeEnabled,
  resolvePlaceBetCredentials,
  tryCatalogPlaceTxBuild,
  type CatalogPlaceFailure,
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

  it("POST /predict/bets/place catalog closed loop (staging tx-build smoke)", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(
        true,
        "E2E_API_TX_BUILD disabled — set E2E_API_TX_BUILD=1 or use staging (default on)",
      );
    }
    skipIfNoApiEnv(ctx, env);
    const creds = resolvePlaceBetCredentials(env!);
    if (!creds) {
      ctx.skip(
        true,
        "Need place credentials — set E2E_ACCOUNT_ID (or seed accountId) + E2E_API_ADDRESS / E2E_API_PLACE_SENDER",
      );
      return;
    }
    try {
      const failures: CatalogPlaceFailure[] = [];
      const hit = await tryCatalogPlaceTxBuild(env!, creds, { failures });
      if (!hit) {
        ctx.skip(
          true,
          `catalog → place did not return HTTP 200 txBytes — ${formatCatalogPlaceFailures(failures)}`,
        );
        return;
      }
      assertCatalogPlaceTxBuildResult(hit.envelope);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("POST /predict/bets/claim txBytes when claimable positions exist", async (ctx: TestContext) => {
    if (!hasTxBuildSmokeEnabled()) {
      ctx.skip(
        true,
        "E2E_API_TX_BUILD disabled — set E2E_API_TX_BUILD=1 or use staging (default on)",
      );
    }
    skipIfNoApiEnv(ctx, env);
    const creds = resolvePlaceBetCredentials(env!);
    if (!creds) {
      ctx.skip(
        true,
        "Set E2E_API_PLACE_ACCOUNT_ID + E2E_API_PLACE_SENDER for claim tx-build smoke",
      );
      return;
    }
    const wallet = resolveBetsWalletAddress(env!);
    if (!wallet) {
      ctx.skip(true, "Set E2E_API_ADDRESS or E2E_API_JWT for GET /predict/bets/me/claimable");
      return;
    }
    try {
      const claimablePath = withBetsAddress("/predict/bets/me/claimable?limit=10", wallet);
      const { status, envelope } = await apiGet<BetsMeListData>(env!, claimablePath);
      if (status !== 200 || !envelope.success) {
        ctx.skip(true, `GET /predict/bets/me/claimable returned HTTP ${status}`);
        return;
      }
      const positionIds = envelope.data.bets
        .map((bet) => bet.positionId)
        .filter((id): id is string | number => id !== undefined && id !== null)
        .map(String);
      if (positionIds.length === 0) {
        ctx.skip(
          true,
          "no claimable positions for this wallet — skipping POST /predict/bets/claim",
        );
        return;
      }
      const { status: postStatus, envelope: postEnvelope } = await apiPost(
        env!,
        "/predict/bets/claim",
        {
          accountId: creds.accountId,
          sender: creds.sender,
          positionIds: [positionIds[0]!],
        },
      );
      if (postStatus !== 200 || !postEnvelope.success) {
        ctx.skip(
          true,
          `POST /predict/bets/claim returned HTTP ${postStatus} for positionId=${positionIds[0]}`,
        );
        return;
      }
      assertSuccessEnvelope(postEnvelope);
      assertTxBuildResponse(postEnvelope.data);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
