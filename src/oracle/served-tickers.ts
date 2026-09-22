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
 * Tickers with an `oracle_rules.waterx.feeds` entry — the quote-center's feed
 * list, declared per rule exactly like Lazer's. The `symbols` universe is NOT
 * consulted: a symbol builds a `waterx_rule` leg (and a quote-center fetch)
 * iff the deployment lists it here, so a document with no `feeds` map (or an
 * empty one) takes the quote-center out of the fed set entirely.
 */
export function waterxServedTickers(config: WaterXConfig): string[] {
  return Object.keys(config.oracle_rules.waterx.feeds ?? {});
}
