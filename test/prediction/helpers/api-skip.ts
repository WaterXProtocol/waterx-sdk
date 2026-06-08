import type { TestContext } from "vitest";

import { isApiUnreachableError } from "./api-client.ts";
import type { ApiEnvironment } from "./api-env.ts";

export function skipIfNoApiEnv(
  ctx: TestContext,
  env: ApiEnvironment | null,
): asserts env is ApiEnvironment {
  if (!env) {
    ctx.skip(
      true,
      "No API baseUrl — set E2E_API_BASE_URL or configure test/prediction/api/environments/{local|staging}.json",
    );
  }
}

export function skipIfNoJwt(ctx: TestContext, env: ApiEnvironment): void {
  if (!env.jwt) {
    ctx.skip(true, "E2E_API_JWT not set — skipping authenticated /predict/bets/* tests");
  }
}

export function skipIfUnreachable(ctx: TestContext, err: unknown, baseUrl: string): void {
  if (isApiUnreachableError(err)) {
    ctx.skip(
      true,
      `API unreachable at ${baseUrl} — start waterx:dev (local) or switch E2E_API_ENV`,
    );
  }
}

const TOKEN_INVALID_CODE = 30_003;
const TOKEN_EXPIRED_CODE = 30_002;

function parseApiAuthError(body: unknown): { code?: number; message?: string } | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const err = (body as { error?: { code?: number; message?: string } }).error;
  if (!err) return null;
  return { code: err.code, message: err.message };
}

function mintJwtHint(apiEnvName?: string): string {
  return apiEnvName === "staging" ? "pnpm mint:api-jwt:staging" : "pnpm mint:api-jwt";
}

/**
 * Human-readable skip/CLI hint when JWT auth failed (invalid or expired).
 * Returns null when the response is not a recognized auth failure.
 */
export function jwtAuthSkipReason(
  status: number,
  body: unknown,
  options?: { apiEnvName?: string },
): string | null {
  if (status !== 401 && status !== 403) return null;
  const err = parseApiAuthError(body);
  const message = err?.message ?? "";
  const code = err?.code;
  const mint = mintJwtHint(options?.apiEnvName);

  if (code === TOKEN_EXPIRED_CODE || /token expired/i.test(message)) {
    return (
      `E2E_API_JWT expired on this API host (HTTP ${status}, code ${code ?? "n/a"}) — ` +
      `run \`${mint}\` (needs SUI_PRIVATE_KEY) then re-run`
    );
  }
  if (code === TOKEN_INVALID_CODE || /invalid token/i.test(message)) {
    return (
      `E2E_API_JWT invalid on this API host (HTTP ${status}, code ${code ?? "n/a"}) — ` +
      `run \`${mint}\` (needs SUI_PRIVATE_KEY) then re-run`
    );
  }
  return null;
}

/** Staging/production use a different JWT_SECRET than local `mint:api-jwt`. */
export function skipIfInvalidToken(
  ctx: TestContext,
  status: number,
  body: unknown,
  options?: { apiEnvName?: string },
): void {
  const reason = jwtAuthSkipReason(status, body, options);
  if (reason) ctx.skip(true, reason);
}

/** Local CH often lacks predict-indexer tables (`events_predict_*`). */
export function skipIfPredictIndexerTablesMissing(
  ctx: TestContext,
  status: number,
  body: unknown,
): void {
  if (status !== 500 || typeof body !== "object" || body === null || !("error" in body)) return;
  const msg = String((body as { error?: { message?: string } }).error?.message ?? "");
  if (/events_predict_/i.test(msg) || /Unknown table/i.test(msg)) {
    ctx.skip(
      true,
      "Predict ClickHouse indexer tables missing — load data-infra/waterx-predict-indexer schema on this API host",
    );
  }
}
