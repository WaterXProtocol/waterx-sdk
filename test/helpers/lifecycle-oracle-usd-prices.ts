import type { WaterXClient } from "@waterx/perp-sdk";

import type { BaseAsset } from "../../src/constants.ts";
import { activeLifecycleTestBases } from "./lifecycle-test-markets.ts";
import { fetchSimulatedUsdPricesForBases } from "./oracle-simulate-multi-asset.ts";

const basePriceCache = new Map<BaseAsset, number>();

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
  basePriceCache.set(base, v);
  return v;
}

/** All lifecycle bases; fills cache per asset on first access. */
export async function getLifecycleOracleUsdPrices(
  client: WaterXClient,
): Promise<Record<BaseAsset, number>> {
  const bases = activeLifecycleTestBases();
  const out = {} as Record<BaseAsset, number>;
  for (const b of bases) {
    out[b] = await getOracleUsdPriceForBase(client, b);
  }
  return out;
}

export function resetLifecycleOracleUsdPricesCache(): void {
  basePriceCache.clear();
}
