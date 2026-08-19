import type { WaterXConfig } from "../perp/config.ts";
import { ownEntry } from "./record.ts";

/** Returns all registered market tickers (e.g. "BTCUSD") from waterx-config. */
export function getMarketTickers(config: WaterXConfig): string[] {
  return Object.keys(config.packages.waterx_perp.markets);
}

/**
 * Returns WLP pool-token tickers that some live oracle rule can actually
 * price — i.e. keys with a feeds entry under `constant_rule`,
 * `pyth_lazer_rule`, or `waterx_rule`. Some configs key `pool_tokens` by coin
 * symbol (e.g. `"USD"`) rather than oracle ticker (e.g. `"USDCUSD"`), so a
 * naive `Object.keys(pool_tokens)` blows up at `refreshOraclePrices` for any
 * key no rule serves. Filter so the auto-refresh path stays tolerant.
 */
export function getCollateralAssets(config: WaterXConfig): string[] {
  const packages = config.packages;
  const served = (ticker: string): boolean =>
    ownEntry(packages.constant_rule?.feeds, ticker) !== undefined ||
    ownEntry(packages.pyth_lazer_rule?.feeds, ticker) !== undefined ||
    ownEntry(packages.waterx_rule?.feeds, ticker) !== undefined;
  return Object.keys(packages.wlp.pool_tokens).filter(served);
}
