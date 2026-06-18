import { expect } from "vitest";

import type { MarketSegment } from "./api-endpoints.ts";
import type { BetsMeListData, BetWire } from "./api-wire.ts";

export type { BetWire, BetsMeListData } from "./api-wire.ts";
export {
  betListIncludesOrderId,
  betListIncludesPositionId,
  betOrderId,
  betWireAwaitingBrokerFill,
  betWireBrokerFilled,
  betWireId,
  betWireShares,
  findBetForChainFixture,
} from "./api-wire.ts";

/**
 * Wire contract aligned with bucket-backend-mono Bruno docs:
 * `docs/bruno/waterx/predict/` (feed, browse, detail, bets).
 * Staging may serialize round lifecycle as `phase` or `status` — both accepted.
 *
 * `unfilled` — bucket-backend-mono #689 (`order-state` Rule 1 / 7a): order never
 * matched (cancel before fill, or market resolved with zero fill). Distinct from
 * `refund` (round voided after a filled bet).
 */

export const KNOWN_ROUND_PHASES = new Set([
  "OPEN",
  "LOCKED",
  "SETTLING",
  "SETTLED",
  "RESOLVED",
  "CLOSED",
  "ENDED",
  "PAST",
  "UPCOMING",
  "LIVE",
  "CANCELLED",
  "SCHEDULED",
]);

export const KNOWN_DISPLAY_KINDS = new Set(["crypto", "sport", "sport-award", "politics"]);

export const KNOWN_BET_SIDE_KEYS = new Set(["up", "down", "teamA", "teamB", "draw"]);

export const KNOWN_CHART_KINDS = new Set(["price", "probability"]);

/** `pending` | `unfilled` | `won` | `lost` | `refund` — mirrors backend `BetOutcome`. */
export const KNOWN_BET_OUTCOMES = new Set(["pending", "unfilled", "won", "lost", "refund"]);

export const KNOWN_SUBMISSION_STATES = new Set(["confirmed", "submitting"]);

export interface MarketDisplayWire {
  kind?: string;
  symbol?: string;
  league?: string;
  rulesKey?: string;
  volumeUsd?: number;
  displayLocale?: string;
}

export interface MarketWire {
  id?: string;
  slug: string;
  type?: string;
  display?: MarketDisplayWire;
  tags?: string[];
  isNew?: boolean;
}

export interface BetSideWire {
  key: string;
  oddsCents?: number | string | null;
  trade?: { marketId?: string; selection?: string };
}

export interface RoundWire {
  id?: string;
  roundId?: string;
  marketId?: string;
  startsAt?: number;
  endsAt?: number;
  /** Bruno docs use `status`; some deployments expose `phase`. */
  phase?: string;
  status?: string;
  sides?: BetSideWire[];
  volumeUsd?: number;
  chart?: { kind?: string; series?: unknown[] };
  anchorPrice?: number;
}

export interface FeedBrowseListData {
  items: FeedBrowseItemWire[];
  nextCursor?: string | null;
}

export interface FeedBrowseItemWire {
  market: MarketWire;
  /** Feed items carry the active round; browse uses `nextRound` instead. */
  event?: { slug?: string };
  round?: RoundWire;
  nextRound?: RoundWire;
}

export interface MarketDetailData {
  detail: {
    market: MarketWire;
    round?: RoundWire;
    outcomes?: unknown[];
    neighbors?: { past?: RoundWire[]; upcoming?: RoundWire[] };
    marketStats?: Record<string, unknown> | null;
  };
}

export interface BetsSummaryData {
  summary: {
    netPnlUsd: number | string;
    wonCount: number;
    lostCount: number;
    liveCount: number;
  };
}

/** GET /predict/events/:slug — { event, items } (multi-market event page; not on feed wire). */
export interface EventDetailData {
  event: { slug: string; type?: string; title?: string };
  items: FeedBrowseItemWire[];
}

