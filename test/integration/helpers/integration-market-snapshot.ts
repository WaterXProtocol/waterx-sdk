/**
 * Integration testnet market snapshot: one `getMarketSummary` per base per run.
 * Note: SDK `MarketData` omits on-chain `min_size` / `lot_size`; e2e uses
 * `getMarketTradingSizeConstraints` (gRPC object JSON) when sizing opens/decreases.
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
}

/**
 * Legacy no-op. On-chain trading still lot-aligns / min-floors **position size**; use
 * `alignExplicitTradingSize` + `getMarketTradingSizeConstraints` in tests.
 */
export function alignPositionSizeToMarket(size: bigint, _lot?: bigint, _min?: bigint): bigint {
  return size;
}
