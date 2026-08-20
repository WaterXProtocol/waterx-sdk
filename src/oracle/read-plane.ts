/**
 * `read-plane.ts` — per-source READ-plane resolution: which of a caller's
 * tickers a source can PRICE off-chain, and with which ids. Consumers (FE/BE
 * price facades) resolve through this instead of hardcoding a source's feeds
 * namespace.
 *
 * Since Pyth Core was removed there is exactly ONE read plane left, the
 * quote-center, and the write/read namespaces of every remaining source are no
 * longer split: `waterx_rule` reads and writes the same `feeds` block.
 *
 * `pyth_lazer_rule` has NO read plane. It writes with the integer ids in
 * `pyth_lazer_rule.feeds`, and every Hermes-compatible price READ used to be
 * keyed by the hex ids only `pyth_rule.feeds` carried — that block is gone with
 * Core, so a lazer-served ticker is write-only and reports as `unreadable`
 * here. A deployment that needs those prices off-chain reads them from the
 * quote-center (list `waterx_rule` alongside lazer; on mainnet its feed set is
 * a superset of lazer's) or from its own price source outside the SDK.
 */

import { ownEntry } from "../utils/record.ts";
import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";

/**
 * One source's read plan for a requested ticker set.
 *
 * - `plane: "quote_center"` (waterx) — price via the quote-center symbols
 *   api, keyed by ticker; served set = the `waterx_rule.feeds` block. An
 *   ABSENT block (source listed, package missing from the loaded config)
 *   serves NOTHING: claiming tickers would silently reroute reads to the
 *   quote-center — it happily serves symbols regardless of on-chain config —
 *   and swallow tickers a later-listed source could price.
 * - `plane: "none"` (lazer) — this source has no off-chain read plane at all;
 *   every requested ticker it WRITES lands in `unreadable`.
 * - `unreadable` — requested tickers this source writes on-chain (its update
 *   leg serves them) but whose price it cannot read off-chain. Callers should
 *   surface these loudly rather than silently dropping the ticker from a
 *   price response; empty for sources whose write and read namespaces
 *   coincide.
 */
export type OracleReadPlan = { unreadable: string[] } & (
  | { plane: "quote_center"; tickers: string[] }
  | { plane: "none" }
);

/**
 * Resolve `source`'s read plan for `tickers`. Pure config lookup — no
 * network, no endpoint resolution (the quote-center host comes from
 * `waterxQuoteCenterEndpoint(network)` or the deployment's own override). A
 * ticker absent from the returned plan is simply not servable by THIS
 * source's read plane — callers decide how to degrade (typically: ask the
 * next source in their `ORACLE_SOURCE` list, then omit).
 */
export function resolveOracleReadPlan(
  host: OracleHost,
  source: OracleSource,
  tickers: string[],
): OracleReadPlan {
  switch (source) {
    case "pyth_lazer_rule": {
      // Write-only since Core's hex feed ids left the config. Report exactly
      // the tickers lazer writes as unreadable, so a consumer sees "lazer
      // cannot price these" instead of an empty, silently-wrong plan.
      const writeFeeds = host.config.packages.pyth_lazer_rule?.feeds;
      return {
        plane: "none",
        unreadable: tickers.filter((ticker) => ownEntry(writeFeeds, ticker) !== undefined),
      };
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
        unreadable: [],
      };
    }
    default: {
      const exhausted: never = source;
      throw new Error(`resolveOracleReadPlan: unhandled OracleSource '${String(exhausted)}'`);
    }
  }
}