/** GET /predict/quotes?rounds=… */
export type QuotesData = Record<string, Record<string, number | null>>;

export interface TxBuildResponseData {
  txBytes: string;
  sponsored?: boolean;
  digest?: string;
}

/** Infer URL segment from canonical slug prefix. */
export function inferMarketSegmentFromSlug(slug: string): MarketSegment | null {
  if (slug.startsWith("sport-")) return "sport";
  if (slug.startsWith("crypto-")) return "crypto";
  if (slug.startsWith("politics-")) return "politics";
  return null;
}

export function parseQueryLimit(pathOrQuery: string): number | undefined {
  const q = pathOrQuery.includes("?") ? pathOrQuery.slice(pathOrQuery.indexOf("?")) : pathOrQuery;
  const match = /(?:^|[?&])limit=(\d+)/i.exec(q.startsWith("?") ? q : `?${q}`);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
}

export function parseQuerySegment(pathOrQuery: string): "crypto" | "sport" | undefined {
  const q = pathOrQuery.includes("?") ? pathOrQuery.slice(pathOrQuery.indexOf("?")) : pathOrQuery;
  const match = /(?:^|[?&])type=(crypto|sport)/i.exec(q.startsWith("?") ? q : `?${q}`);
  return match ? (match[1]!.toLowerCase() as "crypto" | "sport") : undefined;
}

