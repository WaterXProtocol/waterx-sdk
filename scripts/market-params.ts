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

/**
 * Build a {@link MarketParams} row with arbitrary fields for per-network
 * manifests (testnet / mainnet). All networks currently share
 * `cooldownMs=0` / `basicFundingRateBps=1` / `fundingIntervalMs=1h`.
 */
function market(params: {
  maxLeverageBps: number;
  tradingFeeBps: number;
  maintenanceMarginBps: number;
  minCollValue: bigint;
  maxLongOi: bigint;
  maxShortOi: bigint;
}): MarketParams {
  return {
    ...params,
    cooldownMs: 0,
    basicFundingRateBps: 1,
    fundingIntervalMs: 3_600_000,
  };
}

/**
 * **Testnet** manifest — snapshot of `getMarketSummary` on the testnet
 * deployment. Source of truth for `scripts/create-markets.ts` (testnet
 * deployer) and `trader-market-onchain-config` (testnet config parity check).
 * Also exported as {@link MARKET_DEFINITIONS} for back-compat.
 *
 * Update procedure: run a full-params probe against testnet and copy values
 * here if an intentional on-chain config change has been made.
 */
export const TESTNET_MARKET_DEFINITIONS: Record<BaseAsset, MarketParams> = {
  BTC: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 10_000_000_000n,
    maxShortOi: 90_000_000n,
  }),
  ETH: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 240_000_000_000n,
    maxShortOi: 240_000_000_000n,
  }),
  SOL: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 6_300_000_000_000n,
    maxShortOi: 6_300_000_000_000n,
  }),
  SUI: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 1_000_000_000_000_000n,
    maxShortOi: 1_000_000_000_000_000n,
  }),
  DEEP: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 25,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 180_000_000_000n,
    maxShortOi: 180_000_000_000n,
  }),
  WAL: market({
    maxLeverageBps: 500_000,
    tradingFeeBps: 25,
    maintenanceMarginBps: 150,
    minCollValue: 90_000_000n,
    maxLongOi: 150_000_000_000_000n,
    maxShortOi: 150_000_000_000_000n,
  }),
  AAPLX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 4_000_000_000_000n,
    maxShortOi: 4_000_000_000_000n,
  }),
  GOOGLX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 3_500_000_000_000n,
    maxShortOi: 3_500_000_000_000n,
  }),
  METAX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 1_600_000_000_000n,
    maxShortOi: 1_600_000_000_000n,
  }),
  NVDAX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 6_000_000_000_000n,
    maxShortOi: 6_000_000_000_000n,
  }),
  QQQX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 1_700_000_000_000n,
    maxShortOi: 1_700_000_000_000n,
  }),
  SPYX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 1_500_000_000_000n,
    maxShortOi: 1_500_000_000_000n,
  }),
  TSLAX: market({
    maxLeverageBps: 100_000,
    tradingFeeBps: 10,
    maintenanceMarginBps: 500,
    minCollValue: 90_000_000n,
    maxLongOi: 2_700_000_000_000n,
    maxShortOi: 2_700_000_000_000n,
  }),
};

/**
 * Back-compat alias: `create-markets.ts` (testnet deployer) and the testnet
 * integration config-parity test both consume the testnet manifest.
 *
 * Mainnet e2e simulate does **not** compare against a static manifest; it reads
 * `getMarketSummary` and asserts on-chain invariants only.
 */
export const MARKET_DEFINITIONS = TESTNET_MARKET_DEFINITIONS;
