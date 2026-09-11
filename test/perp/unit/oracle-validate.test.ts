/**
 * `validate.ts` — the boot-time asserts consumers (FE `assertServerOracleEnv`,
 * BE `sdk.module` feeds assert / config superRefine) fold onto. Coverage is a
 * single write-plane assert over the tickers a deployment cares about (write
 * set == read set by design), sharing ONE predicate with the per-build path;
 * credentials are an env-shaped audit keyed off each rule's own `credential`
 * declaration.
 */
import { describe, expect, it } from "vitest";

import {
  assertOracleWriteCoverage,
  missingOracleCredentials,
  OracleTickerUnservedError,
  partitionServableTickers,
} from "../../../src/oracle/validate.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("assertOracleWriteCoverage", () => {
  it("passes when the fed set can price every requested ticker", () => {
    const client = createUnitTestClient({ oracleSource: ["waterx_rule", "pyth_lazer_rule"] });
    expect(() => assertOracleWriteCoverage(client, ["BTCUSD", "ETHUSD"])).not.toThrow();
  });

  it("throws naming EVERY unservable ticker, not just the first", () => {
    // An operator fixing a config wants the whole list in one pass.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });

    let caught: unknown;
    try {
      assertOracleWriteCoverage(client, ["BTCUSD", "NOPEUSD", "ALSONOPEUSD"]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OracleTickerUnservedError);
    expect((caught as OracleTickerUnservedError).tickers).toEqual(["NOPEUSD", "ALSONOPEUSD"]);
  });

  it("is the boot-time twin of the per-build skip — same predicate, same verdict", () => {
    // The gap this closes: `refreshOraclePrices` SKIPS an unservable ticker,
    // and only a composer that depends on it turns that into an error. A
    // market nobody trades today would stay silently unpriceable.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    const tickers = ["BTCUSD", "NOPEUSD"];

    const { unservable } = partitionServableTickers(client, tickers);
    expect(unservable).toEqual(["NOPEUSD"]);
    expect(() => assertOracleWriteCoverage(client, tickers)).toThrow(OracleTickerUnservedError);
    // ...and the servable half passes cleanly.
    expect(() => assertOracleWriteCoverage(client, ["BTCUSD"])).not.toThrow();
  });

  it("exempts a constant-only ticker no listed source serves", () => {
    // A constant pin needs no update leg from any source, so the ticker is
    // servable with just its constant feed.
    const client = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    client.config.oracle_rules.constant.constant_prices = { USDCUSD: { price: "1000000000" } };
    delete client.config.oracle_rules.pyth_lazer!.lazer_feed_ids.USDCUSD;
    delete client.config.symbols.USDCUSD;

    expect(() => assertOracleWriteCoverage(client, ["USDCUSD"])).not.toThrow();
    expect(partitionServableTickers(client, ["USDCUSD"]).servable).toEqual(["USDCUSD"]);
  });
});

describe("missingOracleCredentials", () => {
  it("flags pyth_lazer_rule when no pythApiKey is supplied", () => {
    expect(missingOracleCredentials(["pyth_lazer_rule"], {})).toEqual([
      { source: "pyth_lazer_rule", credential: "pyth_api_key" },
    ]);
    expect(missingOracleCredentials(["pyth_lazer_rule"], { pythApiKey: "" })).toEqual([
      { source: "pyth_lazer_rule", credential: "pyth_api_key" },
    ]);
  });

  it("returns [] when the key is present, or when no listed source needs one", () => {
    expect(missingOracleCredentials(["pyth_lazer_rule"], { pythApiKey: "k" })).toEqual([]);
    expect(missingOracleCredentials(["waterx_rule"], {})).toEqual([]);
  });

  it("audits a mixed fed set per source — the credential-free source never masks the keyed one", () => {
    expect(missingOracleCredentials(["waterx_rule", "pyth_lazer_rule"], {})).toEqual([
      { source: "pyth_lazer_rule", credential: "pyth_api_key" },
    ]);
  });
});
