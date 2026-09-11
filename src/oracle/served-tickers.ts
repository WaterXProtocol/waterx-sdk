/**
 * Which tickers each price-update source serves, read straight from the
 * deployment document.
 *
 * Lives apart from the rule modules so `deriveOracleSources` can keep its
 * documented promise — "pure and config-only, callable before a client exists"
 * — without dragging in the rule registry and its generated Move bindings (and
 * the bundle weight that follows). The rules import these too, so the fed set
 * and per-ticker routing still share ONE definition; that agreement is the
 * invariant, not the file boundary.
 */

import type { WaterXConfig } from "../config.ts";

/** Tickers with an `oracle_rules.pyth_lazer.lazer_feed_ids` entry. */
export function lazerServedTickers(config: WaterXConfig): string[] {
  return Object.keys(config.oracle_rules.pyth_lazer?.lazer_feed_ids ?? {});
}

/**
 * Tickers the quote-center serves: the `symbols` universe, minus kinds that are
 * never a perp oracle ticker. `prediction` symbols live in the same map but are
 * not priced through this plane, and asking for one 404s the whole batch.
 */
export function waterxServedTickers(config: WaterXConfig): string[] {
  return Object.entries(config.symbols)
    .filter(([, meta]) => meta.kind !== "prediction")
    .map(([symbol]) => symbol);
}
