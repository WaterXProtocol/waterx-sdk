import { describe, expect, it } from "vitest";

import {
  catalogBetKey,
  catalogListPaths,
  collectCryptoExtraEpochs,
  cryptoEpochEndsAt,
  limitCatalogBetsByMarket,
  marketDetailPath,
  oddsCentsToUnfillablePriceCapBps,
  pickTradeableSides,
  type MarketDetailData,
  type TradeableCatalogMarket,
} from "../helpers/api-catalog-pure.ts";

const LIVE_ROUND_DETAIL: MarketDetailData = {
  detail: {
    market: { slug: "crypto-btc-updown-15m" },
    round: {
      phase: "live",
      sides: [
        {
          key: "up",
          oddsCents: 45,
          trade: { marketId: "0xabc", selection: "YES" },
        },
        {
          key: "down",
          oddsCents: 55,
          trade: { marketId: "0xdef", selection: "NO" },
        },
        { key: "bad", oddsCents: 50 },
      ],
    },
  },
};

describe("api-catalog-pure", () => {
  it("catalogListPaths requires browse or feed", () => {
    expect(() =>
      catalogListPaths(["crypto", "sport"], 50, { includeBrowse: false, includeFeed: false }),
    ).toThrow(/includeBrowse and includeFeed are both false/);
    expect(catalogListPaths(["crypto"], 50, { includeBrowse: false, includeFeed: true })).toEqual(
      expect.arrayContaining(["/predict/feed?limit=50", "/predict/feed?type=crypto&limit=50"]),
    );
  });

  it("pickTradeableSides returns all tradeable legs", () => {
    const sides = pickTradeableSides(LIVE_ROUND_DETAIL);
    expect(sides.map((s) => s.key)).toEqual(["up", "down"]);
  });

  it("oddsCentsToUnfillablePriceCapBps uses tight cap below quote", () => {
    expect(oddsCentsToUnfillablePriceCapBps(47)).toBe("701");
    expect(oddsCentsToUnfillablePriceCapBps(7)).toBe("699");
  });

  it("collectCryptoExtraEpochs returns upcoming endsAt epochs", () => {
    const detail: MarketDetailData = {
      detail: {
        market: { slug: "crypto-btc-updown-15m" },
        round: { startsAt: 100, endsAt: 200, phase: "live", sides: [] },
        neighbors: {
          upcoming: [
            { startsAt: 200, endsAt: 300, phase: "scheduled", sides: [] },
            { startsAt: 300, endsAt: 400, phase: "scheduled", sides: [] },
            { startsAt: 400, endsAt: 500, phase: "ended", sides: [] },
          ],
        },
      },
    };
    expect(collectCryptoExtraEpochs(detail, 2)).toEqual([300, 400]);
    expect(cryptoEpochEndsAt(detail.detail.round)).toBe(200);
  });

  it("marketDetailPath appends crypto epoch query", () => {
    expect(marketDetailPath("crypto", "crypto-btc-updown-15m", "?epoch=1781066700")).toBe(
      "/predict/markets/crypto/crypto-btc-updown-15m?epoch=1781066700",
    );
  });

  it("limitCatalogBetsByMarket treats crypto epochs as separate slots", () => {
    const bets: TradeableCatalogMarket[] = [
      {
        segment: "crypto",
        marketSlug: "crypto-btc-updown-15m",
        cryptoEpochEndsAt: 200,
        target: {
          catalog: { segment: "crypto", marketSlug: "crypto-btc-updown-15m" },
          side: { key: "up" },
          detail: LIVE_ROUND_DETAIL,
        },
      },
      {
        segment: "crypto",
        marketSlug: "crypto-btc-updown-15m",
        cryptoEpochEndsAt: 300,
        target: {
          catalog: { segment: "crypto", marketSlug: "crypto-btc-updown-15m" },
          side: { key: "up" },
          detail: LIVE_ROUND_DETAIL,
        },
      },
      {
        segment: "sport",
        marketSlug: "m2",
        target: {
          catalog: { segment: "sport", marketSlug: "m2" },
          side: { key: "teamA" },
          detail: LIVE_ROUND_DETAIL,
        },
      },
    ];
    expect(catalogBetKey(bets[0]!)).toBe("crypto-btc-updown-15m@200");
    const limited = limitCatalogBetsByMarket(bets, 2);
    expect(limited.map(catalogBetKey)).toEqual([
      "crypto-btc-updown-15m@200",
      "crypto-btc-updown-15m@300",
    ]);
  });

  it("limitCatalogBetsByMarket keeps every side for included markets", () => {
    const bets: TradeableCatalogMarket[] = [
      {
        segment: "crypto",
        marketSlug: "m1",
        target: {
          catalog: { segment: "crypto", marketSlug: "m1" },
          side: { key: "up", trade: { selection: "YES" } },
          detail: LIVE_ROUND_DETAIL,
        },
      },
      {
        segment: "crypto",
        marketSlug: "m1",
        target: {
          catalog: { segment: "crypto", marketSlug: "m1" },
          side: { key: "down", trade: { selection: "NO" } },
          detail: LIVE_ROUND_DETAIL,
        },
      },
      {
        segment: "sport",
        marketSlug: "m2",
        target: {
          catalog: { segment: "sport", marketSlug: "m2" },
          side: { key: "teamA", trade: { selection: "YES" } },
          detail: LIVE_ROUND_DETAIL,
        },
      },
    ];
    const limited = limitCatalogBetsByMarket(bets, 1);
    expect(limited).toHaveLength(2);
    expect(limited.every((b) => b.marketSlug === "m1")).toBe(true);
  });
});
