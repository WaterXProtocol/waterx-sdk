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
import { ownEntry } from "../utils/record.ts";

/** Tickers with an `oracle_rules.pyth_lazer.lazer_feed_ids` entry. */
export function lazerServedTickers(config: WaterXConfig): string[] {
  return Object.keys(config.oracle_rules.pyth_lazer?.lazer_feed_ids ?? {});
}

/**
 * The quote-center's declared feed map, `oracle_rules.waterx.feeds` — optional
 * in the document, and THE one place its path is spelled: the served set below,
 * the fetch partition (`pullWaterxData`) and the read plane
 * (`resolveOracleReadPlan`) all read it through here, so "which tickers does
 * the quote-center serve" has one definition. Membership checks pass the
 * result to `ownEntry` as-is (it takes an absent record); only a key listing
 * needs the `?? {}`.
 */
export function waterxFeeds(config: WaterXConfig): WaterXConfig["oracle_rules"]["waterx"]["feeds"] {
  // `?.` like the Lazer sibling above: the block is schema-required, so a
  // parsed document always carries it — but hand-built hosts (this SDK's own
  // partial test hosts, and a consumer's fixtures) omit it, and an absent rule
  // block must read as "serves nothing", never throw.
  return config.oracle_rules.waterx?.feeds;
}

/**
 * THE predicate: does the quote-center serve `ticker` in this deployment?
 *
 * Every waterx path asks through here — the served set below, the fetch
 * partition (`pullWaterxData`) and the read plane (`resolveOracleReadPlan`) —
 * so "listed" cannot mean one thing when a leg is WIRED and another when it is
 * READ or FETCHED. Two conditions, and both have to hold:
 *
 * 1. `oracle_rules.waterx.feeds` names it. `ownEntry` is own-keys-only (never
 *    the `in` operator or a bare bracket read), so a prototype-key ticker
 *    ("toString") reads as unlisted instead of poisoning a batch.
 * 2. `symbols` names it, with a kind this plane prices. `prediction` symbols
 *    live in the same universe but are not priced here, and a key absent from
 *    `symbols` altogether is a feed list that drifted from the document it is
 *    supposed to be a subset of. Either one 404s the WHOLE batch at the
 *    quote-center, so both must fail CLOSED — and the check has to be a
 *    positive test for a present entry, not `?.kind !== "prediction"`, which
 *    an absent entry also satisfies.
 *
 * The config repo's CI enforces `feeds ⊆ symbols`, but the PARSER does not
 * (`feeds` is an unconstrained record), so a hand-built or custom document
 * reaches here unvalidated. This is where that relationship is enforced.
 */
export function waterxServes(config: WaterXConfig, ticker: string): boolean {
  if (ownEntry(waterxFeeds(config), ticker) === undefined) return false;
  const symbol = ownEntry(config.symbols, ticker);
  return symbol !== undefined && symbol.kind !== "prediction";
}

/**
 * Tickers with an `oracle_rules.waterx.feeds` entry — the quote-center's feed
 * list, declared per rule exactly like Lazer's. The `symbols` universe is NOT
 * consulted as a SERVED SET: a symbol builds a `waterx_rule` leg (and a
 * quote-center fetch) iff the deployment lists it here, so a document with no
 * `feeds` map (or an empty one) takes the quote-center out of the fed set
 * entirely. It IS consulted for the prediction exclusion — see
 * [`waterxServes`], which this is the list form of.
 */
export function waterxServedTickers(config: WaterXConfig): string[] {
  return Object.keys(waterxFeeds(config) ?? {}).filter((symbol) => waterxServes(config, symbol));
}