export function roundLifecycle(round: RoundWire | undefined): string | undefined {
  if (!round) return undefined;
  const raw = round.phase ?? round.status;
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export function roundIdFromRound(round: RoundWire | undefined): string | undefined {
  if (!round) return undefined;
  const id = round.id ?? round.roundId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function itemSegmentKind(item: FeedBrowseItemWire): string {
  return (item.market.display?.kind ?? item.market.type ?? "").toLowerCase();
}

function normalizeRoundPhase(phase: string): string {
  return phase.trim().toUpperCase().replace(/-/g, "_");
}

function assertUnixSeconds(value: number, label: string): void {
  expect(typeof value).toBe("number");
  expect(value).toBeGreaterThan(1_000_000_000);
  expect(value).toBeLessThan(4_000_000_000);
}

function assertRoundPhase(phase: string, label: string): void {
  expect(typeof phase).toBe("string");
  expect(phase.length).toBeGreaterThan(0);
  const normalized = normalizeRoundPhase(phase);
  expect(
    KNOWN_ROUND_PHASES.has(normalized),
    `${label} should be a known catalog phase/status, got ${phase}`,
  ).toBe(true);
}

function assertBetSide(side: BetSideWire, label: string): void {
  expect(typeof side.key).toBe("string");
  expect(KNOWN_BET_SIDE_KEYS.has(side.key), `${label}.key invalid: ${side.key}`).toBe(true);
  if (side.oddsCents === null || side.oddsCents === undefined) {
    // Past/neighbor rounds may omit live odds (Bruno: cron snapshot fallback).
    return;
  }
  const odds = typeof side.oddsCents === "string" ? Number(side.oddsCents) : side.oddsCents;
  expect(Number.isFinite(odds), `${label}.oddsCents`).toBe(true);
  expect(odds).toBeGreaterThanOrEqual(0);
  expect(odds).toBeLessThanOrEqual(100);
  if (side.trade !== undefined) {
    expect(typeof side.trade).toBe("object");
    if (side.trade.marketId !== undefined) {
      expect(typeof side.trade.marketId).toBe("string");
      expect(side.trade.marketId.length).toBeGreaterThan(0);
    }
    if (side.trade.selection !== undefined) {
      expect(["YES", "NO"].includes(side.trade.selection)).toBe(true);
    }
  }
}

function assertRoundWire(round: RoundWire, label: string, options?: { requireId?: boolean }): void {
  const lifecycle = roundLifecycle(round);
  if (lifecycle !== undefined) assertRoundPhase(lifecycle, label);
  if (round.startsAt !== undefined) assertUnixSeconds(round.startsAt, `${label}.startsAt`);
  if (round.endsAt !== undefined) {
    assertUnixSeconds(round.endsAt, `${label}.endsAt`);
    if (round.startsAt !== undefined) {
      expect(round.endsAt).toBeGreaterThanOrEqual(round.startsAt);
    }
  }
  const id = roundIdFromRound(round);
  if (options?.requireId) {
    expect(id, `${label} should expose id`).toBeDefined();
  } else if (id !== undefined) {
    expect(typeof id).toBe("string");
  }
  if (round.marketId !== undefined) {
    expect(typeof round.marketId).toBe("string");
    expect(round.marketId.length).toBeGreaterThan(0);
  }
  if (round.volumeUsd !== undefined) {
    expect(typeof round.volumeUsd).toBe("number");
    expect(round.volumeUsd).toBeGreaterThanOrEqual(0);
  }
  if (round.sides !== undefined) {
    expect(Array.isArray(round.sides)).toBe(true);
    expect(round.sides.length).toBeGreaterThan(0);
    for (const [i, side] of round.sides.entries()) {
      assertBetSide(side, `${label}.sides[${i}]`);
    }
  }
  if (round.chart !== undefined) {
    expect(typeof round.chart).toBe("object");
    if (round.chart.kind !== undefined) {
      expect(KNOWN_CHART_KINDS.has(round.chart.kind), `${label}.chart.kind`).toBe(true);
    }
    if (round.chart.series !== undefined) {
      expect(Array.isArray(round.chart.series)).toBe(true);
    }
  }
  if (round.anchorPrice !== undefined) {
    expect(typeof round.anchorPrice).toBe("number");
    expect(round.anchorPrice).toBeGreaterThan(0);
  }
}

function assertMarketWire(market: MarketWire, label: string): void {
  expect(typeof market.slug).toBe("string");
  expect(market.slug.length).toBeGreaterThan(0);
  const segment = inferMarketSegmentFromSlug(market.slug);
  if (segment) {
    expect(market.slug.startsWith(`${segment}-`), `${label}.slug prefix`).toBe(true);
  }
  if (market.id !== undefined) {
    expect(typeof market.id).toBe("string");
    expect(market.id.length).toBeGreaterThan(0);
  }
  if (market.type !== undefined) expect(typeof market.type).toBe("string");
  if (market.display !== undefined) {
    expect(typeof market.display).toBe("object");
    if (market.display.kind !== undefined) {
      expect(KNOWN_DISPLAY_KINDS.has(market.display.kind), `${label}.display.kind`).toBe(true);
    }
  }
  if (market.isNew !== undefined) expect(typeof market.isNew).toBe("boolean");
  if (market.tags !== undefined) {
    expect(Array.isArray(market.tags)).toBe(true);
    for (const tag of market.tags) expect(typeof tag).toBe("string");
  }
}

function assertOptionalRound(
  round: RoundWire | undefined,
  label: string,
  options?: { requireId?: boolean },
): void {
  if (!round) return;
  assertRoundWire(round, label, options);
}

/** Asserts GET /predict/feed and /predict/browse list `data` shape. */
export function assertFeedBrowseList(
  data: unknown,
  options?: { limit?: number; segment?: "crypto" | "sport" },
): asserts data is FeedBrowseListData {
  expect(data).toBeDefined();
  expect(data).toEqual(expect.objectContaining({ items: expect.any(Array) }));
  const list = data as FeedBrowseListData;
  if (options?.limit !== undefined) {
    expect(list.items.length).toBeLessThanOrEqual(options.limit);
  }
  if ("nextCursor" in list) {
    expect(list.nextCursor === null || typeof list.nextCursor === "string").toBe(true);
  }
  for (const [i, item] of list.items.entries()) {
    expect(item, `items[${i}]`).toEqual(expect.objectContaining({ market: expect.any(Object) }));
    assertMarketWire(item.market, `items[${i}].market`);
    if (options?.segment) {
      const kind = itemSegmentKind(item);
      expect(
        kind.includes(options.segment),
        `items[${i}] market kind/type should match ?type=${options.segment}, got ${kind || "(empty)"}`,
      ).toBe(true);
    }
    const hasRound = item.round !== undefined || item.nextRound !== undefined;
    expect(hasRound, `items[${i}] should expose round or nextRound`).toBe(true);
    assertOptionalRound(item.round, `items[${i}].round`, { requireId: true });
    assertOptionalRound(item.nextRound, `items[${i}].nextRound`, { requireId: true });
    if (item.event?.slug !== undefined) {
      expect(typeof item.event.slug).toBe("string");
      expect(item.event.slug.length).toBeGreaterThan(0);
    }
  }
}

/** Asserts GET /predict/markets/{sport|crypto|politics}/:slug `data` shape. */
export function assertMarketDetail(
  data: unknown,
  expectedSlug: string,
): asserts data is MarketDetailData {
  expect(data).toEqual(expect.objectContaining({ detail: expect.any(Object) }));
  const detail = (data as MarketDetailData).detail;
  assertMarketWire(detail.market, "detail.market");
  expect(detail.market.slug).toBe(expectedSlug);
  assertOptionalRound(detail.round, "detail.round", { requireId: true });
  if (detail.outcomes !== undefined) {
    expect(Array.isArray(detail.outcomes)).toBe(true);
    expect(detail.outcomes.length).toBeGreaterThan(0);
  }
  if (detail.neighbors !== undefined) {
    expect(typeof detail.neighbors).toBe("object");
    if (detail.neighbors.past !== undefined) {
      expect(Array.isArray(detail.neighbors.past)).toBe(true);
      for (const [i, r] of detail.neighbors.past.entries()) {
        assertRoundWire(r, `detail.neighbors.past[${i}]`);
      }
    }
    if (detail.neighbors.upcoming !== undefined) {
      expect(Array.isArray(detail.neighbors.upcoming)).toBe(true);
      for (const [i, r] of detail.neighbors.upcoming.entries()) {
        assertRoundWire(r, `detail.neighbors.upcoming[${i}]`);
      }
    }
  }
  if (detail.marketStats !== undefined && detail.marketStats !== null) {
    expect(typeof detail.marketStats).toBe("object");
    const stats = detail.marketStats;
    for (const key of ["volumeUsd", "volume24hUsd", "liquidityUsd"] as const) {
      if (stats[key] !== undefined) {
        expect(["number", "string"].includes(typeof stats[key])).toBe(true);
      }
    }
    if (stats.snapshotAt !== undefined)
      assertUnixSeconds(Number(stats.snapshotAt), "marketStats.snapshotAt");
  }
}

/** Asserts feed item round phase is compatible with detail (when both present). */
export function assertFeedDetailPhaseConsistent(
  feedItem: FeedBrowseItemWire,
  detailData: MarketDetailData,
): void {
  const feedPhase = roundLifecycle(feedItem.round ?? feedItem.nextRound);
  const detailPhase = roundLifecycle(detailData.detail.round);
  if (!feedPhase || !detailPhase) return;
  expect(
    normalizeRoundPhase(detailPhase),
    "detail.round phase should match feed list when both are present",
  ).toBe(normalizeRoundPhase(feedPhase));
}

/** Feed/detail round ids should match when the same slug is queried without epoch. */
export function assertFeedDetailRoundConsistent(
  feedItem: FeedBrowseItemWire,
  detailData: MarketDetailData,
): void {
  const feedRoundId = roundIdFromRound(feedItem.round ?? feedItem.nextRound);
  const detailRoundId = roundIdFromRound(detailData.detail.round);
  if (!feedRoundId || !detailRoundId) return;
  expect(detailRoundId, "detail.round.id should match feed round id").toBe(feedRoundId);
}

function assertBetWireRow(bet: BetWire, label: string): void {
  const hasId =
    bet.betId !== undefined ||
    bet.orderId !== undefined ||
    bet.order_id !== undefined ||
    bet.positionId !== undefined ||
    bet.position_id !== undefined;
  expect(hasId, `${label} should expose betId or order/position id`).toBe(true);

  if (bet.betId !== undefined) expect(typeof bet.betId).toBe("string");
  if (bet.marketId !== undefined) {
    expect(typeof bet.marketId).toBe("string");
    expect(bet.marketId.length).toBeGreaterThan(0);
  }
  if (bet.roundId !== undefined) {
    expect(typeof bet.roundId).toBe("string");
    expect(bet.roundId.length).toBeGreaterThan(0);
  }
  if (bet.marketSlug !== undefined) {
    expect(typeof bet.marketSlug).toBe("string");
    expect(bet.marketSlug.length).toBeGreaterThan(0);
  }

  const side = bet.side ?? bet.selection;
  if (side !== undefined) {
    expect(typeof side).toBe("string");
    const known = KNOWN_BET_SIDE_KEYS.has(side) || ["YES", "NO"].includes(side.toUpperCase());
    expect(known, `${label}.side/selection`).toBe(true);
  }

  const odds = bet.lockedOddsCents ?? bet.priceCapBps;
  if (odds !== undefined) {
    const n = typeof odds === "string" ? Number(odds) : odds;
    expect(Number.isFinite(n)).toBe(true);
    if (bet.lockedOddsCents !== undefined) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(100);
    }
  }

  const stakeUsd = bet.stakeUsd ?? (bet.stake as { amountUsd?: number } | undefined)?.amountUsd;
  if (stakeUsd !== undefined) {
    const n = typeof stakeUsd === "string" ? Number(stakeUsd) : stakeUsd;
    expect(Number.isFinite(n)).toBe(true);
    expect(n).toBeGreaterThanOrEqual(0);
  }

  if (bet.placedAt !== undefined) {
    expect(typeof bet.placedAt).toBe("number");
    expect(bet.placedAt).toBeGreaterThan(1_000_000_000_000);
  }
  if (bet.outcome !== undefined) {
    expect(KNOWN_BET_OUTCOMES.has(bet.outcome), `${label}.outcome`).toBe(true);
  }
  if (bet.submissionState !== undefined) {
    expect(KNOWN_SUBMISSION_STATES.has(bet.submissionState), `${label}.submissionState`).toBe(true);
  }
  if (bet.status !== undefined) {
    expect(typeof bet.status).toBe("string");
    expect(bet.status.length).toBeGreaterThan(0);
  }

  const snap = bet.cardSnapshot as { kind?: string } | undefined;
  if (snap !== undefined) {
    expect(typeof snap).toBe("object");
    if (snap.kind !== undefined) {
      expect(["crypto", "sport", "sport-award"].includes(snap.kind)).toBe(true);
    }
  }
}

export function assertBetsMeList(
  data: unknown,
  options?: { limit?: number },
): asserts data is BetsMeListData {
  expect(data).toEqual(expect.objectContaining({ bets: expect.any(Array) }));
  const list = data as BetsMeListData;
  if (options?.limit !== undefined) {
    expect(list.bets.length).toBeLessThanOrEqual(options.limit);
  }
  if ("nextCursor" in list) {
    expect(list.nextCursor === null || typeof list.nextCursor === "string").toBe(true);
  }
  for (const [i, bet] of list.bets.entries()) {
    assertBetWireRow(bet, `bets[${i}]`);
  }
}

export function assertBetsSummary(data: unknown): asserts data is BetsSummaryData {
  expect(data).toEqual(expect.objectContaining({ summary: expect.any(Object) }));
  const { summary } = data as BetsSummaryData;
  expect(typeof summary.wonCount).toBe("number");
  expect(typeof summary.lostCount).toBe("number");
  expect(typeof summary.liveCount).toBe("number");
  expect(summary.wonCount).toBeGreaterThanOrEqual(0);
  expect(summary.lostCount).toBeGreaterThanOrEqual(0);
  expect(summary.liveCount).toBeGreaterThanOrEqual(0);
  expect(["number", "string"].includes(typeof summary.netPnlUsd)).toBe(true);
}

/** GET /predict/events/:slug */
export function assertEventDetail(
  data: unknown,
  expectedEventSlug: string,
): asserts data is EventDetailData {
  expect(data).toEqual(
    expect.objectContaining({ event: expect.any(Object), items: expect.any(Array) }),
  );
  const row = data as EventDetailData;
  expect(row.event.slug).toBe(expectedEventSlug);
  if (row.event.title !== undefined) expect(typeof row.event.title).toBe("string");
  if (row.event.type !== undefined) expect(typeof row.event.type).toBe("string");
  for (const [i, item] of row.items.entries()) {
    assertMarketWire(item.market, `items[${i}].market`);
    assertOptionalRound(item.round ?? item.nextRound, `items[${i}].round`, { requireId: true });
  }
}

/** GET /predict/quotes — empty `{}` or roundId → sideKey → oddsCents. */
export function assertQuotesMap(data: unknown): asserts data is QuotesData {
  expect(data).toBeDefined();
  expect(typeof data).toBe("object");
  if (data === null) throw new Error("quotes data is null");
  const map = data as QuotesData;
  for (const [roundId, sides] of Object.entries(map)) {
    expect(typeof roundId).toBe("string");
    expect(roundId.length).toBeGreaterThan(0);
    expect(typeof sides).toBe("object");
    expect(sides).not.toBeNull();
    for (const [sideKey, odds] of Object.entries(sides!)) {
      expect(
        KNOWN_BET_SIDE_KEYS.has(sideKey) || sideKey === "price",
        `quotes side key ${sideKey}`,
      ).toBe(true);
      expect(odds === null || (typeof odds === "number" && odds >= 0 && odds <= 100)).toBe(true);
    }
  }
}

/**
 * Quotes map keys should cover requested round ids; side keys should ⊆ detail.round.sides when provided.
 * Bruno: quotes returns live odds per round id.
 */
export function assertQuotesConsistentWithRounds(
  quotes: QuotesData,
  roundIds: string[],
  detailRound?: RoundWire,
): void {
  assertQuotesMap(quotes);
  for (const roundId of roundIds) {
    expect(roundId in quotes, `quotes should include round id ${roundId}`).toBe(true);
  }
  if (!detailRound?.sides?.length) return;
  const detailKeys = new Set(detailRound.sides.map((s) => s.key));
  for (const roundId of roundIds) {
    const sideMap = quotes[roundId];
    if (!sideMap) continue;
    for (const key of Object.keys(sideMap)) {
      if (key === "price") continue;
      expect(
        detailKeys.has(key),
        `quotes[${roundId}].${key} should exist on detail.round.sides`,
      ).toBe(true);
    }
  }
}

/** GET /predict/bets/me/claimable — same list envelope as bets/me. */
export function assertBetsClaimableList(data: unknown): asserts data is BetsMeListData {
  assertBetsMeList(data);
}

/** GET /predict/bets/me/:betId/detail — bet object (superset of list row). */
export function assertBetDetail(data: unknown): void {
  expect(data).toEqual(expect.objectContaining({ bet: expect.any(Object) }));
  const bet = (data as { bet: BetWire }).bet;
  assertBetWireRow(bet, "detail.bet");
}

/** POST /predict/bets/place | /predict/bets/claim */
export function assertTxBuildResponse(data: unknown): asserts data is TxBuildResponseData {
  expect(data).toEqual(expect.objectContaining({ txBytes: expect.any(String) }));
  const row = data as TxBuildResponseData;
  expect(row.txBytes.length).toBeGreaterThan(0);
  if (row.sponsored !== undefined) expect(typeof row.sponsored).toBe("boolean");
  if (row.digest !== undefined) expect(typeof row.digest).toBe("string");
}
