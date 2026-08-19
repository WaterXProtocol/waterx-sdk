/**
 * `parseOracleSourceList` — the canonical ORACLE_SOURCE env parser both the
 * FE and BE fold onto. These cases mirror the two consumers' suites exactly,
 * so any drift between the three repos' parse semantics fails HERE first.
 */
import { describe, expect, it } from "vitest";

import { ORACLE_SOURCES } from "../../../src/oracle/price-update-rule.ts";
import { resolveOracleRule } from "../../../src/oracle/rule-registry.ts";
import { isOracleSource, parseOracleSourceList } from "../../../src/oracle/source-list.ts";

describe("ORACLE_SOURCES", () => {
  it("is frozen at runtime — a JS consumer cannot desync the ctor's membership check from the parser's Set", () => {
    expect(Object.isFrozen(ORACLE_SOURCES)).toBe(true);
    expect(() => (ORACLE_SOURCES as unknown as string[]).push("core")).toThrow();
  });
});

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
    expect(parseOracleSourceList("waterx_rule,")).toEqual(["waterx_rule"]);
    expect(parseOracleSourceList("pyth_lazer_rule,,waterx_rule")).toEqual([
      "pyth_lazer_rule",
      "waterx_rule",
    ]);
  });

  it("names the 5.0.0 retirement when the list still carries 'pyth_rule'", () => {
    // The operator fix (delete one list entry) is different in kind from a
    // typo'd source — the error says so, verbatim, for both consumers' boot
    // messages to surface.
    for (const raw of ["pyth_rule", "waterx_rule,pyth_rule"]) {
      expect(() => parseOracleSourceList(raw)).toThrow(
        /pyth_rule retired — remove it from ORACLE_SOURCE/,
      );
    }
    // A list without the retired value gets the plain membership error only.
    let plain: Error | undefined;
    try {
      parseOracleSourceList("chainlink");
    } catch (e) {
      plain = e as Error;
    }
    expect(plain?.message).not.toMatch(/retired/);
  });

  it("every canonical value resolves to a REGISTERED rule — the parser may never bless a value the registry cannot serve", () => {
    // The pin the union/const compile-link cannot express: DEFAULT_RULES is
    // deliberately Partial ("valid value" ≠ "implemented rule"), so a source
    // added to ORACLE_SOURCES without a registered rule would boot green at
    // parse and die at first tx-build. This loop turns that drift into a CI
    // failure instead.
    for (const source of ORACLE_SOURCES) {
      expect(() => resolveOracleRule(source)).not.toThrow();
    }
  });

  it("throws when unset, empty, or comma-only — there is NO default fed set", () => {
    for (const bad of ["", "   ", " , "]) {
      expect(() => parseOracleSourceList(bad)).toThrow(
        /ORACLE_SOURCE must be a comma-separated list/,
      );
    }
    // Both nullish forms get the operator-actionable message, never a
    // TypeError from the message branch (null arrives from
    // URLSearchParams.get-shaped feeders).
    expect(() => parseOracleSourceList(undefined)).toThrow(/unset/);
    expect(() => parseOracleSourceList(null)).toThrow(/unset/);
  });

  it("rejects Object.prototype key names — the `in`-operator hole both consumers shipped is closed here", () => {
    // 'toString' in {pyth_rule: true} === true via the prototype chain, so
    // the FE/BE Record guards passed these and died deep in the stack; the
    // Set-based check must never regress to that.
    for (const proto of ["toString", "constructor", "hasOwnProperty", "__proto__"]) {
      expect(() => parseOracleSourceList(`waterx_rule,${proto}`)).toThrow(
        /ORACLE_SOURCE must be a comma-separated list/,
      );
    }
  });

  it("throws when ANY entry is not an SDK rule value (legacy core/pro included)", () => {
    for (const bad of ["core", "pro", "pyth", "waterx", "waterx_rule,chainlink"]) {
      expect(() => parseOracleSourceList(bad)).toThrow(
        /ORACLE_SOURCE must be a comma-separated list/,
      );
    }
  });
});

describe("isOracleSource", () => {
  it("accepts exactly the ORACLE_SOURCES values, rejecting legacy names and prototype keys", () => {
    for (const source of ORACLE_SOURCES) expect(isOracleSource(source)).toBe(true);
    for (const bad of ["core", "pyth", "pyth_rule", "supra_rule", "toString", "constructor", ""]) {
      expect(isOracleSource(bad)).toBe(false);
    }
  });
});
