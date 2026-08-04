/**
 * `resolveOracleReadPlan` — the per-source READ-plane resolver: hex-id
 * mapping for the pyth sources (Lazer reads through `pyth_rule.feeds`, its
 * integer write ids never reach a read surface), the `unreadable` gap for
 * lazer-written tickers with no hex entry, and the waterx served-set /
 * absent-feeds-claims-all contract.
 */
import { describe, expect, it } from "vitest";

import type { OracleHost } from "../../../src/oracle/host.ts";
import { PYTH_PRO_HERMES_ENDPOINT, pythCoreHermesEndpoint } from "../../../src/oracle/pyth.ts";
import {
  resolveHermesReadEndpoint,
  resolveOracleReadPlan,
} from "../../../src/oracle/read-plane.ts";

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

  it("waterx_rule: an absent feeds block serves NOTHING — never a silent quote-center takeover", () => {
    // Claiming unlisted tickers would reroute every read to the quote-center
    // (it serves symbols regardless of on-chain config) and swallow tickers a
    // later-listed source could price; the misconfig is caught loudly by the
    // consumer's feeds assert at client creation instead.
    const plan = resolveOracleReadPlan(hostWith({}), "waterx_rule", ["BTCUSD", "ETHUSD"]);

    expect(plan).toEqual({ plane: "quote_center", tickers: [], unreadable: [] });
  });
});

describe("resolveHermesReadEndpoint", () => {
  it("pyth_rule in the fed set wins — the Core source's own keyless endpoint, per network", () => {
    expect(resolveHermesReadEndpoint("TESTNET", ["pyth_rule"])).toBe(
      pythCoreHermesEndpoint("TESTNET"),
    );
    expect(resolveHermesReadEndpoint("MAINNET", ["waterx_rule", "pyth_rule"])).toBe(
      pythCoreHermesEndpoint("MAINNET"),
    );
  });

  it("without pyth_rule, resolves the documented Pyth Pro base — total, never a throw", () => {
    // The Pro base is IDENTICAL for every subscriber (auth is the Bearer key,
    // not the URL) — so a lazer/waterx-only fed set always has a first-class
    // read endpoint without any deployment-supplied URL.
    expect(resolveHermesReadEndpoint("TESTNET", ["pyth_lazer_rule"])).toBe(
      PYTH_PRO_HERMES_ENDPOINT,
    );
    expect(resolveHermesReadEndpoint("MAINNET", ["waterx_rule"])).toBe(PYTH_PRO_HERMES_ENDPOINT);
  });

  it("a deployment override (proxy / self-hosted mirror) beats the Pro base, never the Core branch", () => {
    const override = "https://app.example/api/hermes";
    expect(resolveHermesReadEndpoint("TESTNET", ["pyth_lazer_rule", "waterx_rule"], override)).toBe(
      override,
    );
    // With pyth_rule listed the Core endpoint still wins — the override is a
    // Pro-side knob, not a Core replacement.
    expect(resolveHermesReadEndpoint("TESTNET", ["pyth_rule"], override)).toBe(
      pythCoreHermesEndpoint("TESTNET"),
    );
  });
});
