import type { WaterXConfig } from "../config.ts";

/** Returns all registered market tickers (e.g. "BTCUSD") from waterx-config. */
export function getMarketTickers(config: WaterXConfig): string[] {
  return Object.keys(config.packages.waterx_perp.markets);
}

/**
 * Returns WLP pool-token tickers that also have a registered pyth_rule feed —
 * the canonical testnet config keys `pool_tokens` by coin symbol (e.g. `"USD"`)
 * while `pyth_rule.feeds` is keyed by oracle ticker (e.g. `"USDCUSD"`), so a
 * naive `Object.keys(pool_tokens)` blows up at `refreshOraclePrices` for any
 * key without a feed. Filter so the auto-refresh path stays tolerant.
 */
export function getCollateralAssets(config: WaterXConfig): string[] {
  const feeds = config.packages.pyth_rule?.feeds ?? {};
  return Object.keys(config.packages.wlp.pool_tokens).filter((t) => feeds[t] !== undefined);
}
