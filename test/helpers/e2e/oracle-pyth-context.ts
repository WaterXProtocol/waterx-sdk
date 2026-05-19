/**
 * v3 e2e: USD hints for `waterx_perp_view` reads (`basePriceUsd`, etc.).
 * No bucket-aggregator simulate — real oracle refresh happens inside `build*Tx`.
 */

import type { WaterXClient } from "../../../src/client.ts";

const TICKER_USD_FALLBACK: Record<string, number> = {
  BTCUSD: 95_000,
  ETHUSD: 3500,
  SOLUSD: 140,
  SUIUSD: 2,
  DEEPUSD: 0.12,
  USDCUSD: 1,
};

/** Integer USD suitable for view helpers expecting plain USD magnitude (not Float-scale). */
export function hintBasePriceUsdForTicker(ticker: string): bigint {
  const usd = getUsdHintForTicker(ticker);
  return BigInt(Math.max(1, Math.round(usd)));
}

export function getUsdHintForTicker(ticker: string): number {
  const hit = TICKER_USD_FALLBACK[ticker];
  if (hit !== undefined && hit > 0) return hit;
  return 1;
}

export function hintCollateralUsdForTicker(client: WaterXClient, collateralTicker: string): bigint {
  if (!collateralTicker) return 1n;
  void client;
  return hintBasePriceUsdForTicker(collateralTicker);
}
