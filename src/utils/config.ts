import { hasConfiguredOracleFeed } from "../oracle/feeds.ts";
import type { WaterXConfig } from "../perp/config.ts";

/** Returns all registered market tickers (e.g. "BTCUSD") from waterx-config. */
export function getMarketTickers(config: WaterXConfig): string[] {
  return Object.keys(config.packages.waterx_perp.markets);
}

/**
 * Returns WLP pool-token tickers the loaded config wires an oracle rule for —
 * any rule (`pyth_rule` / `pyth_lazer_rule` / `waterx_rule` / `constant_rule`),
 * not Pyth specifically, since a deployment retires rules over time and the
 * pool's collateral must keep refreshing across that.
 *
 * The filter exists because the canonical config keys `pool_tokens` by coin
 * symbol (e.g. `"USD"`) as well as by oracle ticker (e.g. `"USDCUSD"`), so a
 * naive `Object.keys(pool_tokens)` hands `refreshOraclePrices` keys no rule
 * prices. Those are dropped here rather than skipped later, so the refresh's
 * `skipped` list stays meaningful.
 */
export function getCollateralAssets(config: WaterXConfig): string[] {
  return Object.keys(config.packages.wlp.pool_tokens).filter((ticker) =>
    hasConfiguredOracleFeed(config, ticker),
  );
}
