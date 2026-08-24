/**
 * `deriveOracleSources` — the fed set is a property of the DEPLOYMENT, read off
 * the config that wires the rules. There is no `oracleSource` option and no
 * `ORACLE_SOURCE` env var, so there is no parser to keep in sync across repos:
 * every consumer that loads the same config gets the same fed set.
 */
import { describe, expect, it } from "vitest";

import type { OracleConfig } from "../../../src/oracle/config.ts";
import { ORACLE_SOURCES } from "../../../src/oracle/price-update-rule.ts";
import { resolveOracleRule } from "../../../src/oracle/rule-registry.ts";
import { deriveOracleSources } from "../../../src/oracle/source-list.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

/** A config carrying exactly the given rule blocks, each with one feed. */
function configWith(blocks: Record<string, unknown>): OracleConfig {
  return { packages: blocks } as unknown as OracleConfig;
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
  it("returns every source with a published package AND a non-empty feeds map", () => {
    expect(deriveOracleSources(MOCK_TESTNET_CONFIG)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("is order-stable in ORACLE_SOURCES order, not config key order", () => {
    // Config key order is arbitrary JSON; the fed set must not inherit it.
    const reversed = configWith({
      waterx_rule: { published_at: "0x2", feeds: { BTCUSD: {} } },
      pyth_lazer_rule: { published_at: "0x1", feeds: { BTCUSD: 1 } },
    });
    expect(deriveOracleSources(reversed)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("excludes a published source whose feeds map is empty or absent", () => {
    // Published-but-serving-nothing is not a source: feeding it would emit an
    // update leg that can never carry a ticker.
    expect(
      deriveOracleSources(
        configWith({
          pyth_lazer_rule: { published_at: "0x1", feeds: {} },
          waterx_rule: { published_at: "0x2" },
        }),
      ),
    ).toEqual([]);
  });

  it("excludes a source with feeds but no published package", () => {
    expect(deriveOracleSources(configWith({ waterx_rule: { feeds: { BTCUSD: {} } } }))).toEqual([]);
  });

  it("honours an explicit `enabled: false`, and treats absent as ON", () => {
    // With routing derived from config, this flag is the only lever an
    // operator has for switching a source off; ignoring it made it a dead
    // knob. Absent means ON — every live config omits it.
    const off = configWith({
      pyth_lazer_rule: { published_at: "0x1", feeds: { BTCUSD: 1 }, enabled: false },
      waterx_rule: { published_at: "0x2", feeds: { BTCUSD: {} } },
    });
    expect(deriveOracleSources(off)).toEqual(["waterx_rule"]);

    const on = configWith({
      pyth_lazer_rule: { published_at: "0x1", feeds: { BTCUSD: 1 }, enabled: true },
      waterx_rule: { published_at: "0x2", feeds: { BTCUSD: {} } },
    });
    expect(deriveOracleSources(on)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });

  it("IGNORES retired rule blocks — they are still in the live configs", () => {
    // `pyth_rule` and `pyth_sponsor_rule` remain in prod mainnet.json today.
    // Neither is an ORACLE_SOURCES member (no rule module could feed one), so
    // their presence can never put them in a fed set.
    const withRetired = configWith({
      pyth_rule: { published_at: "0xdead", feeds: { BTCUSD: {} } },
      pyth_sponsor_rule: { published_at: "0xbeef" },
      waterx_rule: { published_at: "0x2", feeds: { BTCUSD: {} } },
    });
    expect(deriveOracleSources(withRetired)).toEqual(["waterx_rule"]);
  });

  it("does not consult constant_rule or supra_rule — neither is a price-update SOURCE", () => {
    // They are feed helpers: constant_rule pins a price and supra_rule is an
    // auxiliary leg. Neither has an update to fetch, so neither is a fed-set
    // member even when wired.
    const auxOnly = configWith({
      constant_rule: { published_at: "0x3", feeds: { USDCUSD: { price: "1000000000" } } },
      supra_rule: { published_at: "0x4", feeds: { BTCUSD: {} } },
    });
    expect(deriveOracleSources(auxOnly)).toEqual([]);
  });

  it("returns a fresh array — a caller mutating it cannot poison the config", () => {
    const a = deriveOracleSources(MOCK_TESTNET_CONFIG);
    a.pop();
    expect(deriveOracleSources(MOCK_TESTNET_CONFIG)).toEqual(["pyth_lazer_rule", "waterx_rule"]);
  });
});
