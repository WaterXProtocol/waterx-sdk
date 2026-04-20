/**
 * Integration testnet market snapshot: one `getMarketSummary` per base per run, plus shared sizing
 * helpers so `lotSize` / `minSize` track the published `Market` without duplicating logic.
 */
import type { WaterXClient } from "../../../src/client.ts";
import type { BaseAsset } from "../../../src/constants.ts";
import { getMarketSummary } from "../../../src/fetch.ts";
import type { MarketData } from "../../../src/view-types.ts";

export type IntegrationMarketSnapshotMap = Record<BaseAsset, MarketData>;

/**
 * Fetches `view::market_summary` for each base (sequential — avoids gRPC burst).
 */
export async function fetchIntegrationMarketSummaries(
  client: WaterXClient,
  bases: readonly BaseAsset[],
): Promise<IntegrationMarketSnapshotMap> {
  const out = {} as Partial<IntegrationMarketSnapshotMap>;
  for (const base of bases) {
    const entry = client.getMarketEntry(base);
    out[base] = await getMarketSummary(client, entry.marketId, entry.baseType);
  }
  return out as IntegrationMarketSnapshotMap;
}

/** Throws if snapshot is not usable for trading-style integration tests (no vitest dependency). */
export function assertMarketSnapshotTradeable(snap: MarketData, label = "market"): void {
  if (!snap.isActive) throw new Error(`${label}: market inactive`);
  // v2 removed `lot_size` / `min_size`. `min_coll_value` is a USD floor, not a size floor.
}

/**
 * v2: size is no longer lot-aligned or `min_size`-floored — return the requested size unchanged.
 * Kept as a no-op for call-site compatibility with legacy integration configs.
 */
export function alignPositionSizeToMarket(size: bigint, _lot?: bigint, _min?: bigint): bigint {
  return size;
}
