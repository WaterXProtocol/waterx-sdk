import { getMarketSummary, type WaterXClient } from "@waterx/perp-sdk";
import { expect } from "vitest";

import type { BaseAsset } from "../../src/constants.ts";
import { computeLeverageDerivedSize } from "./compute-leverage-size.ts";

/**
 * Asserts `computeLeverageDerivedSize` (mirror of `buildOpenPositionTx` when `size` is omitted)
 * produces a positive size for the market.
 *
 * v2 removed `min_size` and `lot_size`; the only size-related floor is `min_coll_value`
 * (USD threshold), which is enforced on-chain against collateral value, not position size.
 * We still sanity-check the derivation returns a non-zero size.
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
