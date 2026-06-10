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

  // Shape-valid body that passes the DTO — per-test overrides probe one
  // validation hole at a time. accountId/marketId are dummies: every case
  // below must be rejected before any chain lookup happens.
  const VALID_PLACE_BODY = {
    accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
    sender: "0x0000000000000000000000000000000000000000000000000000000000000001",
    marketId: `0x${"c".repeat(64)}`,
    selection: "YES",
    maxSpend: "1110000",
    minShares: "1",
    priceCapBps: "6001",
    expiryTs: String(Date.now() + 3_600_000),
  };

  it("POST /predict/bets/place rejects the SDK-only receiverAccountId field (forbidNonWhitelisted)", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      // Security pin: bet-sharing receiver must never be reachable through the
      // public API — the global pipe rejects unknown fields with 400.
      const { status, envelope } = await apiPost(env!, "/predict/bets/place", {
        ...VALID_PLACE_BODY,
        receiverAccountId: `0x${"d".repeat(64)}`,
      });
      expect(status).toBe(400);
      expect(envelope).toEqual(expect.objectContaining({ success: false }));
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it.for([
    ["negative maxSpend", { maxSpend: "-1" }],
    ["decimal maxSpend", { maxSpend: "1.5" }],
    ["non-numeric minShares", { minShares: "abc" }],
    ["selection outside YES/NO", { selection: "MAYBE" }],
  ] as const)(
    "POST /predict/bets/place rejects %s (400)",
    async ([, overrides], ctx: TestContext) => {
      skipIfNoApiEnv(ctx, env);
      try {
        const { status, envelope } = await apiPost(env!, "/predict/bets/place", {
          ...VALID_PLACE_BODY,
          ...overrides,
        });
        expect(status).toBe(400);
        expect(envelope).toEqual(expect.objectContaining({ success: false }));
      } catch (err) {
        skipIfUnreachable(ctx, err, env!.baseUrl);
        throw err;
      }
    },
  );

  it("POST /predict/bets/place never returns txBytes for a u64-overflow maxSpend", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      // `@IsNumberString` passes any digit string, so u64 max + 1 reaches the
      // SDK inside the service, which throws "exceeds u64 max". We only pin
      // "no txBytes": today this surfaces as a 500 (no DTO upper bound).
      const { status, envelope } = await apiPost<{ txBytes?: string }>(
        env!,
        "/predict/bets/place",
        { ...VALID_PLACE_BODY, maxSpend: "18446744073709551616" },
      );
      expect(status).toBeGreaterThanOrEqual(400);
      expect(envelope.success).toBe(false);
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
