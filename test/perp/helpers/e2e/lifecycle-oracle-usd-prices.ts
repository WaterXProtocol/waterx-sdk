/**
 * Process-wide USD hints for lifecycle helpers (v3).
 *
 * E2e setup must **not** batch-simulate legacy bucket aggregators — oracle freshness is per-PTB via Pyth.
 */

import type { PerpClient } from "@waterx/sdk";

import { getUsdHintForTicker, hintBasePriceUsdForTicker } from "./oracle-pyth-context.ts";

const tickerPriceCache = new Map<string, number>();

/** Offline seed for integration workers (no RPC). */
export function seedLifecycleApproxPricesForUnitTests(): void {
  tickerPriceCache.clear();
}

export function primeLifecycleOracleUsdPrices(_client: PerpClient): void {
  seedLifecycleApproxPricesForUnitTests();
}

export function getCachedOracleUsdPriceForTicker(ticker: string): number {
  const hit = tickerPriceCache.get(ticker);
  if (hit !== undefined) return hit;
  const v = getUsdHintForTicker(ticker);
  tickerPriceCache.set(ticker, v);
  return v;
}

/** @deprecated Use {@link getCachedOracleUsdPriceForTicker}. */
export function getCachedOracleUsdPriceForBase(base: string): number {
  return getCachedOracleUsdPriceForTicker(base.endsWith("USD") ? base : `${base}USD`);
}

export async function getOracleUsdPriceForTicker(
  client: PerpClient,
  ticker: string,
): Promise<number> {
  void client;
  return getCachedOracleUsdPriceForTicker(ticker);
}

/** Integer USD for view reads. */
export function lifecycleHintBasePriceUsd(ticker: string): bigint {
  return hintBasePriceUsdForTicker(ticker);
}
