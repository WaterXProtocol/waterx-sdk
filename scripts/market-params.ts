/**
 * Market creation parameters for all supported assets (v2 schema).
 * Passed to `trading::create_market` via admin setup scripts.
 *
 * Size is Float (1e9-scaled u128) internally; there is no `size_decimal` or `lot_size` in v2.
 * `min_coll_value` is a 1e9-scaled USD floor (e.g. 10_000_000_000 = $10).
 * `max_long_oi` / `max_short_oi` are u128 scaled values converted to Float on-chain via
 * `float::from_scaled_val`.
 */

import type { LegacyBaseAsset } from "../src/constants.ts";

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

/**
 * Legacy market definitions for the original 13 markets. Keyed by
 * `LegacyBaseAsset`; the 200K-tier batch lives in `MARKETS_200K_DEFINITIONS`
 * below (different fee / funding / cooldown profile).
 */
export const MARKET_DEFINITIONS: Record<LegacyBaseAsset, MarketParams> = {
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

/**
 * 200K-tier batch markets sourced from `scripts/markets-200k-0.csv`.
 * Used by `scripts/create-markets.ts` to create the new HYPE / XRP / BNB / ZEC /
 * MSTRX / COINX / HOODX / CRCLX / NFLXX / XAUT / XAG / WTI / BRENT / EURUSD /
 * USDJPY markets in one PTB.
 *
 * CSV defaults applied to every entry: minCollValue=$3, tradingFeeBps=10,
 * cooldownMs=5000, basicFundingRateBps=7, fundingIntervalMs=3_600_000.
 * `maxLongOi` / `maxShortOi` are CSV base-token counts × 1e9 (Float scale).
 */
export interface BatchMarketEntry {
  symbol: string;
  params: MarketParams;
}

const BATCH_MIN_COLL_VALUE = 3_000_000_000n; // $3
const FLOAT_SCALE_BIG = 1_000_000_000n;
const oi = (units: number) => BigInt(units) * FLOAT_SCALE_BIG;

function batchEntry(
  symbol: string,
  maxLeverageBps: number,
  maintenanceMarginBps: number,
  oiUnits: number,
): BatchMarketEntry {
  return {
    symbol,
    params: {
      maxLeverageBps,
      minCollValue: BATCH_MIN_COLL_VALUE,
      tradingFeeBps: 10,
      maintenanceMarginBps,
      maxLongOi: oi(oiUnits),
      maxShortOi: oi(oiUnits),
      cooldownMs: 5000,
      basicFundingRateBps: 7,
      fundingIntervalMs: 3_600_000,
    },
  };
}

export const MARKETS_200K_DEFINITIONS: BatchMarketEntry[] = [
  // Crypto
  batchEntry("HYPE", 250_000, 100, 400),
  batchEntry("XRP", 200_000, 250, 4_000),
  batchEntry("BNB", 250_000, 100, 5),
  batchEntry("ZEC", 200_000, 250, 30),
  // xStock (cash-equities)
  batchEntry("MSTRX", 100_000, 500, 30),
  batchEntry("COINX", 100_000, 500, 20),
  batchEntry("HOODX", 100_000, 500, 60),
  batchEntry("CRCLX", 100_000, 500, 50),
  batchEntry("NFLXX", 100_000, 500, 5),
  // Commodities
  batchEntry("XAUT", 300_000, 50, 5),
  batchEntry("XAG", 200_000, 250, 250),
  batchEntry("WTI", 150_000, 300, 350),
  batchEntry("BRENT", 150_000, 300, 200),
  // FX
  batchEntry("EURUSD", 500_000, 50, 3_000),
  batchEntry("USDJPY", 500_000, 50, 30),
];
