/**
 * `resolveOracleReadPlan` — the per-source READ-plane resolver (5.0.0 two-arm
 * shape): integer Lazer ids from `oracle_rules.pyth_lazer.lazer_feed_ids`, the
 * waterx served-set contract over `oracle_rules.waterx.feeds`, and
 * `readPlanTickers` over both planes. Every source reads its OWN namespace, so
 * write set == read set by construction — there is no hermes plane, no
 * endpoint resolver, and no `unreadable` diagnostic anymore.
 */
import { describe, expect, it } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { readPlanTickers, resolveOracleReadPlan } from "../../../src/oracle/read-plane.ts";

/** A host whose config wires exactly the given Lazer ids / waterx feeds. */
function hostWith(
  wiring: {
    lazerFeedIds?: Record<string, number>;
    waterxFeeds?: string[];
    /** Symbols to mark `kind: "prediction"` in the universe. */
    predictionSymbols?: string[];
  } = {},
): OracleHost {
  const universe: Record<string, { kind: string }> = {
    BTCUSD: { kind: "perp" },
    ETHUSD: { kind: "perp" },
    XAUUSD: { kind: "perp" },
  };
  for (const symbol of wiring.predictionSymbols ?? []) {
    universe[symbol] = { kind: "prediction" };
  }
  return {
    config: {
      oracle_rules: {
        ...(wiring.lazerFeedIds ? { pyth_lazer: { lazer_feed_ids: wiring.lazerFeedIds } } : {}),
        // No `feeds` key at all when none are given — the mainnet shape.
        waterx: wiring.waterxFeeds
          ? { feeds: Object.fromEntries(wiring.waterxFeeds.map((t) => [t, {}])) }
          : {},
      },
      // The universe is populated on purpose: it must never leak into a plan.
      symbols: universe,
    },
  } as unknown as OracleHost;
}

describe("resolveOracleReadPlan", () => {
  it("pyth_lazer_rule: maps servable tickers to their own INTEGER Lazer ids", () => {
    const host = hostWith({ lazerFeedIds: { BTCUSD: 1, ETHUSD: 2 } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "ETHUSD", "XAUUSD"]);

    expect(plan.plane).toBe("lazer");
    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker]).toEqual([
      ["BTCUSD", 1],
      ["ETHUSD", 2],
    ]);
  });

  it("pyth_lazer_rule: a ticker outside lazer_feed_ids is simply absent from the plan", () => {
    // No `unreadable` diagnostic — write set == read set, so a ticker the
    // source can't read is exactly a ticker it can't write; callers degrade
    // by asking the next source in their own list.
    const host = hostWith({ lazerFeedIds: { BTCUSD: 1 } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "SOLUSD"]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker.keys()]).toEqual(["BTCUSD"]);
  });

  it("pyth_lazer_rule: an absent oracle_rules.pyth_lazer block serves nothing", () => {
    const plan = resolveOracleReadPlan(hostWith(), "pyth_lazer_rule", ["BTCUSD"]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect(plan.feedIdByTicker.size).toBe(0);
  });

  it("pyth_lazer_rule: an Object.prototype key name is NOT feed-listed", () => {
    // lazer_feed_ids["toString"] via a bare bracket read is an inherited
    // Function (≠ undefined) — own-key lookups must read it as simply
    // not-listed rather than mapping a Function as a "feed id".
    const host = hostWith({ lazerFeedIds: { BTCUSD: 1 } });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", [
      "BTCUSD",
      "toString",
      "constructor",
    ]);

    if (plan.plane !== "lazer") throw new Error("unreachable");
    expect([...plan.feedIdByTicker.keys()]).toEqual(["BTCUSD"]);
  });

  it("waterx_rule: serves exactly the oracle_rules.waterx.feeds tickers", () => {
    const host = hostWith({ waterxFeeds: ["XAUUSD"] });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "EURUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"] });
  });

  it("waterx_rule: an Object.prototype key name is NOT in the universe — `in`-operator hole closed", () => {
    // 'toString' in feeds === true via the prototype chain; a ticker named
    // like a prototype key must not be sent to the quote-center (whole-batch
    // 404 on unknown symbols).
    const host = hostWith({ waterxFeeds: ["XAUUSD"] });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "toString"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"] });
  });

  it("waterx_rule: a LISTED prediction symbol is still not claimed — it would 404 the whole batch", () => {
    // The read plane must ask the SAME question the served set and the fetch
    // partition ask (`waterxServes`). Filtering on the raw feed map instead
    // would route a prediction symbol to the quote-center and fail the batch
    // for every ticker beside it.
    const host = hostWith({
      waterxFeeds: ["BTCUSD", "PREDMKT"],
      predictionSymbols: ["PREDMKT"],
    });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["BTCUSD", "PREDMKT"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["BTCUSD"] });
  });

  it("waterx_rule: a feed key absent from `symbols` is NOT served — the parser does not enforce feeds ⊆ symbols", () => {
    // The config repo's CI checks the subset relation; the published parser
    // models `feeds` as an unconstrained record, so a drifted or hand-built
    // document reaches the SDK unvalidated. An unknown key must fail closed
    // rather than 404 the whole quote-center batch.
    const host = hostWith({ waterxFeeds: ["BTCUSD", "GHOSTUSD"] });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["BTCUSD", "GHOSTUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["BTCUSD"] });
  });

  it("waterx_rule: NO feeds map serves NOTHING, whatever `symbols` says — never a silent quote-center takeover", () => {
    // Claiming unlisted tickers would reroute every read to the quote-center
    // (it serves symbols regardless of on-chain config) and swallow tickers a
    // later-listed source could price; the misconfig is caught loudly by
    // `assertOracleWriteCoverage` at boot instead. BTCUSD / ETHUSD ARE in the
    // fixture's `symbols` universe — that must count for nothing here.
    const plan = resolveOracleReadPlan(hostWith(), "waterx_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: [] });
  });
});

describe("readPlanTickers", () => {
  it("lazer plane: the feed-map keys, in plan order", () => {
    const host = hostWith({ lazerFeedIds: { BTCUSD: 1, ETHUSD: 2 } });
    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["ETHUSD", "BTCUSD", "XAUUSD"]);

    expect(readPlanTickers(plan)).toEqual(["ETHUSD", "BTCUSD"]);
  });

  it("quote_center plane: the served ticker list verbatim", () => {
    const host = hostWith({ waterxFeeds: ["XAUUSD", "BTCUSD"] });
    const plan = resolveOracleReadPlan(host, "waterx_rule", ["BTCUSD", "XAUUSD", "EURUSD"]);

    expect(readPlanTickers(plan)).toEqual(["BTCUSD", "XAUUSD"]);
  });

  it("empty plans yield empty ticker lists on both planes", () => {
    expect(readPlanTickers(resolveOracleReadPlan(hostWith(), "pyth_lazer_rule", ["A"]))).toEqual(
      [],
    );
    expect(readPlanTickers(resolveOracleReadPlan(hostWith(), "waterx_rule", ["A"]))).toEqual([]);
  });
});
