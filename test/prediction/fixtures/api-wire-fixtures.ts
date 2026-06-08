/** Minimal wire payloads for offline `api-contract` unit tests (not live API snapshots). */

import type {
  BetsSummaryData,
  FeedBrowseListData,
  MarketDetailData,
} from "../helpers/api-contract.ts";
import type { BetsMeListData } from "../helpers/api-wire.ts";

export const FEED_LIST_FIXTURE: FeedBrowseListData = {
  items: [
    {
      market: {
        id: "m1",
        slug: "crypto-btc-updown-5m",
        type: "crypto-updown",
        display: { kind: "crypto", symbol: "BTC" },
      },
      round: {
        id: "r1",
        marketId: "m1",
        startsAt: 1_700_000_000,
        endsAt: 1_700_000_300,
        phase: "live",
        sides: [
          { key: "up", oddsCents: 52 },
          { key: "down", oddsCents: 48 },
        ],
        volumeUsd: 1000,
        chart: { kind: "price", series: [] },
      },
    },
    {
      market: {
        id: "m2",
        slug: "sport-lakers-win",
        type: "sport-match",
        display: { kind: "sport", league: "NBA" },
      },
      nextRound: {
        id: "r2",
        marketId: "m2",
        startsAt: 1_700_000_100,
        endsAt: 1_700_003_700,
        phase: "upcoming",
        sides: [
          { key: "teamA", oddsCents: 45 },
          { key: "teamB", oddsCents: 55 },
        ],
        volumeUsd: 500,
        chart: { kind: "probability", series: [] },
      },
    },
  ],
  nextCursor: null,
};

export const MARKET_DETAIL_FIXTURE: MarketDetailData = {
  detail: {
    market: {
      id: "m1",
      slug: "crypto-btc-updown-5m",
      type: "crypto-updown",
      display: { kind: "crypto", symbol: "BTC" },
    },
    round: {
      id: "r1",
      marketId: "m1",
      startsAt: 1_700_000_000,
      endsAt: 1_700_000_300,
      phase: "live",
      sides: [
        { key: "up", oddsCents: 52, trade: { marketId: "0xabc", selection: "YES" } },
        { key: "down", oddsCents: 48, trade: { marketId: "0xabc", selection: "NO" } },
      ],
      volumeUsd: 1000,
      chart: { kind: "price", series: [] },
    },
    neighbors: { past: [], upcoming: [] },
    marketStats: { volumeUsd: 1000, snapshotAt: 1_700_000_000 },
    outcomes: [{ id: "yes" }, { id: "no" }],
  },
};

export const BETS_ME_FIXTURE: BetsMeListData = {
  bets: [
    {
      betId: "bet-1",
      marketId: "m2",
      roundId: "r2",
      orderId: "42",
      positionId: "42",
      side: "teamA",
      lockedOddsCents: 45,
      stake: { amountUsd: 100, token: "USDC" },
      placedAt: 1_706_200_000_000,
      outcome: "pending",
      submissionState: "confirmed",
      cardSnapshot: { kind: "sport", status: "live" },
      marketSlug: "sport-lakers-win",
    },
  ],
  nextCursor: null,
};

export const BETS_SUMMARY_FIXTURE: BetsSummaryData = {
  summary: {
    netPnlUsd: 0,
    wonCount: 0,
    lostCount: 0,
    liveCount: 1,
  },
};

export const QUOTES_FIXTURE = {
  r1: { up: 52, down: 48 },
} as const;
