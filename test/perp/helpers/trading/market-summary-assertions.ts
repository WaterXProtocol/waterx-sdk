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
 * SDK `MarketData` exposes `minCollValue` (USD collateral floor) but not on-chain `min_size` /
 * `lot_size` (still enforced in `trading.move` on position size). This helper only validates
 * `minCollValue` parse + bounds.
 */
export function expectMarketSizeFieldsParsed(summary: MarketData): void {
  expect(typeof summary.minCollValue).toBe("bigint");
  expect(summary.minCollValue).toBeGreaterThanOrEqual(0n);
}

/**
 * When `min_coll_value > 0`, tiny collateral can abort `err_invalid_size` via the collateral
 * leg; undersized **position size** vs `min_size`/`lot_size` is a separate on-chain check.
 */
export function openInvalidSizeAbortPossible(minCollValue: bigint): boolean {
  return minCollValue > 0n;
}
