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
 * Every rule `ticker` has a **usable** `feeds` entry for, in PTB-leg order.
 * Empty ⇒ the config wires no price for this ticker at all.
 *
 * Every rule is checked ALL-OR-NOTHING: a `feeds` entry only counts when that
 * rule's package + shared objects are also present, because `loadConfig`
 * deliberately validates no optional rule block. A realistic rollout JSON
 * lists feeds before every object id lands, and a feeds-only check would call
 * the ticker usable right up until the builder died on a missing
 * `published_at` / `config` / `state` / `enclave_*`. The required fields per
 * rule are exactly what each rule's PTB leg dereferences:
 *
 * - `pyth_lazer_rule` → `published_at`, `config`, `state` (`feedLazerRule` +
 *   the network's verify entry).
 * - `waterx_rule` → `published_at`, `config`, `enclave_config`, `enclave`
 *   (`collect_single_with_proof` / `collect_batch_latest`).
 * - `constant_rule` → `published_at`, `config` (`feedConstantRule`), the
 *   guard `PerpConfigView.isConstantTicker` already applied.
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
  const lazer = packages.pyth_lazer_rule;
  if (
    lazer?.published_at &&
    lazer.config &&
    lazer.state &&
    ownEntry(lazer.feeds, ticker) !== undefined
  ) {
    rules.push("pyth_lazer_rule");
  }
  const waterx = packages.waterx_rule;
  if (
    waterx?.published_at &&
    waterx.config &&
    waterx.enclave_config &&
    waterx.enclave &&
    ownEntry(waterx.feeds, ticker) !== undefined
  ) {
    rules.push("waterx_rule");
  }
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
