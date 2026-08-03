/**
 * Test-local leverage → explicit-size convention for e2e/integration flows.
 * NOT a mirror of any SDK path: the SDK's implicit auto-sizing was removed in
 * WL-1932 (order placement takes an explicit `size`); this helper only derives
 * the explicit size tests pass, as collateral × leverage / approxPrice.
 * Pair with `fetchSimulatedUsdPricesForBases` / `getLifecycleOracleUsdPrices` for `approxPrice`
 * (see `oracle-simulate-multi-asset.ts`, `e2e-open-sizing-expect.ts`).
 */
export interface ComputeLeverageSizeOptions {
  collateralAmount: bigint | number;
  leverage: number;
  approxPrice: number;
  /** Ignored — kept only so older test call sites compile. */
  lotSize?: number;
  /** Ignored — the contract validates min_size on-chain. Kept so older test call sites compile. */
  minSize?: number;
}

export function computeLeverageDerivedSize(opts: ComputeLeverageSizeOptions): bigint {
  if (!Number.isFinite(opts.approxPrice) || opts.approxPrice <= 0) {
    throw new Error(
      `computeLeverageDerivedSize: invalid approxPrice=${opts.approxPrice} (oracle resolve returned non-finite / <= 0).`,
    );
  }
  if (!Number.isFinite(opts.leverage) || opts.leverage <= 0) {
    throw new Error(
      `computeLeverageDerivedSize: invalid leverage=${opts.leverage} (expected > 0).`,
    );
  }
  const collUsd = Number(opts.collateralAmount) / 1_000_000;
  const sizeRaw = Math.floor(((collUsd * opts.leverage) / opts.approxPrice) * 1_000_000);
  if (!Number.isFinite(sizeRaw)) {
    throw new Error(
      `computeLeverageDerivedSize: non-finite sizeRaw (coll=${collUsd}, lev=${opts.leverage}, price=${opts.approxPrice}).`,
    );
  }
  return BigInt(sizeRaw - (sizeRaw > 1000 ? sizeRaw % 1000 : 0));
}
