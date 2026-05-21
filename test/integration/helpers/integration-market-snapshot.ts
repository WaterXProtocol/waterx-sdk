/**
 * Integration market snapshot via v3 view `MarketData`.
 */
import type { WaterXClient } from "../../../src/client.ts";
import type { MarketDataView } from "../../../src/fetch.ts";
import { getMarketData } from "../../../src/fetch.ts";
import type { LifecycleTestTickerRow } from "../../helpers/e2e/lifecycle-test-markets.ts";
import { lifecycleTickerRow } from "../../helpers/e2e/lifecycle-test-markets.ts";
import { rawPrice } from "../../../src/utils/math.ts";

export type IntegrationMarketSnapshotMap = Record<string, MarketDataView>;

/** One `MarketData` per ticker (sequential RPC). */
export async function fetchIntegrationMarketSummaries(
  client: WaterXClient,
  tickers: readonly string[],
): Promise<IntegrationMarketSnapshotMap> {
  const out: Record<string, MarketDataView> = {};
  for (const ticker of tickers) {
    void client.getMarket(ticker);
    out[ticker] = await getMarketData(client, { ticker });
  }
  return out;
}

/** @deprecated Prefer {@link assertMarketTickerTradeableSnapshot}. */
export function assertMarketSnapshotTradeable(snap: MarketDataView, label = "market"): void {
  assertMarketTickerTradeableSnapshot(snap, label);
}

/** Throw if inactive (no Vitest). */
export function assertMarketTickerTradeableSnapshot(snap: MarketDataView, label = "market"): void {
  const raw = snap as Record<string, unknown>;
  const active = raw.is_active ?? raw.isActive;
  if (active === false) {
    throw new Error(`${label}: market inactive`);
  }
}

/** @deprecated Prefer static sizes from lifecycle table (`e2ePtb`). */
export function alignPositionSizeToMarket(size: bigint): bigint {
  return size;
}

export function tickerRowApproxAcceptableUsdHint(row: LifecycleTestTickerRow): bigint {
  return BigInt(Math.max(1, Math.ceil(row.approxUsdHint * 4)));
}

/**
 * Keeper / market-form **open** slippage limit (`trading::assert_open_slippage`):
 * - **LONG**: ceiling — execution price must be `<= acceptablePrice` (use a high USD cap).
 * - **SHORT**: floor — execution price must be `>= acceptablePrice` (use a low USD floor).
 */
export function keeperOpenAcceptablePrice(isLong: boolean, row: LifecycleTestTickerRow): bigint {
  if (isLong) {
    return rawPrice(Math.max(200_000, Number(tickerRowApproxAcceptableUsdHint(row))));
  }
  return rawPrice(1);
}
