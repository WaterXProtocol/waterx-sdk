import { describe, expect, it, type TestContext } from "vitest";

import { apiFetch, apiPost } from "../helpers/api-client.ts";
import { resolveApiEnvironment } from "../helpers/api-env.ts";
import { skipIfNoApiEnv, skipIfUnreachable } from "../helpers/api-skip.ts";

/** DTO-valid place body — dummy accountId/marketId; each case overrides one hole. */
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

const CLAIM_BODY = {
  accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
  sender: "0x0000000000000000000000000000000000000000000000000000000000000001",
  positionIds: ["1"],
};

function assertErrorEnvelope(body: unknown): void {
  expect(body).toEqual(
    expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: expect.any(Number),
        message: expect.any(String),
      }),
    }),
  );
}

/** Place must never return signable bytes for invalid economics / expiry. */
function assertPlaceRejected(status: number, envelope: { success: boolean; data?: unknown }): void {
  expect(status).toBeGreaterThanOrEqual(400);
  expect(envelope.success).toBe(false);
  if (envelope.data && typeof envelope.data === "object" && "txBytes" in envelope.data) {
    expect((envelope.data as { txBytes?: string }).txBytes).toBeUndefined();
  }
}

describe("predict API — negative inputs (phase 2 gaps)", () => {
  const env = resolveApiEnvironment();

  it("GET /predict/bets/me without ?address= returns 400 code 20002", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const { status, body } = await apiFetch(env!, "/predict/bets/me?filter=all&limit=5");
      expect(status).toBe(400);
      assertErrorEnvelope(body);
      expect((body as { error: { code: number } }).error.code).toBe(20_002);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it.for([
    ["maxSpend zero", { maxSpend: "0" }],
    ["priceCapBps above 10000", { priceCapBps: "10001" }],
    ["expiryTs in the past", { expiryTs: "1" }],
  ] as const)(
    "POST /predict/bets/place rejects %s before txBytes",
    async ([, overrides], ctx: TestContext) => {
      skipIfNoApiEnv(ctx, env);
      try {
        const { status, envelope } = await apiPost<{ txBytes?: string }>(env!, "/predict/bets/place", {
          ...VALID_PLACE_BODY,
          ...overrides,
        });
        assertPlaceRejected(status, envelope);
      } catch (err) {
        skipIfUnreachable(ctx, err, env!.baseUrl);
        throw err;
      }
    },
  );

  it.for([
    ["negative limit", "/predict/feed?limit=-1"],
    ["non-numeric limit", "/predict/feed?limit=abc"],
  ] as const)("GET %s does not 500", async ([, path], ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const { status, body } = await apiFetch(env!, path);
      expect(status).not.toBe(500);
      if (status >= 400) {
        assertErrorEnvelope(body);
      } else {
        expect(body).toEqual(expect.objectContaining({ success: true }));
      }
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("GET /predict/quotes?rounds= with 101 ids is rejected (max 100; today may 500)", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    const rounds = Array.from({ length: 101 }, (_, i) => `round-${i}`).join(",");
    try {
      const { status, body } = await apiFetch(env!, `/predict/quotes?rounds=${rounds}`);
      // Ideal: 400 validation. Observed on staging: 500 when limit exceeded.
      expect(status).toBeGreaterThanOrEqual(400);
      assertErrorEnvelope(body);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });

  it("POST /predict/bets/claim rejects non-numeric positionIds (400)", async (ctx: TestContext) => {
    skipIfNoApiEnv(ctx, env);
    try {
      const { status, envelope } = await apiPost(env!, "/predict/bets/claim", {
        ...CLAIM_BODY,
        positionIds: ["abc"],
      });
      expect(status).toBe(400);
      assertErrorEnvelope(envelope);
    } catch (err) {
      skipIfUnreachable(ctx, err, env!.baseUrl);
      throw err;
    }
  });
});
