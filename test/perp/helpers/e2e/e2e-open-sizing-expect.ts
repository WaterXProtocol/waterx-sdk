import { getMarketSummary, type WaterXClient } from "@waterx/sdk";
import { expect } from "vitest";

import type { BaseAsset } from "../../../../src/constants.ts";
import { computeLeverageDerivedSize } from "../trading/compute-leverage-size.ts";

/**
 * Asserts `computeLeverageDerivedSize` (mirror of `buildOpenPositionTx` when `size` is omitted)
 * produces a positive size for the market.
 *
 * On-chain `open` / `increase` / `decrease` still enforce `lot_size` alignment and `min_size`
 * on the **position size** field (see `trading.move`). `min_coll_value` is a separate USD
 * floor on collateral. Explicit-size simulates should use `alignExplicitTradingSize` /
 * `computeValidPartialDecreaseSize` from `market-trading-size-constraints.ts` when needed.
 */
export async function expectLeverageOpenSizingVsMarket(
  client: WaterXClient,
  base: BaseAsset,
  collateralRaw: bigint,
  leverage: number,
  oracleUsdPerBase: number,
): Promise<void> {
  const entry = client.getMarketEntry(base);
  // Market summary still fetched to ensure the market exists and is readable.
  await getMarketSummary(client, entry.marketId, entry.baseType);
  const derived = computeLeverageDerivedSize({
    collateralAmount: collateralRaw,
    leverage,
    approxPrice: oracleUsdPerBase,
  });
  expect(derived, `${base}: leverage-sized raw > 0`).toBeGreaterThan(0n);
}
