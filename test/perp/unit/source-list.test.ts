/**
 * `deriveOracleSources` — the fed set is a property of the DEPLOYMENT, read off
 * the config that wires the rules. There is no `oracleSource` option and no
 * `ORACLE_SOURCE` env var, so there is no parser to keep in sync across repos:
 * every consumer that loads the same config gets the same fed set.
 *
 * A source is in the fed set exactly when its rule serves ≥1 ticker: Lazer's
 * set is `oracle_rules.pyth_lazer.lazer_feed_ids`, the quote-center's is the
 * `symbols` universe (its `oracle_rules.waterx` block is schema-required, so
 * the universe is the only thing that can be empty).
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
  symbols?: string[];
}): WaterXConfig {
  const cfg = structuredClone(MOCK_TESTNET_CONFIG);
  if (wiring.lazerFeedIds === null) delete cfg.oracle_rules.pyth_lazer;
  else if (wiring.lazerFeedIds) cfg.oracle_rules.pyth_lazer!.lazer_feed_ids = wiring.lazerFeedIds;
  if (wiring.symbols) {
    cfg.symbols = Object.fromEntries(wiring.symbols.map((t) => [t, { kind: "perp" as const }]));
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
    // the quote-center's universe (`symbols`) BEFORE the Lazer block.
    const { symbols, ...rest } = configWith({ lazerFeedIds: { BTCUSD: 1 }, symbols: ["BTCUSD"] });
    const reversed = { symbols, ...rest } as WaterXConfig;
    expect(Object.keys(reversed).indexOf("symbols")).toBeLessThan(
      Object.keys(reversed).indexOf("oracle_rules"),
    );
    expect(deriveOracleSources(reversed)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("excludes a source whose ticker set is empty", () => {
    // Published-but-serving-nothing is not a source: feeding it would emit an
    // update leg that can never carry a ticker.
    expect(deriveOracleSources(configWith({ lazerFeedIds: {}, symbols: [] }))).toEqual([]);
    expect(deriveOracleSources(configWith({ lazerFeedIds: {} }))).toEqual(["waterx_rule"]);
    expect(deriveOracleSources(configWith({ symbols: [] }))).toEqual(["pyth_lazer_rule"]);
  });

  it("excludes Lazer when the deployment carries no oracle_rules.pyth_lazer block at all", () => {
    expect(deriveOracleSources(configWith({ lazerFeedIds: null }))).toEqual(["waterx_rule"]);
  });

  it("IGNORES the retired oracle_rules.pyth block — it is still in the live configs", () => {
    // Pyth Core's block is schema-required and remains published. `pyth_rule`
    // is not an ORACLE_SOURCES member (no rule module could feed it), so a
    // populated feed map can never put it in a fed set.
    const withRetired = configWith({ lazerFeedIds: {}, symbols: ["BTCUSD"] });
    withRetired.oracle_rules.pyth.pyth_price_feeds = {
      BTCUSD: { feed_id: "0x" + "ef".repeat(32), price_info_object: "0x" + "01".repeat(32) },
    };
    expect(deriveOracleSources(withRetired)).toEqual(["waterx_rule"]);
  });

  it("does not consult constant_prices or a supra block — neither is a price-update SOURCE", () => {
    // constant_rule pins a price (an auxiliary feed leg, no update to fetch)
    // and the optional supra block is never read by the SDK, so neither is a
    // fed-set member even when wired.
    const auxOnly = configWith({ lazerFeedIds: {}, symbols: [] });
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
