/**
 * `read-plane.ts` — per-source READ-plane resolution: which of a caller's
 * tickers a source can PRICE off-chain, and with which ids. Every source
 * reads through ITS OWN feeds namespace — `pyth_lazer_rule` via its integer
 * ids on the Lazer HTTP API, `waterx_rule` via its tickers on the
 * quote-center — so a source's write set and read set coincide by
 * construction. (Until 5.0.0 Lazer reads borrowed `pyth_rule.feeds` hex ids
 * on a Hermes-compatible endpoint; that cross-block dependency, the whole
 * hermes plane, and the `unreadable` diagnostic are gone with the `pyth_rule`
 * retirement.) Consumers (FE/BE price facades) resolve through this instead
 * of hardcoding feed namespaces, and execute plans via the sibling
 * `read-prices.ts` executors.
 */

import { ownEntry } from "../utils/record.ts";
import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";

/**
 * One source's read plan for a requested ticker set.
 *
 * - `plane: "lazer"` (`pyth_lazer_rule`) — price via the Lazer HTTP API
 *   (`readLazerPrices` in `read-prices.ts`), one entry per servable ticker
 *   mapped to its INTEGER Lazer feed id from `pyth_lazer_rule.feeds`. Auth is
 *   the caller's `pythApiKey` Bearer; the endpoint is `LAZER_INFRA`'s own.
 * - `plane: "quote_center"` (`waterx_rule`) — price via the quote-center
 *   (`readQuoteCenterPrices` in `read-prices.ts`), keyed by ticker; served
 *   set = the `waterx_rule.feeds` block. An ABSENT block (source listed,
 *   package missing from the loaded config) serves NOTHING: claiming tickers
 *   would silently reroute reads to the quote-center — it happily serves
 *   symbols regardless of on-chain config — and swallow tickers a
 *   later-listed source could price. The misconfiguration is caught loudly by
 *   `assertOracleWriteCoverage` (`validate.ts`) at client creation instead.
 *
 * A ticker absent from a plan is simply not servable by THIS source's read
 * plane — callers decide how to degrade (typically: ask the next source in
 * their fed set, then omit). Because every source reads its own
 * feeds, write set == read set — there is no separate read-coverage
 * diagnostic to carry.
 */
export type OracleReadPlan =
  | { plane: "lazer"; feedIdByTicker: Map<string, number> }
  | { plane: "quote_center"; tickers: string[] };

/** The tickers a resolved plan can actually serve, regardless of plane. */
export function readPlanTickers(plan: OracleReadPlan): string[] {
  return plan.plane === "quote_center" ? plan.tickers : [...plan.feedIdByTicker.keys()];
}

/**
 * Resolve `source`'s read plan for `tickers`. Pure config lookup — no
 * network, no endpoint resolution (endpoints come from `LAZER_INFRA` /
 * `waterxQuoteCenterEndpoint` / the deployment's own env).
 */
export function resolveOracleReadPlan(
  host: OracleHost,
  source: OracleSource,
  tickers: string[],
): OracleReadPlan {
  switch (source) {
    case "pyth_lazer_rule": {
      // Lazer reads through its OWN integer ids — the same
      // `pyth_lazer_rule.feeds` entries its write leg uses — so the read set
      // is exactly the write set. All ticker lookups go through `ownEntry`
      // (own-keys-only): a ticker named like an Object.prototype key
      // ("toString", "constructor", …) must read as not-listed, not as an
      // inherited Function.
      const feeds = host.config.packages.pyth_lazer_rule?.feeds;
      const feedIdByTicker = new Map<string, number>();
      for (const ticker of tickers) {
        const feedId = ownEntry(feeds, ticker);
        if (feedId !== undefined) feedIdByTicker.set(ticker, feedId);
      }
      return { plane: "lazer", feedIdByTicker };
    }
    case "waterx_rule": {
      // Absent feeds block ⇒ serves nothing (see the OracleReadPlan doc) —
      // never claim tickers the config doesn't name. `ownEntry` (own-keys-
      // only, never the `in` operator or a bare bracket read) so a
      // prototype-key ticker can't count as feeds-listed and poison the
      // quote-center batch (which 404s whole batches on unknown symbols).
      const feeds = host.config.packages.waterx_rule?.feeds;
      return {
        plane: "quote_center",
        tickers: tickers.filter((ticker) => ownEntry(feeds, ticker) !== undefined),
      };
    }
    default: {
      const exhausted: never = source;
      throw new Error(`resolveOracleReadPlan: unhandled OracleSource '${String(exhausted)}'`);
    }
  }
}
