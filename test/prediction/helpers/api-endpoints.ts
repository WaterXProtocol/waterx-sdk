/**
 * Predict HTTP routes — keep in sync with bucket-backend-mono:
 * - apps/waterx/src/predict/predict.controller.ts
 * - apps/waterx/src/predict/bet/bet.controller.ts
 *
 * Bruno reference: bucket-backend-mono/docs/bruno/waterx/predict/ (v2)
 */

export type MarketSegment = "crypto" | "sport" | "politics";

export interface PredictGetEndpoint {
  /** Stable id for test titles / coverage matrix. */
  id: string;
  /** Route pattern (no baseUrl). */
  path: string;
  auth: boolean;
  /** Example query string including leading `?`, or empty. */
  sampleQuery: string;
  notes?: string;
}

export interface PredictPostEndpoint {
  id: string;
  path: string;
  /** Public tx-build endpoints — no JWT; body carries accountId/sender. */
  auth: boolean;
  sampleBody: Record<string, unknown>;
  notes?: string;
}

/** All public predict catalog endpoints (no JWT). */
export const PREDICT_PUBLIC_GET_ENDPOINTS: readonly PredictGetEndpoint[] = [
  { id: "feed", path: "/predict/feed", auth: false, sampleQuery: "?limit=5" },
  { id: "feed-crypto", path: "/predict/feed", auth: false, sampleQuery: "?type=crypto&limit=5" },
  { id: "feed-sport", path: "/predict/feed", auth: false, sampleQuery: "?type=sport&limit=5" },
  { id: "browse", path: "/predict/browse", auth: false, sampleQuery: "?limit=5" },
  {
    id: "browse-sport-trending",
    path: "/predict/browse",
    auth: false,
    sampleQuery: "?type=sport&sort=trending&limit=5",
  },
  {
    id: "markets-sport-detail",
    path: "/predict/markets/sport/:slug",
    auth: false,
    sampleQuery: "",
    notes: "Slug discovered from GET /predict/feed?type=sport",
  },
  {
    id: "markets-crypto-detail",
    path: "/predict/markets/crypto/:slug",
    auth: false,
    sampleQuery: "",
    notes: "Slug from feed; optional ?epoch=<sec> (crypto only)",
  },
  {
    id: "markets-politics-detail",
    path: "/predict/markets/politics/:slug",
    auth: false,
    sampleQuery: "",
    notes: "Politics binary market; optional ?locale=zh-CN",
  },
  {
    id: "events-detail",
    path: "/predict/events/:slug",
    auth: false,
    sampleQuery: "",
    notes: "Event page — data is { event, items } without detail wrapper",
  },
  {
    id: "quotes",
    path: "/predict/quotes",
    auth: false,
    sampleQuery: "",
    notes: "Empty rounds → {}; else ?rounds=id1,id2 (max 100)",
  },
] as const;

/** Authenticated bet-history endpoints (WaterXAuthGuard). */
export const PREDICT_AUTH_GET_ENDPOINTS: readonly PredictGetEndpoint[] = [
  {
    id: "bets-me",
    path: "/predict/bets/me",
    auth: true,
    sampleQuery: "?filter=all&limit=5",
  },
  {
    id: "bets-me-summary",
    path: "/predict/bets/me/summary",
    auth: true,
    sampleQuery: "",
  },
  {
    id: "bets-me-claimable",
    path: "/predict/bets/me/claimable",
    auth: true,
    sampleQuery: "",
    notes: "Non-paginated claim batch; empty bets when no account",
  },
  {
    id: "bets-me-detail",
    path: "/predict/bets/me/:betId/detail",
    auth: true,
    sampleQuery: "",
    notes: "betId from bets/me — 404 privacy collapse on bad/missing id",
  },
] as const;

/** Unsigned PTB builders (public; client signs txBytes). */
export const PREDICT_TX_BUILD_POST_ENDPOINTS: readonly PredictPostEndpoint[] = [
  {
    id: "bets-place",
    path: "/predict/bets/place",
    auth: false,
    sampleBody: {
      accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
      marketId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      selection: "YES",
      maxSpend: "10000000",
      minShares: "1",
      priceCapBps: "5200",
      expiryTs: "1716191300000",
      sender: "0x0000000000000000000000000000000000000000000000000000000000000001",
    },
  },
  {
    id: "bets-claim",
    path: "/predict/bets/claim",
    auth: false,
    sampleBody: {
      accountId: "0xacc0000000000000000000000000000000000000000000000000000000000001",
      positionIds: ["12345"],
      sender: "0x0000000000000000000000000000000000000000000000000000000000000001",
    },
    notes: "positionIds from GET /predict/bets/me/claimable",
  },
] as const;

export const ALL_PREDICT_GET_ENDPOINTS: readonly PredictGetEndpoint[] = [
  ...PREDICT_PUBLIC_GET_ENDPOINTS,
  ...PREDICT_AUTH_GET_ENDPOINTS,
];

/** Unique GET route patterns (Bruno get-*.bru count = 11). */
export function uniquePredictGetRoutePatterns(): string[] {
  return [...new Set(ALL_PREDICT_GET_ENDPOINTS.map((e) => e.path))].sort();
}

/** All Bruno predict/*.bru routes (11 GET + 2 POST = 13). */
export function brunoPredictRouteCount(): number {
  return uniquePredictGetRoutePatterns().length + PREDICT_TX_BUILD_POST_ENDPOINTS.length;
}
