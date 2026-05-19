import type { WaterXConfig } from "../config.ts";

/** Returns all registered market tickers (e.g. "BTCUSD") from waterx-config. */
export function getMarketTickers(config: WaterXConfig): string[] {
  return Object.keys(config.packages.waterx_perp.markets);
}

/** Returns all collateral asset tickers (WLP pool tokens) from waterx-config. */
export function getCollateralAssets(config: WaterXConfig): string[] {
  return Object.keys(config.packages.wlp.pool_tokens);
}
