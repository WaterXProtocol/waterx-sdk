import { describe, expect, it, vi } from "vitest";

import {
  jwtAuthSkipReason,
  skipIfBetsMissingAddress,
  skipIfInvalidToken,
} from "../helpers/api-skip.ts";

describe("jwtAuthSkipReason", () => {
  it("returns mint hint for Token expired (30002)", () => {
    const reason = jwtAuthSkipReason(401, {
      success: false,
      error: { code: 30_002, message: "Token expired" },
    });
    expect(reason).toMatch(/expired/i);
    expect(reason).toMatch(/mint:api-jwt/);
  });

  it("uses staging mint command when apiEnvName is staging", () => {
    const reason = jwtAuthSkipReason(
      401,
      { success: false, error: { code: 30_002, message: "Token expired" } },
      { apiEnvName: "staging" },
    );
    expect(reason).toContain("pnpm mint:api-jwt:staging");
  });

  it("returns mint hint for invalid token (30003)", () => {
    const reason = jwtAuthSkipReason(401, {
      success: false,
      error: { code: 30_003, message: "Invalid token" },
    });
    expect(reason).toMatch(/invalid/i);
    expect(reason).toMatch(/mint:api-jwt/);
  });

  it("returns null for unrelated HTTP errors", () => {
    expect(jwtAuthSkipReason(500, { success: false, error: { code: 500 } })).toBeNull();
    expect(jwtAuthSkipReason(200, { success: true, data: {} })).toBeNull();
  });
});

describe("skipIfInvalidToken", () => {
  it("skips the test when JWT is expired", () => {
    const skip = vi.fn();
    const ctx = { skip } as unknown as import("vitest").TestContext;

    skipIfInvalidToken(
      ctx,
      401,
      { success: false, error: { code: 30_002, message: "Token expired" } },
      { apiEnvName: "staging" },
    );

    expect(skip).toHaveBeenCalledOnce();
    expect(String(skip.mock.calls[0]?.[1])).toMatch(/expired/i);
    expect(String(skip.mock.calls[0]?.[1])).toContain("mint:api-jwt:staging");
  });

  it("does not skip on HTTP 200", () => {
    const skip = vi.fn();
    const ctx = { skip } as unknown as import("vitest").TestContext;

    skipIfInvalidToken(ctx, 200, { success: true, data: { bets: [] } });

    expect(skip).not.toHaveBeenCalled();
  });
});

describe("skipIfBetsMissingAddress", () => {
  it("skips when backend returns 20002 missing address", () => {
    const skip = vi.fn();
    const ctx = { skip } as unknown as import("vitest").TestContext;

    skipIfBetsMissingAddress(ctx, 400, {
      success: false,
      error: { code: 20_002, message: "Missing required field" },
    });

    expect(skip).toHaveBeenCalledOnce();
    expect(String(skip.mock.calls[0]?.[1])).toMatch(/address=/i);
  });

  it("does not skip on unrelated 400", () => {
    const skip = vi.fn();
    const ctx = { skip } as unknown as import("vitest").TestContext;

    skipIfBetsMissingAddress(ctx, 400, {
      success: false,
      error: { code: 99_999, message: "other" },
    });

    expect(skip).not.toHaveBeenCalled();
  });
});
