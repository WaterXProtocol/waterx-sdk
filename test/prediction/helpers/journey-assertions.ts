import type { PredictClient } from "~predict/client.ts";
import { getMarketById, getOrder, getPosition } from "~predict/fetch.ts";
import type { MarketView, OrderView, PositionView } from "~predict/types.ts";
import { expect } from "vitest";

import {
  assertBetsMeList,
  assertBetsSummary,
  assertFeedBrowseList,
  assertFeedDetailPhaseConsistent,
  assertFeedDetailRoundConsistent,
  assertMarketDetail,
  assertQuotesConsistentWithRounds,
  betListIncludesOrderId,
  betListIncludesPositionId,
  findBetForChainFixture,
  type BetsMeListData,
  type BetWire,
  type FeedBrowseItemWire,
  type FeedBrowseListData,
  type MarketDetailData,
  type QuotesData,
} from "./api-contract.ts";

type SimulateResult = Awaited<ReturnType<PredictClient["simulate"]>>;

/** Dry-run succeeded and executed at least one PTB command. */
export function assertSimulateSucceeded(result: SimulateResult, label: string): void {
  expect(result.$kind, `${label}: expected successful simulate`).not.toBe("FailedTransaction");
  const payload = result as {
    Transaction?: { commandResults?: unknown[] };
    commandResults?: unknown[];
  };
  const commands = payload.Transaction?.commandResults ?? payload.commandResults;
  expect(
    Array.isArray(commands) ? commands.length : 0,
    `${label}: simulate should include commandResults`,
  ).toBeGreaterThan(0);
}

export function assertAccountIdShape(accountId: string): void {
  expect(accountId).toMatch(/^0x[0-9a-f]{64}$/i);
}

export function assertOrderOwnedByAccount(order: OrderView, accountId: string): void {
  expect(order.accountId).toBe(accountId);
}

export function assertOrderIsOpenBet(order: OrderView, accountId: string): void {
  assertOrderOwnedByAccount(order, accountId);
  expect(order.kind).toBe("OPEN");
  expect(order.selection).toBe("YES");
  expect(order.maxSpend).toBeGreaterThan(0n);
  expect(order.minShares).toBeGreaterThan(0n);
  expect(order.priceCapBps).toBeGreaterThan(0n);
}

export function assertPositionOwnedByAccount(position: PositionView, accountId: string): void {
  expect(position.accountId).toBe(accountId);
}

export function assertPositionIsOpen(position: PositionView, accountId: string): void {
  assertPositionOwnedByAccount(position, accountId);
  expect(position.status).toBe("OPEN");
  expect(position.filledShares).toBeGreaterThan(0n);
}

export function assertPositionIsPendingClose(position: PositionView, accountId: string): void {
  assertPositionOwnedByAccount(position, accountId);
  expect(position.status).toBe("PENDING_CLOSE");
}

/** Bet market must still accept new orders (unresolved, not paused). */
export function assertMarketAcceptsBets(market: MarketView): void {
  expect(market.resolved).toBe(false);
  expect(market.paused).toBe(false);
}

export async function loadAndAssertOpenOrder(
  client: PredictClient,
  orderId: bigint,
  accountId: string,
): Promise<OrderView> {
  const order = await getOrder(client, { orderId });
  assertOrderIsOpenBet(order, accountId);
  return order;
}

export async function loadAndAssertOpenPosition(
  client: PredictClient,
  positionId: bigint,
  accountId: string,
): Promise<PositionView> {
  const position = await getPosition(client, { positionId });
  assertPositionIsOpen(position, accountId);
  return position;
}

export async function loadAndAssertPendingClosePosition(
  client: PredictClient,
  positionId: bigint,
  accountId: string,
): Promise<PositionView> {
  const position = await getPosition(client, { positionId });
  assertPositionIsPendingClose(position, accountId);
  return position;
}

export async function loadAndAssertBettingMarket(
  client: PredictClient,
  marketId: Uint8Array,
): Promise<MarketView> {
  const market = await getMarketById(client, { marketId });
  assertMarketAcceptsBets(market);
  return market;
}

/** Catalog list + detail slug alignment (API contract). */
export function assertCatalogBrowseAndDetail(
  feed: FeedBrowseListData,
  detail: MarketDetailData,
  slug: string,
  feedItem: FeedBrowseItemWire,
): void {
  assertFeedBrowseList(feed);
  assertMarketDetail(detail, slug);
  assertFeedDetailPhaseConsistent(feedItem, detail);
  assertFeedDetailRoundConsistent(feedItem, detail);
  expect(feed.items.some((i) => i.market.slug === slug)).toBe(true);
}

/** feed slug → detail → quotes for one catalog context (Bruno chain). */
export function assertCatalogApiChain(
  feedItem: FeedBrowseItemWire,
  detail: MarketDetailData,
  quotes: QuotesData,
  slug: string,
  roundId: string,
): void {
  assertCatalogBrowseAndDetail({ items: [feedItem], nextCursor: null }, detail, slug, feedItem);
  assertQuotesConsistentWithRounds(quotes, [roundId], detail.detail.round);
}

/** Auth API: list contains the chain fixture id with minimal field sanity. */
export function assertBetsMeContainsFixture(
  data: BetsMeListData,
  fixture: { orderId?: bigint; positionId?: bigint },
): BetWire {
  assertBetsMeList(data);
  const bet = findBetForChainFixture(data.bets, fixture);
  expect(bet, "bets/me should include a row for the seeded order or position").toBeDefined();
  if (bet!.selection !== undefined) {
    expect(["YES", "NO", "yes", "no"].some((s) => bet!.selection!.toUpperCase().includes(s))).toBe(
      true,
    );
  }
  if (bet!.status !== undefined) {
    expect(typeof bet!.status).toBe("string");
    expect(bet!.status!.length).toBeGreaterThan(0);
  }
  return bet!;
}

export function assertBetsSummaryLiveCount(summary: unknown): void {
  assertBetsSummary(summary);
  const live = (summary as { summary: { liveCount: number } }).summary.liveCount;
  expect(live).toBeGreaterThanOrEqual(0);
}
