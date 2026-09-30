/**
 * `deriveOracleSources` — the fed set is a property of the DEPLOYMENT, read off
 * the config that wires the rules. There is no `oracleSource` option and no
 * `ORACLE_SOURCE` env var, so there is no parser to keep in sync across repos:
 * every consumer that loads the same config gets the same fed set.
 *
 * A source is in the fed set exactly when its rule serves ≥1 ticker: Lazer's
 * set is `oracle_rules.pyth_lazer.lazer_feed_ids`, the quote-center's is
 * `oracle_rules.waterx.feeds` (optional in the document — absent reads as
 * empty, which is how a deployment turns the quote-center leg off).
 */
import { describe, expect, it } from "vitest";

import type { WaterXConfig } from "../../../src/config.ts";
import { ORACLE_SOURCES } from "../../../src/oracle/price-update-rule.ts";
import { resolveOracleRule } from "../../../src/oracle/rule-registry.ts";
import { deriveOracleSources } from "../../../src/oracle/source-list.ts";
import { MOCK_TESTNET_CONFIG } from "../../helpers/fixtures/mock-testnet-config.ts";

/** A copy of the fixture with each source's ticker set replaced. */
function configWith(wiring: {
  lazerFeedIds?: Record<string, number> | null;
  /** `null` deletes the map outright (the mainnet shape); an array sets its keys. */
  waterxFeeds?: string[] | null;
}): WaterXConfig {
  const cfg = structuredClone(MOCK_TESTNET_CONFIG);
  if (wiring.lazerFeedIds === null) delete cfg.oracle_rules.pyth_lazer;
  else if (wiring.lazerFeedIds) cfg.oracle_rules.pyth_lazer!.lazer_feed_ids = wiring.lazerFeedIds;
  if (wiring.waterxFeeds === null) delete cfg.oracle_rules.waterx.feeds;
  else if (wiring.waterxFeeds) {
    cfg.oracle_rules.waterx.feeds = Object.fromEntries(wiring.waterxFeeds.map((t) => [t, {}]));
  }
  return cfg;
}

describe("ORACLE_SOURCES", () => {
  it("is frozen at runtime — a JS consumer cannot mutate the canonical list", () => {
    expect(Object.isFrozen(ORACLE_SOURCES)).toBe(true);
  });

  it("every canonical value resolves to a REGISTERED rule — the list may never name one the registry cannot serve", () => {
    for (const source of ORACLE_SOURCES) {
      expect(() => resolveOracleRule(source)).not.toThrow();
      expect(resolveOracleRule(source).kind).toBe(source);
    }
  });
});

describe("deriveOracleSources", () => {
  it("returns every source whose rule serves at least one ticker", () => {
    expect(deriveOracleSources(MOCK_TESTNET_CONFIG)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("is order-stable in ORACLE_SOURCES order, not config key order", () => {
    // Config key order is arbitrary JSON; the fed set must not inherit it. Put
    // the quote-center's block BEFORE the Lazer block inside oracle_rules.
    const cfg = configWith({ lazerFeedIds: { BTCUSD: 1 }, waterxFeeds: ["BTCUSD"] });
    const { waterx, ...otherRules } = cfg.oracle_rules;
    const reversed = { ...cfg, oracle_rules: { waterx, ...otherRules } } as WaterXConfig;
    expect(Object.keys(reversed.oracle_rules).indexOf("waterx")).toBeLessThan(
      Object.keys(reversed.oracle_rules).indexOf("pyth_lazer"),
    );
    expect(deriveOracleSources(reversed)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("excludes a source whose ticker set is empty", () => {
    // Published-but-serving-nothing is not a source: feeding it would emit an
    // update leg that can never carry a ticker.
    expect(deriveOracleSources(configWith({ lazerFeedIds: {}, waterxFeeds: [] }))).toEqual([]);
    expect(deriveOracleSources(configWith({ lazerFeedIds: {} }))).toEqual(["waterx_rule"]);
    expect(deriveOracleSources(configWith({ waterxFeeds: [] }))).toEqual(["pyth_lazer_rule"]);
  });

  it("excludes Lazer when the deployment carries no oracle_rules.pyth_lazer block at all", () => {
    expect(deriveOracleSources(configWith({ lazerFeedIds: null }))).toEqual(["waterx_rule"]);
  });

  it("excludes the quote-center when oracle_rules.waterx carries no feeds map — the mainnet shape", () => {
    // `feeds` is optional in the document. A deployment that wants no
    // waterx_rule leg simply omits it; the `symbols` universe (still populated,
    // it names every market) is never consulted as a served set.
    const noFeeds = configWith({ waterxFeeds: null });
    expect(Object.keys(noFeeds.symbols).length).toBeGreaterThan(0);
    expect(deriveOracleSources(noFeeds)).toEqual(["pyth_lazer_rule"]);
  });

  it("drops a prediction symbol even when the feed map lists it — it would 404 the whole batch", () => {
    const withPrediction = configWith({ waterxFeeds: ["BTCUSD"] });
    withPrediction.oracle_rules.waterx.feeds!.PREDMKT = {};
    withPrediction.symbols.PREDMKT = { kind: "prediction" };
    expect(resolveOracleRule("waterx_rule").supportedTickers(withPrediction)).toEqual(["BTCUSD"]);
  });

  it("serves ONLY the listed feeds — a symbol in the universe but not in waterx.feeds is not the quote-center's", () => {
    const partial = configWith({ waterxFeeds: ["BTCUSD"] });
    expect(resolveOracleRule("waterx_rule").supportedTickers(partial)).toEqual(["BTCUSD"]);
    expect(Object.keys(partial.symbols)).toContain("ETHUSD");
  });

  it("does not consult constant_prices or a supra block — neither is a price-update SOURCE", () => {
    // constant_rule pins a price (an auxiliary feed leg, no update to fetch)
    // and the optional supra block is never read by the SDK, so neither is a
    // fed-set member even when wired.
    const auxOnly = configWith({ lazerFeedIds: {}, waterxFeeds: [] });
    auxOnly.oracle_rules.constant.constant_prices = { USDCUSD: { price: "1000000000" } };
    auxOnly.oracle_rules.supra = {
      package: "supra_rule",
      rule_config_object: "0x" + "5a".repeat(32),
      pair_ids: { BTCUSD: 18 },
    };
    expect(deriveOracleSources(auxOnly)).toEqual([]);
  });

  it("returns a fresh array — a caller mutating it cannot poison the config", () => {
    const a = deriveOracleSources(MOCK_TESTNET_CONFIG);
    a.pop();
    expect(deriveOracleSources(MOCK_TESTNET_CONFIG)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });
});
