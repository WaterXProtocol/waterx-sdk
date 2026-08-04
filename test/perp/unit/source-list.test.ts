/**
 * `parseOracleSourceList` — the canonical ORACLE_SOURCE env parser both the
 * FE and BE fold onto. These cases mirror the two consumers' suites exactly,
 * so any drift between the three repos' parse semantics fails HERE first.
 */
import { describe, expect, it } from "vitest";

import { ORACLE_SOURCES } from "../../../src/oracle/price-update-rule.ts";
import { parseOracleSourceList } from "../../../src/oracle/source-list.ts";

describe("parseOracleSourceList", () => {
  it("a single value parses as a one-element list", () => {
    for (const source of ORACLE_SOURCES) {
      expect(parseOracleSourceList(source)).toEqual([source]);
    }
  });

  it("parses a comma list preserving order, trimming whitespace, deduping", () => {
    expect(parseOracleSourceList("waterx_rule, pyth_lazer_rule ,waterx_rule")).toEqual([
      "waterx_rule",
      "pyth_lazer_rule",
    ]);
  });

  it("drops empty entries (trailing/doubled commas) — the most common env typo, never a boot failure", () => {
    expect(parseOracleSourceList("pyth_rule,")).toEqual(["pyth_rule"]);
    expect(parseOracleSourceList("pyth_rule,,waterx_rule")).toEqual(["pyth_rule", "waterx_rule"]);
  });

  it("throws when unset, empty, or comma-only — there is NO default fed set", () => {
    for (const bad of [undefined, "", "   ", " , "]) {
      expect(() => parseOracleSourceList(bad)).toThrow(
        /ORACLE_SOURCE must be a comma-separated list/,
      );
    }
    expect(() => parseOracleSourceList(undefined)).toThrow(/unset/);
  });

  it("throws when ANY entry is not an SDK rule value (legacy core/pro included)", () => {
    for (const bad of ["core", "pro", "pyth", "waterx", "pyth_rule,chainlink"]) {
      expect(() => parseOracleSourceList(bad)).toThrow(
        /ORACLE_SOURCE must be a comma-separated list/,
      );
    }
  });
});
