import type { TestContext } from "vitest";

import { resolveBetsWalletAddress, skipIfNoBetsWallet, withBetsAddress } from "./api-bets-path.ts";
import { apiGet, assertSuccessEnvelope } from "./api-client.ts";
import {
  assertBetsMeList,
  assertBetsSummary,
  betListIncludesOrderId,
  betListIncludesPositionId,
  findBetForChainFixture,
  type BetsMeListData,
  type BetsSummaryData,
  type BetWire,
} from "./api-contract.ts";
import { resolveApiEnvironment, type ApiEnvironment } from "./api-env.ts";
import { pollUntil } from "./api-poll.ts";
import {
  skipIfBetsMissingAddress,
  skipIfNoApiEnv,
  skipIfPredictIndexerTablesMissing,
} from "./api-skip.ts";
import { optionalEnv } from "./e2e-env.ts";

/** Opt-in: chain tx + HTTP `GET /predict/bets/me` cross-check (`E2E_API_CROSSCHECK=1`). */
export function hasApiCrosscheckEnabled(): boolean {
  const v = optionalEnv("E2E_API_CROSSCHECK");
  return v === "1" || v === "true";
}

export function resolveIntegrationApiEnv(): ApiEnvironment | null {
  return resolveApiEnvironment();
}

export function skipIntegrationApiCrosscheck(
  ctx: TestContext,
  env: ApiEnvironment | null,
  wallet?: string,
): asserts env is ApiEnvironment {
  if (!hasApiCrosscheckEnabled()) {
    ctx.skip(true, "E2E_API_CROSSCHECK not set — skipping HTTP bets cross-check");
  }
  skipIntegrationApiBets(ctx, env, wallet);
}

/** Predict bets/me HTTP steps — requires wallet `?address=` (backend #601). */
export function skipIntegrationApiBets(
  ctx: TestContext,
  env: ApiEnvironment | null,
  wallet?: string,
): asserts env is ApiEnvironment {
  skipIfNoApiEnv(ctx, env);
  skipIfNoBetsWallet(ctx, wallet ?? resolveBetsWalletAddress(env!));
}

/** @deprecated Use `skipIntegrationApiBets` — bets reads are public since backend #601. */
export function skipIntegrationApiAuthed(
  ctx: TestContext,
  env: ApiEnvironment | null,
  wallet?: string,
): asserts env is ApiEnvironment {
  skipIntegrationApiBets(ctx, env, wallet);
}

export async function fetchBetsMe(
  ctx: TestContext,
  env: ApiEnvironment,
  query = "?filter=all&limit=50",
  wallet?: string,
): Promise<BetsMeListData> {
  const owner = resolveBetsWalletAddress(env, wallet);
  skipIfNoBetsWallet(ctx, owner);
  const raw = query.startsWith("/predict/bets/me")
    ? query
    : `/predict/bets/me${query.startsWith("?") ? query : `?${query}`}`;
  const path = withBetsAddress(raw, owner);
  const { status, envelope } = await apiGet<BetsMeListData>(env, path);
  skipIfBetsMissingAddress(ctx, status, envelope);
  skipIfPredictIndexerTablesMissing(ctx, status, envelope);
  if (status !== 200) {
    throw new Error(`GET ${path} returned HTTP ${status}`);
  }
  assertSuccessEnvelope(envelope);
  assertBetsMeList(envelope.data);
  return envelope.data;
}

/**
 * Poll `GET /predict/bets/me` until `orderId` appears. Returns false if list stays empty
 * (common until wallet→account resolver lands); throws on timeout when bets exist but id missing.
 */
export async function fetchBetsSummary(
  ctx: TestContext,
  env: ApiEnvironment,
  query = "",
  wallet?: string,
): Promise<BetsSummaryData> {
  const owner = resolveBetsWalletAddress(env, wallet);
  skipIfNoBetsWallet(ctx, owner);
  const raw = query.startsWith("/predict/bets/me/summary")
    ? query
    : `/predict/bets/me/summary${query.startsWith("?") ? query : query ? `?${query}` : ""}`;
  const path = withBetsAddress(raw, owner);
  const { status, envelope } = await apiGet<BetsSummaryData>(env, path);
  skipIfBetsMissingAddress(ctx, status, envelope);
  skipIfPredictIndexerTablesMissing(ctx, status, envelope);
  if (status !== 200) {
    throw new Error(`GET ${path} returned HTTP ${status}`);
  }
  assertSuccessEnvelope(envelope);
  assertBetsSummary(envelope.data);
  return envelope.data;
}

