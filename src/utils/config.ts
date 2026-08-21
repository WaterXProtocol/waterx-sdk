import type { WaterXConfig } from "../perp/config.ts";

/** Returns all registered market tickers (e.g. "BTCUSD") from waterx-config. */
export function getMarketTickers(config: WaterXConfig): string[] {
  return Object.keys(config.packages.waterx_perp.markets);
}

// "Which WLP pool tokens can this deployment PRICE" is an oracle-coverage
// question, not a config read: it depends on the client's fed set, not just
// the JSON. It lives on `PerpClient.pricedPoolTickers()` (over
// `oracle/validate.ts`'s `servableTickers`) — `utils/` is the shared base and
// must not import `oracle/`.
