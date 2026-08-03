/**
 * `resolveOracleReadPlan` — the per-source READ-plane resolver: hex-id
 * mapping for the pyth sources (Lazer reads through `pyth_rule.feeds`, its
 * integer write ids never reach a read surface), the `unreadable` gap for
 * lazer-written tickers with no hex entry, and the waterx served-set /
 * absent-feeds-claims-all contract.
 */
import { describe, expect, it } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { resolveOracleReadPlan } from "../../../src/oracle/read-plane.ts";

function hostWith(packages: Record<string, unknown>): OracleHost {
  return { config: { packages } } as unknown as OracleHost;
}

const HEX_FEEDS = {
  BTCUSD: { feed_id: "0xfeedbtc", price_info_object: "0x1" },
  ETHUSD: { feed_id: "0xfeedeth", price_info_object: "0x2" },
};

describe("resolveOracleReadPlan", () => {
  it("pyth_rule: maps servable tickers to hex feed ids; write==read so nothing is unreadable", () => {
    const host = hostWith({ pyth_rule: { feeds: HEX_FEEDS } });

    const plan = resolveOracleReadPlan(host, "pyth_rule", ["BTCUSD", "ETHUSD", "XAUUSD"]);

    expect(plan.plane).toBe("hermes");
    if (plan.plane !== "hermes") throw new Error("unreachable");
    expect([...plan.feedIdByTicker]).toEqual([
      ["BTCUSD", "0xfeedbtc"],
      ["ETHUSD", "0xfeedeth"],
    ]);
    expect(plan.unreadable).toEqual([]);
  });

  it("pyth_lazer_rule: reads through pyth_rule's HEX namespace, not its own integer ids", () => {
    const host = hostWith({
      pyth_rule: { feeds: HEX_FEEDS },
      pyth_lazer_rule: { feeds: { BTCUSD: 1, ETHUSD: 2 } },
    });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan.plane).toBe("hermes");
    if (plan.plane !== "hermes") throw new Error("unreachable");
    expect(plan.feedIdByTicker.get("BTCUSD")).toBe("0xfeedbtc");
    expect(plan.unreadable).toEqual([]);
  });

  it("pyth_lazer_rule: a lazer-WRITTEN ticker with no hex entry is reported unreadable, not silently dropped", () => {
    // The Core-retirement trap: the SDK's update leg serves the ticker fine
    // (lazer feed exists) but no Hermes read can price it — the plan must
    // surface the gap so consumers fail loudly instead of omitting a price.
    const host = hostWith({
      pyth_rule: { feeds: { BTCUSD: HEX_FEEDS.BTCUSD } },
      pyth_lazer_rule: { feeds: { BTCUSD: 1, SOLUSD: 6 } },
    });

    const plan = resolveOracleReadPlan(host, "pyth_lazer_rule", ["BTCUSD", "SOLUSD"]);

    if (plan.plane !== "hermes") throw new Error("unreachable");
    expect([...plan.feedIdByTicker.keys()]).toEqual(["BTCUSD"]);
    expect(plan.unreadable).toEqual(["SOLUSD"]);
  });

  it("waterx_rule: serves exactly the feeds-listed tickers", () => {
    const host = hostWith({ waterx_rule: { feeds: { XAUUSD: { ticker: "XAUUSD" } } } });

    const plan = resolveOracleReadPlan(host, "waterx_rule", ["XAUUSD", "EURUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: ["XAUUSD"], unreadable: [] });
  });

  it("waterx_rule: an absent feeds block claims EVERY requested ticker (loud downstream failure)", () => {
    const plan = resolveOracleReadPlan(hostWith({}), "waterx_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan).toEqual({
      plane: "quote_center",
      tickers: ["BTCUSD", "ETHUSD"],
      unreadable: [],
    });
  });
});
