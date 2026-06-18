import { describe, expect, it } from "vitest";

import {
  BETS_ME_FIXTURE,
  BETS_SUMMARY_FIXTURE,
  FEED_LIST_FIXTURE,
  MARKET_DETAIL_FIXTURE,
  QUOTES_FIXTURE,
} from "../fixtures/api-wire-fixtures.ts";
import {
  assertBetDetail,
  assertBetsMeList,
  assertBetsSummary,
  assertEventDetail,
  assertFeedBrowseList,
  assertFeedDetailRoundConsistent,
  assertMarketDetail,
  assertQuotesConsistentWithRounds,
  assertQuotesMap,
  assertTxBuildResponse,
  betListIncludesOrderId,
  betListIncludesPositionId,
  betWireAwaitingBrokerFill,
  betWireBrokerFilled,
  findBetForChainFixture,
  inferMarketSegmentFromSlug,
  parseQueryLimit,
  parseQuerySegment,
  roundIdFromRound,
} from "../helpers/api-contract.ts";

describe("api-contract shape assertions", () => {
  it("parseQueryLimit and parseQuerySegment", () => {
    expect(parseQueryLimit("/predict/feed?type=crypto&limit=5")).toBe(5);
    expect(parseQuerySegment("/predict/browse?type=sport&limit=3")).toBe("sport");
  });

  it("assertFeedBrowseList accepts minimal feed fixture", () => {
    assertFeedBrowseList(FEED_LIST_FIXTURE, { limit: 5 });
    expect(() => assertFeedBrowseList({ items: [{ market: { slug: "" } }] })).toThrow();
  });

  it("assertFeedBrowseList enforces segment filter", () => {
    expect(() =>
      assertFeedBrowseList(FEED_LIST_FIXTURE, { segment: "crypto", limit: 5 }),
    ).toThrow();
    assertFeedBrowseList(
      { items: [FEED_LIST_FIXTURE.items[0]], nextCursor: null },
      { segment: "crypto", limit: 1 },
    );
  });

  it("assertMarketDetail requires slug, sides, and neighbors", () => {
    assertMarketDetail(MARKET_DETAIL_FIXTURE, "crypto-btc-updown-5m");
    expect(() => assertMarketDetail(MARKET_DETAIL_FIXTURE, "wrong-slug")).toThrow();
  });

  it("inferMarketSegmentFromSlug and feed/detail round consistency", () => {
    expect(inferMarketSegmentFromSlug("crypto-btc-updown-5m")).toBe("crypto");
    const feedItem = FEED_LIST_FIXTURE.items[0]!;
    assertFeedDetailRoundConsistent(feedItem, MARKET_DETAIL_FIXTURE);
    expect(roundIdFromRound(feedItem.round)).toBe("r1");
  });

  it("assertQuotesConsistentWithRounds", () => {
    assertQuotesConsistentWithRounds(QUOTES_FIXTURE, ["r1"], MARKET_DETAIL_FIXTURE.detail.round);
  });

  it("assertBetsMeList and betListIncludesOrderId", () => {
    assertBetsMeList(BETS_ME_FIXTURE, { limit: 5 });
    expect(betListIncludesOrderId(BETS_ME_FIXTURE.bets, 42n)).toBe(true);
    expect(betListIncludesOrderId(BETS_ME_FIXTURE.bets, 99n)).toBe(false);
  });

  it("assertBetsMeList accepts broker-unfilled outcome wire", () => {
    assertBetsMeList({
      bets: [
        {
          betId: "0xabc:order:1",
          orderId: "1",
          outcome: "unfilled",
          submissionState: "confirmed",
          placedAt: 1_706_200_000_000,
        },
      ],
    });
  });

  it("betListIncludesPositionId", () => {
    expect(betListIncludesPositionId([{ positionId: "7" }], 7n)).toBe(true);
    expect(betListIncludesPositionId([{ order_id: "42" }], 7n)).toBe(false);
  });

  it("findBetForChainFixture matches position id via orderId field", () => {
    const hit = findBetForChainFixture([{ orderId: "0" }], { positionId: 0n });
    expect(hit?.orderId).toBe("0");
  });

  it("findBetForChainFixture prefers positionId over order cursor collision", () => {
    const bets = [{ positionId: "329" }, { positionId: "123" }];
    const hit = findBetForChainFixture(bets, { orderId: 329n, positionId: 123n });
    expect(hit?.positionId).toBe("123");
  });

  it("findBetForChainFixture matches bypass wire when API positionId equals orderId", () => {
    const bets = [{ positionId: "332" }];
    const hit = findBetForChainFixture(bets, { orderId: 332n, positionId: 126n });
    expect(hit?.positionId).toBe("332");
  });

  it("betWire lifecycle helpers distinguish pending vs filled", () => {
    expect(
      betWireAwaitingBrokerFill({ outcome: "pending", submissionState: "submitting", shares: 0 }),
    ).toBe(true);
    expect(betWireBrokerFilled({ outcome: "pending", submissionState: "confirmed" })).toBe(true);
    expect(betWireAwaitingBrokerFill({ outcome: "pending", submissionState: "confirmed" })).toBe(
      false,
    );
  });

  it("assertBetsSummary", () => {
    assertBetsSummary(BETS_SUMMARY_FIXTURE);
    expect(() => assertBetsSummary({ summary: { netPnlUsd: 0 } })).toThrow();
  });

  it("assertEventDetail and assertQuotesMap", () => {
    assertEventDetail({ event: { slug: "nba-champion-2026" }, items: [] }, "nba-champion-2026");
    assertQuotesMap({});
    assertQuotesMap({ "01HZROUND1": { up: 62, down: null } });
  });

  it("assertBetDetail and assertTxBuildResponse", () => {
    assertBetDetail({ bet: { betId: "0xabc:1", orderId: "1" } });
    assertTxBuildResponse({ txBytes: "AQID", sponsored: false });
  });
});
