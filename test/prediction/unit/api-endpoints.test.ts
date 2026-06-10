import { describe, expect, it } from "vitest";

import {
  ALL_PREDICT_GET_ENDPOINTS,
  brunoPredictRouteCount,
  PREDICT_BETS_GET_ENDPOINTS,
  PREDICT_PUBLIC_GET_ENDPOINTS,
  PREDICT_TX_BUILD_POST_ENDPOINTS,
  uniquePredictGetRoutePatterns,
} from "../helpers/api-endpoints.ts";

describe("api-endpoints catalog", () => {
  it("covers all 13 Bruno predict/*.bru routes (11 GET + 2 POST)", () => {
    expect(brunoPredictRouteCount()).toBe(13);
    expect(uniquePredictGetRoutePatterns()).toEqual([
      "/predict/bets/me",
      "/predict/bets/me/:betId/detail",
      "/predict/bets/me/claimable",
      "/predict/bets/me/summary",
      "/predict/browse",
      "/predict/events/:slug",
      "/predict/feed",
      "/predict/markets/crypto/:slug",
      "/predict/markets/politics/:slug",
      "/predict/markets/sport/:slug",
      "/predict/quotes",
    ]);
    expect(PREDICT_TX_BUILD_POST_ENDPOINTS.map((e) => e.path)).toEqual([
      "/predict/bets/place",
      "/predict/bets/claim",
    ]);
  });

  it("marks auth vs public endpoints", () => {
    expect(PREDICT_PUBLIC_GET_ENDPOINTS.every((e) => !e.auth)).toBe(true);
    expect(PREDICT_BETS_GET_ENDPOINTS.every((e) => !e.auth)).toBe(true);
    expect(PREDICT_TX_BUILD_POST_ENDPOINTS.every((e) => !e.auth)).toBe(true);
  });

  it("lists sample queries for static GET smoke", () => {
    const staticGets = ALL_PREDICT_GET_ENDPOINTS.filter((e) => !e.path.includes(":"));
    expect(staticGets.length).toBeGreaterThanOrEqual(5);
  });
});
