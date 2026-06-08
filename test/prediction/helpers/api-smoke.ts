import { expect, type TestContext } from "vitest";

import { apiFetch, apiGet, assertSuccessEnvelope } from "./api-client.ts";
import {
  assertBetDetail,
  assertBetsClaimableList,
  assertBetsMeList,
  assertBetsSummary,
  assertEventDetail,
  assertFeedBrowseList,
  assertMarketDetail,
  assertQuotesMap,
  assertTxBuildResponse,
  inferMarketSegmentFromSlug,
  parseQueryLimit,
  parseQuerySegment,
  type EventDetailData,
  type FeedBrowseItemWire,
  type FeedBrowseListData,
} from "./api-contract.ts";
import type { MarketSegment } from "./api-endpoints.ts";
import type { ApiEnvironment } from "./api-env.ts";
import {
  skipIfInvalidToken,
  skipIfNoApiEnv,
  skipIfNoJwt,
  skipIfPredictIndexerTablesMissing,
  skipIfUnreachable,
} from "./api-skip.ts";
import type { BetsMeListData, BetWire } from "./api-wire.ts";
import { betWireId } from "./api-wire.ts";

export interface FeedMarketRef {
  slug: string;
  displayKind?: string;
  roundStartsAt?: number;
  feedItem?: FeedBrowseItemWire;
}

/** Chainable catalog context for detail / quotes / bet-detail smoke (from feed or bets/me). */
export interface CatalogContext {
  segment: MarketSegment;
  marketSlug: string;
  roundId?: string;
  roundStartsAt?: number;
  roundPhase?: string;
  displayKind?: string;
  feedItem?: FeedBrowseItemWire;
  betId?: string;
  source: "feed" | "bets-me";
}

export interface DiscoverCatalogContextOptions {
  segment?: MarketSegment;
  /** Prefer live/open rounds when probing multiple feed items (e.g. crypto epoch smoke). */
  preferActiveRound?: boolean;
}

interface FeedDataWire {
  items: FeedBrowseItemWire[];
}

