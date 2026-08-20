/**
 * `feeds.ts` — THE config-only answer to "which oracle rules is this ticker
 * wired for?". Pure lookups over the loaded `waterx-config` packages: no
 * client, no network, no `oracleSource` fed set.
 *
 * This is the read that makes the SDK **config-driven** rather than
 * config-asserting. Every rule block is optional — a deployment retires a rule
 * by dropping its block (or emptying its `feeds`) and the SDK simply stops
 * emitting that rule's legs. Nothing in the SDK may require a particular rule
 * to be present: `refreshOraclePrices` builds the legs a ticker HAS and skips
 * a ticker that has none, and `getCollateralAssets` filters the WLP pool the
 * same way.
 *
 * Note the difference from the fed set (`OracleHost.oracleSources`): this says
 * what the CONFIG wires, the fed set says which sources this client actually
 * fetches + pushes prices for. A ticker can be config-wired for a rule that is
 * not in the fed set — the collector still gets that rule's (read-only,
 * possibly abstaining) feed leg, which is what keeps `EMissingPriceSource`
 * away while a weight migration is in flight.
 */

import { ownEntry } from "../utils/record.ts";
import type { OracleConfig } from "./config.ts";

/**
 * The rules {@link configuredOracleRules} can report. A subset of the on-chain
 * rule set: `supra_rule` is deliberately absent because it never stands alone
 * — `maybeFeedSupra` rides an already-fed collector (see `aggregateTicker`),
 * so it can never be the reason a ticker is priceable.
 */
export type ConfiguredOracleRule = "pyth_lazer_rule" | "waterx_rule" | "constant_rule";

/**
 * Every rule `ticker` has a `feeds` entry for, in PTB-leg order. Empty ⇒ the
 * config wires no price for this ticker at all.
 *
 * `constant_rule` is all-or-nothing, mirroring `PerpConfigView.isConstantTicker`:
 * a `feeds` entry listed before the rule is deployed (`published_at` + `config`)
 * would otherwise claim a leg `feedConstantRule` cannot build.
 */
export function configuredOracleRules(
  config: OracleConfig,
  ticker: string,
): ConfiguredOracleRule[] {
  const packages = config.packages;
  const rules: ConfiguredOracleRule[] = [];
  // `ownEntry` (own-keys-only) everywhere: a ticker named like an
  // Object.prototype key ("toString", "constructor", …) must read as
  // not-listed, never as an inherited Function.
  if (ownEntry(packages.pyth_lazer_rule?.feeds, ticker) !== undefined) {
    rules.push("pyth_lazer_rule");
  }
  if (ownEntry(packages.waterx_rule?.feeds, ticker) !== undefined) rules.push("waterx_rule");
  const constant = packages.constant_rule;
  if (constant?.published_at && constant.config && ownEntry(constant.feeds, ticker) !== undefined) {
    rules.push("constant_rule");
  }
  return rules;
}

/** True when the config wires at least one rule for `ticker`. */
export function hasConfiguredOracleFeed(config: OracleConfig, ticker: string): boolean {
  return configuredOracleRules(config, ticker).length > 0;
}
