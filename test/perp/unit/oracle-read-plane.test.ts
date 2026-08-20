/**
 * `resolveOracleReadPlan` — the per-source READ-plane resolver. Since Pyth Core
 * was removed there is one plane left (the quote-center) and one write-only
 * source: `pyth_lazer_rule` pushes prices on-chain with integer feed ids but
 * has no off-chain read surface, so every ticker it writes must be reported
 * `unreadable` rather than silently omitted.
 */
import { describe, expect, it } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { resolveOracleReadPlan } from "../../../src/oracle/read-plane.ts";

function hostWith(packages: Record<string, unknown>): OracleHost {
  return { config: { packages } } as unknown as OracleHost;
}

describe("resolveOracleReadPlan", () => {
  it("pyth_lazer_rule: write-only — every ticker it writes comes back unreadable", () => {
    // The Core-retirement consequence: the update leg serves these tickers
    // fine, but the hex feed ids every Hermes-compatible read needed lived in
    // `pyth_rule.feeds`, which is gone. The plan must surface the gap so a
    // price facade fails loudly instead of omitting a price.
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1, ETHUSD: 2 } } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "ETHUSD", "XAUUSD"]);

    expect(plan.plane).toBe("none");
    // XAUUSD is not lazer-written at all, so it is simply not this source's
    // business — only the tickers lazer DOES write are reported unreadable.
    expect(plan.unreadable).toEqual(["BTCUSD", "ETHUSD"]);
  });

  it("pyth_lazer_rule: an absent feeds block writes nothing, so nothing is unreadable", () => {
    const plan = resolveOracleReadPlan(hostWith({}), "pyth_lazer_rule", ["BTCUSD"]);

    expect(plan).toEqual({ plane: "none", unreadable: [] });
  });

  it("pyth_lazer_rule: an Object.prototype key name is NOT feeds-listed — no bracket-walk hole", () => {
    // `writeFeeds?.[ticker]` walked the prototype chain exactly like `in`:
    // feeds["toString"] is an inherited Function (≠ undefined), so a
    // prototype-key ticker was classified `unreadable`. Own-key lookups must
    // read it as simply not-listed.
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1 } } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", [
      "BTCUSD",
      "toString",
      "constructor",
    ]);

    expect(plan.unreadable).toEqual(["BTCUSD"]);
  });

  it("waterx_rule: serves exactly the feeds-listed tickers", () => {
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: { ticker: "XAUUSD" } } } });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "EURUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"], unreadable: [] });
  });

  it("waterx_rule: an Object.prototype key name is NOT feeds-listed — `in`-operator hole closed", () => {
    // 'toString' in feeds === true via the prototype chain; a ticker named
    // like a prototype key must not be sent to the quote-center (whole-batch
    // 404 on unknown symbols).
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: { ticker: "XAUUSD" } } } });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "toString"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"], unreadable: [] });
  });

  it("waterx_rule: an absent feeds block serves NOTHING — never a silent quote-center takeover", () => {
    // Claiming unlisted tickers would reroute every read to the quote-center
    // (it serves symbols regardless of on-chain config) and swallow tickers a
    // later-listed source could price.
    const plan = resolveOracleReadPlan(hostWith({}), "waterx_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: [], unreadable: [] });
  });
});