/** HTTP 200 + envelope + feed/browse list contract. */
export async function fetchReachableCatalog(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<FeedBrowseListData> {
  const data = (await smokeGetReachable(ctx, env, path)) as FeedBrowseListData;
  assertFeedBrowseList(data, {
    limit: parseQueryLimit(path),
    segment: parseQuerySegment(path),
  });
  return data;
}

/** HTTP 200 + envelope + market detail contract. */
export async function fetchReachableDetail(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
  expectedSlug: string,
): Promise<unknown> {
  const data = await smokeGetReachable(ctx, env, path);
  assertMarketDetail(data, expectedSlug);
  return data;
}

/** HTTP 200 + envelope + bets/me list contract. */
export async function fetchReachableBetsMe(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  const data = await smokeGetReachableAuthed(ctx, env, path);
  assertBetsMeList(data, { limit: parseQueryLimit(path) });
  return data;
}

/** HTTP 200 + envelope + bets/me/summary contract. */
export async function fetchReachableBetsSummary(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  const data = await smokeGetReachableAuthed(ctx, env, path);
  assertBetsSummary(data);
  return data;
}

/** Phase-1 smoke: HTTP 200 + `{ success: true, data }` only. */
export async function smokeGetReachable(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  skipIfNoApiEnv(ctx, env);
  try {
    const { status, envelope } = await apiGet<unknown>(env, path);
    expect(status).toBe(200);
    assertSuccessEnvelope(envelope);
    expect(envelope.data).toBeDefined();
    return envelope.data;
  } catch (err) {
    skipIfUnreachable(ctx, err, env.baseUrl);
    throw err;
  }
}

/** Same as smokeGetReachable but applies JWT / CH infra skip helpers first. */
export async function smokeGetReachableAuthed(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  skipIfNoApiEnv(ctx, env);
  skipIfNoJwt(ctx, env!);
  try {
    const { status, envelope } = await apiGet<unknown>(env!, path);
    skipIfInvalidToken(ctx, status, envelope, { apiEnvName: env!.name });
    skipIfPredictIndexerTablesMissing(ctx, status, envelope);
    expect(status).toBe(200);
    assertSuccessEnvelope(envelope);
    expect(envelope.data).toBeDefined();
    return envelope.data;
  } catch (err) {
    skipIfUnreachable(ctx, err, env!.baseUrl);
    throw err;
  }
}

export function marketDetailPath(segment: MarketSegment, slug: string, query = ""): string {
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  return `/predict/markets/${segment}/${encodeURIComponent(slug)}${q}`;
}

export function eventDetailPath(slug: string, query = ""): string {
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  return `/predict/events/${encodeURIComponent(slug)}${q}`;
}

export function betDetailPath(betId: string, query = ""): string {
  const q = query.startsWith("?") || query === "" ? query : `?${query}`;
  return `/predict/bets/me/${encodeURIComponent(betId)}/detail${q}`;
}

export { inferMarketSegmentFromSlug } from "./api-contract.ts";

function segmentFromFeedItem(item: FeedBrowseItemWire): MarketSegment | null {
  const fromSlug = item.market?.slug ? inferMarketSegmentFromSlug(item.market.slug) : null;
  if (fromSlug) return fromSlug;
  const kind = (item.market.display?.kind ?? item.market.type ?? "").toLowerCase();
  if (kind.includes("sport")) return "sport";
  if (kind.includes("crypto")) return "crypto";
  if (kind.includes("politics")) return "politics";
  return null;
}

function normalizePhase(phase: string | undefined): string {
  return (phase ?? "").trim().toUpperCase().replace(/-/g, "_");
}

const ACTIVE_ROUND_PHASES = new Set(["LIVE", "OPEN", "UPCOMING", "SCHEDULED"]);

function roundIdFromItem(item: FeedBrowseItemWire): string | undefined {
  const r = item.round ?? item.nextRound;
  const id = r?.roundId ?? r?.id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function feedItemToContext(
  item: FeedBrowseItemWire,
  segment: MarketSegment,
  slug: string,
): CatalogContext {
  const round = item.round ?? item.nextRound;
  return {
    segment,
    marketSlug: slug,
    roundId: roundIdFromItem(item),
    roundStartsAt: round?.startsAt,
    roundPhase: round?.phase,
    displayKind: item.market.display?.kind,
    feedItem: item,
    source: "feed",
  };
}

/** Collect up to `max` round ids from feed/browse items (for quotes smoke). */
export function collectRoundIdsFromCatalog(data: FeedBrowseListData, max = 3): string[] {
  const out: string[] = [];
  for (const item of data.items) {
    const id = roundIdFromItem(item);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Picks the first feed slug whose detail endpoint returns HTTP 200.
 * Feed lists can include markets whose detail view is not yet materialized (404).
 */
/** HTTP 200 + envelope + event detail contract. */
export async function fetchReachableEvent(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
  expectedEventSlug: string,
): Promise<EventDetailData> {
  const data = (await smokeGetReachable(ctx, env, path)) as EventDetailData;
  assertEventDetail(data, expectedEventSlug);
  return data;
}

/** HTTP 200 + envelope + quotes map (may be empty). */
export async function fetchReachableQuotes(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  const data = await smokeGetReachable(ctx, env, path);
  assertQuotesMap(data);
  return data;
}

export async function fetchReachableBetsClaimable(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  const data = await smokeGetReachableAuthed(ctx, env, path);
  assertBetsClaimableList(data);
  return data;
}

export async function fetchReachableBetDetail(
  ctx: TestContext,
  env: ApiEnvironment | null,
  path: string,
): Promise<unknown> {
  const data = await smokeGetReachableAuthed(ctx, env, path);
  assertBetDetail(data);
  return data;
}

/**
 * First feed item whose detail endpoint returns HTTP 200.
 * Falls back to unfiltered feed when `?type=` returns no reachable slug.
 */
export async function discoverCatalogContext(
  env: ApiEnvironment,
  options: DiscoverCatalogContextOptions = {},
): Promise<CatalogContext | null> {
  const paths =
    options.segment === "politics"
      ? ["/predict/feed?limit=50"]
      : options.segment
        ? [`/predict/feed?type=${options.segment}&limit=50`, "/predict/feed?limit=50"]
        : ["/predict/feed?limit=50"];

  for (const feedPath of paths) {
    const { envelope } = await apiGet<FeedDataWire>(env, feedPath);
    assertSuccessEnvelope(envelope);

    const candidates = envelope.data.items
      .map((item) => {
        const slug = item.market?.slug;
        if (!slug) return null;
        const segment = segmentFromFeedItem(item);
        if (!segment) return null;
        if (options.segment && segment !== options.segment) return null;
        return { item, slug, segment };
      })
      .filter(
        (row): row is { item: FeedBrowseItemWire; slug: string; segment: MarketSegment } =>
          row !== null,
      );

    if (options.preferActiveRound) {
      candidates.sort((a, b) => {
        const aActive = ACTIVE_ROUND_PHASES.has(normalizePhase(a.item.round?.phase)) ? 0 : 1;
        const bActive = ACTIVE_ROUND_PHASES.has(normalizePhase(b.item.round?.phase)) ? 0 : 1;
        return aActive - bActive;
      });
    }

    for (const { item, slug, segment } of candidates) {
      const { status } = await apiFetch(env, marketDetailPath(segment, slug));
      if (status !== 200) continue;
      return feedItemToContext(item, segment, slug);
    }
  }
  return null;
}

/** Authed fallback: first bets/me row with reachable market detail. */
export async function discoverCatalogContextFromBetsMe(
  env: ApiEnvironment,
): Promise<CatalogContext | null> {
  if (!env.jwt) return null;
  const { status, envelope } = await apiGet<BetsMeListData>(env, "/predict/bets/me?limit=10");
  if (status !== 200) return null;
  assertSuccessEnvelope(envelope);

  for (const bet of envelope.data.bets) {
    const slug = bet.marketSlug;
    if (!slug) continue;
    const segment = inferMarketSegmentFromSlug(slug);
    if (!segment) continue;
    const { status: detailStatus } = await apiFetch(env, marketDetailPath(segment, slug));
    if (detailStatus !== 200) continue;
    return {
      segment,
      marketSlug: slug,
      roundId: bet.roundId,
      betId: betWireId(bet),
      source: "bets-me",
    };
  }
  return null;
}

/** Feed discovery, then bets/me when JWT is configured. */
export async function discoverCatalogContextWithFallback(
  env: ApiEnvironment,
  options: DiscoverCatalogContextOptions = {},
): Promise<CatalogContext | null> {
  const fromFeed = await discoverCatalogContext(env, options);
  if (fromFeed) return fromFeed;
  return discoverCatalogContextFromBetsMe(env);
}

export async function discoverReachableDetailSlug(
  env: ApiEnvironment,
  segment: MarketSegment,
): Promise<FeedMarketRef | null> {
  const ctx = await discoverCatalogContext(env, { segment });
  if (!ctx) return null;
  return {
    slug: ctx.marketSlug,
    displayKind: ctx.displayKind,
    roundStartsAt: ctx.roundStartsAt,
    feedItem: ctx.feedItem,
  };
}

/** Politics slugs use `politics-` prefix — probe feed without type filter. */
export async function discoverReachablePoliticsSlug(env: ApiEnvironment): Promise<string | null> {
  const ctx = await discoverCatalogContext(env, { segment: "politics" });
  return ctx?.marketSlug ?? null;
}

/**
 * Probe feed for `item.event.slug` or env `E2E_PREDICT_EVENT_SLUG`, then verify HTTP 200.
 */
export async function discoverReachableEventSlug(env: ApiEnvironment): Promise<string | null> {
  const override = process.env.E2E_PREDICT_EVENT_SLUG?.trim();
  if (override) {
    const { status } = await apiFetch(env, eventDetailPath(override));
    if (status === 200) return override;
  }

  const { envelope } = await apiGet<FeedDataWire>(env, "/predict/feed?limit=50");
  assertSuccessEnvelope(envelope);
  const seen = new Set<string>();
  for (const item of envelope.data.items) {
    const slug = item.event?.slug;
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const { status } = await apiFetch(env, eventDetailPath(slug));
    if (status === 200) return slug;
  }
  return null;
}

/** First bet with `betId` (or composite id) from authed bets/me. */
export function firstBetIdFromList(data: BetsMeListData): string | undefined {
  for (const bet of data.bets) {
    const id = betWireId(bet);
    if (id && id.includes(":")) return id;
    if (bet.betId) return String(bet.betId);
  }
  for (const bet of data.bets) {
    const id = betWireId(bet);
    if (id) return id;
  }
  return undefined;
}
