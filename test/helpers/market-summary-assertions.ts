import type { MarketData } from "@waterx/perp-sdk";
import { expect } from "vitest";

/** Testnet OI is non-deterministic; require bigint + >= 0 so missing parse fails. */
export function expectMarketOiFieldsParsed(summary: MarketData): void {
  expect(typeof summary.longOi).toBe("bigint");
  expect(typeof summary.shortOi).toBe("bigint");
  expect(summary.longOi).toBeGreaterThanOrEqual(0n);
  expect(summary.shortOi).toBeGreaterThanOrEqual(0n);
}

/**
 * v2 removed per-market `size_decimal` / `min_size` / `lot_size`. The only size-related floor is
 * `min_coll_value` (USD threshold against collateral, not position size).
 * This helper only validates parse + sane bounds.
 */
export function expectMarketSizeFieldsParsed(summary: MarketData): void {
  expect(typeof summary.minCollValue).toBe("bigint");
  expect(summary.minCollValue).toBeGreaterThanOrEqual(0n);
}

/**
 * Open-path `err_invalid_size` is reachable in v2 only when `min_coll_value > 0` (checked against
 * collateral USD value, not against size).
 */
export function openInvalidSizeAbortPossible(minCollValue: bigint): boolean {
  return minCollValue > 0n;
}
