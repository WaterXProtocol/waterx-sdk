import { describe, expect, it } from "vitest";

import {
  assertNoRetiredConfigUrlAliases,
  RETIRED_CONFIG_URL_ALIASES,
  waterxConfigUrlFromEnv,
} from "../../../scripts/waterx-config-url.ts";
import { waterxConfigUrlFromRoot } from "../../../src/config.ts";

const ROOT = "https://staging-v2.waterx-config.pages.dev";

describe("waterxConfigUrlFromRoot (public)", () => {
  it("composes ${root}/${network}.json for either network spelling", () => {
    expect(waterxConfigUrlFromRoot(ROOT, "TESTNET")).toBe(`${ROOT}/testnet.json`);
    expect(waterxConfigUrlFromRoot(ROOT, "MAINNET")).toBe(`${ROOT}/mainnet.json`);
    expect(waterxConfigUrlFromRoot(ROOT, "testnet")).toBe(`${ROOT}/testnet.json`);
    expect(waterxConfigUrlFromRoot("https://main-v2.waterx-config.pages.dev", "mainnet")).toBe(
      "https://main-v2.waterx-config.pages.dev/mainnet.json",
    );
  });

  it("strips trailing slashes and surrounding whitespace", () => {
    expect(waterxConfigUrlFromRoot(`${ROOT}/`, "TESTNET")).toBe(`${ROOT}/testnet.json`);
    expect(waterxConfigUrlFromRoot(`  ${ROOT}/// `, "TESTNET")).toBe(`${ROOT}/testnet.json`);
  });

  it("keeps a path prefix on the root", () => {
    expect(waterxConfigUrlFromRoot("https://cdn.example/waterx/config/", "TESTNET")).toBe(
      "https://cdn.example/waterx/config/testnet.json",
    );
  });

  it("rejects a full document URL (.json) instead of rewriting it, naming the fix", () => {
    for (const bad of [
      `${ROOT}/testnet.json`,
      `${ROOT}/mainnet.json/`,
      `${ROOT}/TESTNET.JSON`,
      `${ROOT}/testnet.json?v=2`,
    ]) {
      expect(() => waterxConfigUrlFromRoot(bad, "TESTNET"), bad).toThrow(
        /full document URL \(the old format\)\. Set the CDN ROOT/,
      );
    }
  });

  it("rejects non-https schemes", () => {
    expect(() =>
      waterxConfigUrlFromRoot("http://staging-v2.waterx-config.pages.dev", "TESTNET"),
    ).toThrow(/must use https/);
    expect(() => waterxConfigUrlFromRoot("file:///tmp/config", "TESTNET")).toThrow(
      /must use https/,
    );
  });

  it("rejects GitHub hosts", () => {
    for (const bad of [
      "https://github.com/WaterXProtocol/waterx-config",
      "https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main",
      "https://objects.githubusercontent.com/x",
    ]) {
      expect(() => waterxConfigUrlFromRoot(bad, "TESTNET"), bad).toThrow(/GitHub host/);
    }
  });

  it("rejects a query string or fragment, an empty value, a non-URL and an unknown network", () => {
    expect(() => waterxConfigUrlFromRoot(`${ROOT}?ref=x`, "TESTNET")).toThrow(/query string/);
    expect(() => waterxConfigUrlFromRoot(`${ROOT}#x`, "TESTNET")).toThrow(/query string/);
    expect(() => waterxConfigUrlFromRoot("  ", "TESTNET")).toThrow(/empty config root/);
    expect(() => waterxConfigUrlFromRoot("staging-v2.waterx-config.pages.dev", "TESTNET")).toThrow(
      /is not a URL/,
    );
    expect(() => waterxConfigUrlFromRoot(ROOT, "DEVNET" as never)).toThrow(/unknown network/);
  });
});

describe("waterxConfigUrlFromEnv (env boundary)", () => {
  it("returns undefined for an unset/blank value so create() throws its own error", () => {
    expect(waterxConfigUrlFromEnv("testnet", {})).toBeUndefined();
    expect(waterxConfigUrlFromEnv("testnet", { WATERX_CONFIG_URL: "   " })).toBeUndefined();
  });

  it("composes a root and prefixes errors with the variable name", () => {
    expect(waterxConfigUrlFromEnv("MAINNET", { WATERX_CONFIG_URL: `${ROOT}/` })).toBe(
      `${ROOT}/mainnet.json`,
    );
    expect(() =>
      waterxConfigUrlFromEnv("testnet", { WATERX_CONFIG_URL: `${ROOT}/testnet.json` }),
    ).toThrow(/^WATERX_CONFIG_URL: .*full document URL/);
  });
});

describe("retired aliases", () => {
  it("names E2E_CONFIG_URL and PREDICT_CONFIG_URL", () => {
    expect([...RETIRED_CONFIG_URL_ALIASES]).toEqual(["E2E_CONFIG_URL", "PREDICT_CONFIG_URL"]);
  });

  it("throws, naming WATERX_CONFIG_URL, when a retired alias is set", () => {
    expect(() => assertNoRetiredConfigUrlAliases({ E2E_CONFIG_URL: ROOT })).toThrow(
      /E2E_CONFIG_URL is retired\. Unset it and set WATERX_CONFIG_URL/,
    );
    expect(() =>
      waterxConfigUrlFromEnv("testnet", { WATERX_CONFIG_URL: ROOT, PREDICT_CONFIG_URL: ROOT }),
    ).toThrow(/PREDICT_CONFIG_URL is retired/);
  });

  it("ignores an empty alias and resolves WATERX_CONFIG_URL", () => {
    expect(waterxConfigUrlFromEnv("testnet", { WATERX_CONFIG_URL: ROOT, E2E_CONFIG_URL: "" })).toBe(
      `${ROOT}/testnet.json`,
    );
  });
});
