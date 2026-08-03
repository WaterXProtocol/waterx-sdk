/**
 * `read-plane.ts` — per-source READ-plane resolution: which of a caller's
 * tickers a source can PRICE off-chain, and with which ids. The write plane
 * (`PriceUpdateRule` + each source's `feeds` block) and the read plane are
 * DIFFERENT namespaces for the pyth sources: Lazer WRITES with the integer
 * ids in `pyth_lazer_rule.feeds`, but every Hermes-compatible price READ is
 * keyed by the hex ids only `pyth_rule.feeds` carries. That cross-block
 * dependency is a config invariant ("a lazer-fed ticker must also carry a
 * Core hex entry to be read-visible"), and it lives HERE, once — consumers
 * (FE/BE price facades) resolve through this instead of hardcoding which
 * sources share which feeds namespace.
 */

import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";

/**
 * One source's read plan for a requested ticker set.
 *
 * - `plane: "hermes"` (pyth sources) — price via a Hermes-compatible REST
 *   endpoint, one entry per servable ticker mapped to its HEX feed id.
 * - `plane: "quote_center"` (waterx) — price via the quote-center symbols
 *   api, keyed by ticker. When the config carries NO `waterx_rule.feeds`
 *   block the plan claims every requested ticker: the deployment is
 *   misconfigured either way, and an over-asking batch fails loudly
 *   downstream instead of the gap being silently masked as "not served".
 * - `unreadable` — requested tickers this source WRITES on-chain (its update
 *   leg serves them) but its read plane cannot price: the silent-invisibility
 *   trap (e.g. a lazer-fed ticker with no `pyth_rule.feeds` hex entry).
 *   Callers should surface these loudly; empty for sources whose write and
 *   read namespaces coincide.
 */
export type OracleReadPlan = { unreadable: string[] } & (
  | { plane: "hermes"; feedIdByTicker: Map<string, string> }
  | { plane: "quote_center"; tickers: string[] }
);

/**
 * Resolve `source`'s read plan for `tickers`. Pure config lookup — no
 * network, no endpoint resolution (endpoints come from
 * `pythCoreHermesEndpoint` / `waterxQuoteCenterEndpoint` / the deployment's
 * own env). A ticker absent from the returned plan is simply not servable by
 * THIS source's read plane — callers decide how to degrade (typically: ask
 * the next source in their `ORACLE_SOURCE` list, then omit).
 */
export function resolveOracleReadPlan(
  host: OracleHost,
  source: OracleSource,
  tickers: string[],
): OracleReadPlan {
  switch (source) {
    case "pyth_rule":
    case "pyth_lazer_rule": {
      const hexFeeds = host.config.packages.pyth_rule?.feeds;
      const feedIdByTicker = new Map<string, string>();
      for (const ticker of tickers) {
        const feedId = hexFeeds?.[ticker]?.feed_id;
        if (feedId !== undefined) feedIdByTicker.set(ticker, feedId);
      }
      // For pyth_rule the write and read namespaces coincide, so `unreadable`
      // is always empty; for lazer it is exactly the hex-entry gap.
      const writeFeeds =
        source === "pyth_lazer_rule" ? host.config.packages.pyth_lazer_rule?.feeds : hexFeeds;
      const unreadable = tickers.filter(
        (ticker) => writeFeeds?.[ticker] !== undefined && !feedIdByTicker.has(ticker),
      );
      return { plane: "hermes", feedIdByTicker, unreadable };
    }
    case "waterx_rule": {
      const feeds = host.config.packages.waterx_rule?.feeds;
      return {
        plane: "quote_center",
        tickers: feeds ? tickers.filter((ticker) => ticker in feeds) : [...tickers],
        unreadable: [],
      };
    }
    default: {
      const exhausted: never = source;
      throw new Error(`resolveOracleReadPlan: unhandled OracleSource '${String(exhausted)}'`);
    }
  }
}
