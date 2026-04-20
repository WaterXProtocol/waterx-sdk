/**
 * Market creation parameters for all supported assets (v2 schema).
 * Passed to `trading::create_market` via admin setup scripts.
 *
 * Size is Float (1e9-scaled u128) internally; there is no `size_decimal` or `lot_size` in v2.
 * `min_coll_value` is a 1e9-scaled USD floor (e.g. 10_000_000_000 = $10).
 * `max_long_oi` / `max_short_oi` are u128 scaled values converted to Float on-chain via
 * `float::from_scaled_val`.
 */

import type { BaseAsset } from "../src/constants.ts";

export interface MarketParams {
  maxLeverageBps: number;
  /** Minimum collateral USD value (1e9-scaled u64). */
  minCollValue: bigint;
  tradingFeeBps: number;
  maintenanceMarginBps: number;
  /** 1e9-scaled u128 — max long OI (base-token units × 1e9). */
  maxLongOi: bigint;
  maxShortOi: bigint;
  cooldownMs: number;
  basicFundingRateBps: number;
  fundingIntervalMs: number;
}

const DEFAULT_OI_CAP = 100_000_000_000_000n;
const DEFAULT_MIN_COLL_VALUE = 10_000_000_000n; // $10

function crypto(maxLeverageBps: number, overrides: Partial<MarketParams> = {}): MarketParams {
  return {
    maxLeverageBps,
    minCollValue: DEFAULT_MIN_COLL_VALUE,
    tradingFeeBps: 3,
    maintenanceMarginBps: 150,
    maxLongOi: DEFAULT_OI_CAP,
    maxShortOi: DEFAULT_OI_CAP,
    cooldownMs: 0,
    basicFundingRateBps: 1,
    fundingIntervalMs: 3_600_000,
    ...overrides,
  };
}

export const MARKET_DEFINITIONS: Record<BaseAsset, MarketParams> = {
  // Crypto
  BTC: crypto(500_000),
  ETH: crypto(500_000),
  SOL: crypto(500_000),
  SUI: crypto(500_000),
  DEEP: crypto(500_000),
  WAL: crypto(500_000),
  // xStock (cash-equities — tighter leverage by default)
  AAPLX: crypto(100_000),
  GOOGLX: crypto(100_000),
  METAX: crypto(100_000),
  NVDAX: crypto(100_000),
  QQQX: crypto(100_000),
  SPYX: crypto(100_000),
  TSLAX: crypto(100_000),
};
