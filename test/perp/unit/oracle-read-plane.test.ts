/**
 * `resolveOracleReadPlan` — the per-source READ-plane resolver (5.0.0 two-arm
 * shape): integer Lazer ids from `pyth_lazer_rule.feeds`, the waterx
 * served-set contract, and `readPlanTickers` over both planes. Every source
 * reads its OWN feeds namespace, so write set == read set by construction —
 * there is no hermes plane, no endpoint resolver, and no `unreadable`
 * diagnostic anymore.
 */
import { describe, expect, it } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { readPlanTickers, resolveOracleReadPlan } from "../../../src/oracle/read-plane.ts";

function hostWith(packages: Record<string, unknown>): OracleHost {
  return { config: { packages } } as unknown as OracleHost;
}

describe("resolveOracleReadPlan", () => {
  it("pyth_lazer_rule: maps servable tickers to their own INTEGER Lazer ids", () => {
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1, ETHUSD: 2 } } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "ETHUSD", "XAUUSD"]);

    expect(plan.plane).toBe("lazer");
    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker]).toEqual([
      ["BTCUSD", 1],
      ["ETHUSD", 2],
    ]);
  });

  it("pyth_lazer_rule: a ticker outside the feeds block is simply absent from the plan", () => {
    // No `unreadable` diagnostic — write set == read set, so a ticker the
    // source can't read is exactly a ticker it can't write; callers degrade
    // by asking the next source in their own list.
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1 } } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "SOLUSD"]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker.keys()]).toEqual(["BTCUSD"]);
  });

  it("pyth_lazer_rule: an absent package block serves nothing", () => {
    const plan = resolveOracleReadPlan(hostWith({}), "pyth_lazer_rule", ["BTCUSD"]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect(plan.feedIdByTicker.size).toBe(0);
  });

  it("pyth_lazer_rule: an Object.prototype key name is NOT feeds-listed", () => {
    // feeds["toString"] via a bare bracket read is an inherited Function
    // (≠ undefined) — own-key lookups must read it as simply not-listed
    // rather than mapping a Function as a "feed id".
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1 } } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", [
      "BTCUSD",
      "toString",
      "constructor",
    ]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker.keys()]).toEqual(["BTCUSD"]);
  });

  it("waterx_rule: serves exactly the feeds-listed tickers", () => {
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: { ticker: "XAUUSD" } } } });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "EURUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"] });
  });

  it("waterx_rule: an Object.prototype key name is NOT feeds-listed — `in`-operator hole closed", () => {
    // 'toString' in feeds === true via the prototype chain; a ticker named
    // like a prototype key must not be sent to the quote-center (whole-batch
    // 404 on unknown symbols).
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: { ticker: "XAUUSD" } } } });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "toString"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"] });
  });

  it("waterx_rule: an absent feeds block serves NOTHING — never a silent quote-center takeover", () => {
    // Claiming unlisted tickers would reroute every read to the quote-center
    // (it serves symbols regardless of on-chain config) and swallow tickers a
    // later-listed source could price; the misconfig is caught loudly by
    // `assertOracleWriteCoverage` at boot instead.
    const plan = resolveOracleReadPlan(hostWith({}), "waterx_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: [] });
  });
});

describe("readPlanTickers", () => {
  it("lazer plane: the feed-map keys, in plan order", () => {
    const host = hostWith({ pyth_lazer_rule: { feeds: { BTCUSD: 1, ETHUSD: 2 } } });
    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["ETHUSD", "BTCUSD", "XAUUSD"]);

    expect(readPlanTickers(plan)).toEqual(["ETHUSD", "BTCUSD"]);
  });

  it("quote_center plane: the served ticker list verbatim", () => {
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: {}, BTCUSD: {} } } });
    const plan = resolveOracleReadPlan(host, "waterx_rule", ["BTCUSD", "XAUUSD", "EURUSD"]);

    expect(readPlanTickers(plan)).toEqual(["BTCUSD", "XAUUSD"]);
  });

  it("empty plans yield empty ticker lists on both planes", () => {
    expect(readPlanTickers(resolveOracleReadPlan(hostWith({}), "pyth_lazer_rule", ["A"]))).toEqual(
      [],
    );
    expect(readPlanTickers(resolveOracleReadPlan(hostWith({}), "waterx_rule", ["A"]))).toEqual([]);
  });
});