export async function pollBetsMeForOrderId(
  ctx: TestContext,
  env: ApiEnvironment,
  orderId: string | bigint,
  options?: { timeoutMs?: number; intervalMs?: number; wallet?: string },
): Promise<boolean> {
  let sawAnyBet = false;
  try {
    await pollUntil(
      async () => {
        const data = await fetchBetsMe(ctx, env, "?filter=all&limit=50", options?.wallet);
        if (data.bets.length > 0) sawAnyBet = true;
        return betListIncludesOrderId(data.bets, orderId);
      },
      {
        timeoutMs: options?.timeoutMs ?? 60_000,
        intervalMs: options?.intervalMs ?? 2_000,
        label: `orderId ${orderId} in GET /predict/bets/me`,
      },
    );
    return true;
  } catch (err) {
    if (!sawAnyBet) return false;
    throw err;
  }
}

/**
 * Poll `GET /predict/bets/me` until `positionId` appears. Returns false when the list stays
 * empty (indexer lag); throws on timeout when bets exist but id is missing.
 */
export async function pollBetsMeForPositionId(
  ctx: TestContext,
  env: ApiEnvironment,
  positionId: string | bigint,
  options?: { timeoutMs?: number; intervalMs?: number; wallet?: string },
): Promise<boolean> {
  let sawAnyBet = false;
  try {
    await pollUntil(
      async () => {
        const data = await fetchBetsMe(ctx, env, "?filter=all&limit=50", options?.wallet);
        if (data.bets.length > 0) sawAnyBet = true;
        return betListIncludesPositionId(data.bets, positionId);
      },
      {
        timeoutMs: options?.timeoutMs ?? 60_000,
        intervalMs: options?.intervalMs ?? 2_000,
        label: `positionId ${positionId} in GET /predict/bets/me`,
      },
    );
    return true;
  } catch (err) {
    if (!sawAnyBet) return false;
    throw err;
  }
}

export interface PollBetsMeFixtureResult {
  data: BetsMeListData;
  bet: BetWire;
}

/**
 * Poll until a bet row matches chain `orderId` / `positionId`.
 * - Returns `null` when the list stays empty (wallet→account resolver / indexer not wired).
 * - Throws when bets exist but no row matches within the timeout.
 */
export async function pollBetsMeForChainFixture(
  ctx: TestContext,
  env: ApiEnvironment,
  fixture: { orderId?: bigint; positionId?: bigint },
  options?: { timeoutMs?: number; intervalMs?: number; query?: string; wallet?: string },
): Promise<PollBetsMeFixtureResult | null> {
  const query = options?.query ?? "?filter=all&limit=50";
  let sawAnyBet = false;
  let lastSample = "";

  try {
    await pollUntil(
      async () => {
        const data = await fetchBetsMe(ctx, env, query, options?.wallet);
        if (data.bets.length > 0) {
          sawAnyBet = true;
          const sample = data.bets[0]!;
          lastSample = JSON.stringify({
            orderId: sample.orderId ?? sample.order_id,
            positionId: sample.positionId ?? sample.position_id,
            status: sample.status,
          });
        }
        return findBetForChainFixture(data.bets, fixture) !== undefined;
      },
      {
        timeoutMs: options?.timeoutMs ?? 60_000,
        intervalMs: options?.intervalMs ?? 2_000,
        label: `chain fixture ${JSON.stringify({
          orderId: fixture.orderId?.toString(),
          positionId: fixture.positionId?.toString(),
        })} in GET /predict/bets/me`,
      },
    );
    const data = await fetchBetsMe(ctx, env, query, options?.wallet);
    const bet = findBetForChainFixture(data.bets, fixture);
    if (!bet) throw new Error("poll succeeded but findBetForChainFixture returned undefined");
    return { data, bet };
  } catch (err) {
    if (!sawAnyBet) return null;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${msg}${lastSample ? ` (sample bet: ${lastSample})` : ""}`, { cause: err });
  }
}
