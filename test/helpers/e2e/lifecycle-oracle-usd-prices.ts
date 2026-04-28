import type { WaterXClient } from "@waterx/perp-sdk";

import type { BaseAsset } from "../../../src/constants.ts";
import { fetchSimulatedUsdPricesForBases } from "./oracle-simulate-multi-asset.ts";

const basePriceCache = new Map<BaseAsset, number>();

let warnedPrimeFallback = false;

/**
 * Former table `approxPrice` values — only for {@link seedLifecycleApproxPricesForUnitTests}
 * or emergency offline use; e2e/integration should call {@link primeLifecycleOracleUsdPrices}.
 */
const BASE_LIFECYCLE_ORACLE_USD_PRICE_FALLBACKS: Partial<Record<BaseAsset, number>> = {
  BTC: 100_000,
  ETH: 3800,
  SUI: 1,
  SOL: 180,
  WAL: 0.45,
  DEEP: 0.12,
  AAPLX: 200,
  GOOGLX: 170,
  METAX: 600,
  NVDAX: 130,
  QQQX: 490,
  SPYX: 560,
  TSLAX: 250,
};

/** Offline / unit helpers: populate {@link basePriceCache} without RPC. */
export function seedLifecycleApproxPricesForUnitTests(): void {
  for (const [b, v] of Object.entries(BASE_LIFECYCLE_ORACLE_USD_PRICE_FALLBACKS)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      basePriceCache.set(b as BaseAsset, v);
    }
  }
}

/**
 * One `simulateTransaction` per base (feeds + aggregate only for that token).
 * Avoids a single huge PTB that can hit `err_total_weight_not_enough` on testnet.
 */
export async function getOracleUsdPriceForBase(
  client: WaterXClient,
  base: BaseAsset,
): Promise<number> {
  const hit = basePriceCache.get(base);
  if (hit !== undefined) return hit;
  const row = await fetchSimulatedUsdPricesForBases(client, [base]);
  const v = row[base];
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`getOracleUsdPriceForBase: missing or invalid simulated USD for ${base}`);
  }
  basePriceCache.set(base, v);
  return v;
}

/** All lifecycle bases; fills cache per asset on first access. */
export async function getLifecycleOracleUsdPrices(
  client: WaterXClient,
): Promise<Record<BaseAsset, number>> {
  const { activeLifecycleTestBases } = await import("./lifecycle-test-markets.ts");
  const bases = activeLifecycleTestBases();
  const out = {} as Record<BaseAsset, number>;
  for (const b of bases) {
    out[b] = await getOracleUsdPriceForBase(client, b);
  }
  return out;
}

/**
 * Populate the process-wide oracle USD cache for every {@link activeLifecycleTestBases} entry.
 * Vitest e2e + integration-trader setup files call this before tests load.
 */
export async function primeLifecycleOracleUsdPrices(client: WaterXClient): Promise<void> {
  const { activeLifecycleTestBases } = await import("./lifecycle-test-markets.ts");
  const bases = activeLifecycleTestBases();
  if (bases.length === 0) return;
  const prices = await fetchSimulatedUsdPricesForBases(client, bases);
  const missing: BaseAsset[] = [];
  for (const b of bases) {
    const v = prices[b];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      basePriceCache.set(b, v);
    } else {
      missing.push(b);
    }
  }
  const stillMissing: BaseAsset[] = [];
  for (const b of missing) {
    const fb = BASE_LIFECYCLE_ORACLE_USD_PRICE_FALLBACKS[b];
    if (typeof fb === "number" && Number.isFinite(fb) && fb > 0) {
      basePriceCache.set(b, fb);
    } else {
      stillMissing.push(b);
    }
  }
  if (stillMissing.length > 0) {
    throw new Error(
      `primeLifecycleOracleUsdPrices: no simulated USD and no table fallback for: ${stillMissing.join(", ")}`,
    );
  }
  if (missing.length > 0 && !warnedPrimeFallback) {
    warnedPrimeFallback = true;
    console.warn(
      `[waterx-sdk] primeLifecycleOracleUsdPrices: batch simulate missed ${missing.join(", ")}; using table fallbacks for lifecycleRow approxPrice.`,
    );
  }
}

/**
 * Synchronous read of prices primed by {@link primeLifecycleOracleUsdPrices}.
 * Used by {@link lifecycleRow} to attach `approxPrice` without async plumbing in table-driven tests.
 */
export function getCachedOracleUsdPriceForBase(base: BaseAsset): number {
  const hit = basePriceCache.get(base);
  if (hit === undefined) {
    throw new Error(
      `Oracle USD cache miss for ${base}. Ensure Vitest setupFiles run primeLifecycleOracleUsdPrices(client), or call seedLifecycleApproxPricesForUnitTests() for offline tests.`,
    );
  }
  return hit;
}

export function resetLifecycleOracleUsdPricesCache(): void {
  basePriceCache.clear();
}
