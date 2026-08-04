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

import type { Network } from "../constants.ts";
import { ownEntry } from "../utils/record.ts";
import type { OracleHost } from "./host.ts";
import type { OracleSource } from "./price-update-rule.ts";
import { pythCoreHermesEndpoint, pythProHermesEndpoint } from "./pyth.ts";

/**
 * One source's read plan for a requested ticker set.
 *
 * - `plane: "hermes"` (pyth sources) — price via a Hermes-compatible REST
 *   endpoint, one entry per servable ticker mapped to its HEX feed id. The
 *   endpoint to execute against is {@link resolveHermesReadEndpoint} — the
 *   plan (ids) plus that resolver (host) is the complete read contract.
 * - `plane: "quote_center"` (waterx) — price via the quote-center symbols
 *   api, keyed by ticker; served set = the `waterx_rule.feeds` block. An
 *   ABSENT block (source listed, package missing from the loaded config)
 *   serves NOTHING: claiming tickers would silently reroute reads to the
 *   quote-center — it happily serves symbols regardless of on-chain config —
 *   and swallow tickers a later-listed source could price. The
 *   misconfiguration is caught loudly by the consumer's feeds assert at
 *   client creation instead.
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
/**
 * The Hermes-compatible REST base a deployment's hermes-plane read plans
 * execute against — the endpoint half of the read contract
 * ({@link resolveOracleReadPlan} is the ids half):
 *
 * - `pyth_rule` in the fed set → the Core source's own keyless endpoint
 *   (`pythCoreHermesEndpoint(network)`).
 * - otherwise → `override` when the deployment set one (a proxy or
 *   self-hosted mirror), else the documented Pyth Pro base
 *   (`pythProHermesEndpoint()` — identical for every subscriber; auth is the
 *   caller's `pythApiKey` Bearer, not a per-deployment URL).
 *
 * Total — never throws, never falls back Core-ward: a fed set without
 * `pyth_rule` reads Pro (or the override), full stop.
 */
export function resolveHermesReadEndpoint(
  network: Network,
  sources: readonly OracleSource[],
  override?: string,
): string {
  if (sources.includes("pyth_rule")) return pythCoreHermesEndpoint(network);

  return override ?? pythProHermesEndpoint();
}

export function resolveOracleReadPlan(
  host: OracleHost,
  source: OracleSource,
  tickers: string[],
): OracleReadPlan {
  switch (source) {
    case "pyth_rule":
    case "pyth_lazer_rule": {
      // All ticker lookups go through `ownEntry` (own-keys-only): a ticker
      // named like an Object.prototype key ("toString", "constructor", …)
      // must read as not-listed, not as an inherited Function.
      const hexFeeds = host.config.packages.pyth_rule?.feeds;
      const feedIdByTicker = new Map<string, string>();
      for (const ticker of tickers) {
        const feedId = ownEntry(hexFeeds, ticker)?.feed_id;
        if (feedId !== undefined) feedIdByTicker.set(ticker, feedId);
      }
      // For pyth_rule the write and read namespaces coincide, so `unreadable`
      // is always empty; for lazer it is exactly the hex-entry gap.
      const writeFeeds =
        source === "pyth_lazer_rule" ? host.config.packages.pyth_lazer_rule?.feeds : hexFeeds;
      const unreadable = tickers.filter(
        (ticker) => ownEntry(writeFeeds, ticker) !== undefined && !feedIdByTicker.has(ticker),
      );
      return { plane: "hermes", feedIdByTicker, unreadable };
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
