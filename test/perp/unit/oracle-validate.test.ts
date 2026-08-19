/**
 * `validate.ts` — the boot-time asserts consumers (FE `assertServerOracleEnv`,
 * BE `sdk.module` feeds assert / config superRefine) fold onto. Coverage is a
 * single write-plane assert (write set == read set by design); credentials are
 * an env-shaped audit keyed off each rule's own `requiredCredential`.
 */
import { describe, expect, it } from "vitest";

import {
  assertOracleWriteCoverage,
  missingOracleCredentials,
  OracleFedSetError,
} from "../../../src/oracle/validate.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("assertOracleWriteCoverage", () => {
  it("passes when every listed source has a non-empty feeds block", () => {
    const client = createUnitTestClient({ oracleSource: ["waterx_rule", "pyth_lazer_rule"] });
    expect(() => assertOracleWriteCoverage(client)).not.toThrow();
  });

  it("throws OracleFedSetError naming a listed source with an EMPTY feeds block", () => {
    const client = createUnitTestClient({ oracleSource: ["waterx_rule", "pyth_lazer_rule"] });
    client.config.packages.pyth_lazer_rule!.feeds = {};

    let caught: unknown;
    try {
      assertOracleWriteCoverage(client);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(OracleFedSetError);
    expect((caught as OracleFedSetError).source).toBe("pyth_lazer_rule");
    expect((caught as Error).message).toMatch(/pyth_lazer_rule.*no\s+feeds/s);
  });

  it("throws for a listed source whose package block is absent entirely", () => {
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    delete client.config.packages.waterx_rule;

    expect(() => assertOracleWriteCoverage(client)).toThrow(OracleFedSetError);
  });

  it("ignores sources the deployment did not list", () => {
    // Only the FED SET is asserted — an unrelated source's empty block is not
    // this deployment's problem.
    const client = createUnitTestClient({ oracleSource: "waterx_rule" });
    client.config.packages.pyth_lazer_rule!.feeds = {};

    expect(() => assertOracleWriteCoverage(client)).not.toThrow();
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
