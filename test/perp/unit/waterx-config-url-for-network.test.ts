import { afterEach, describe, expect, it } from "vitest";

import { waterxConfigUrlForNetwork } from "../../../scripts/load-repo-env.ts";
import { resolveWaterxConfigUrl } from "../../../scripts/waterx-config-url.ts";

const BASE = "https://staging-v2.waterx-config.pages.dev";

describe("resolveWaterxConfigUrl", () => {
  describe("base form (the convention)", () => {
    it("appends the requested network's document to a base root", () => {
      expect(resolveWaterxConfigUrl(BASE, "testnet")).toBe(`${BASE}/testnet.json`);
      expect(resolveWaterxConfigUrl(BASE, "mainnet")).toBe(`${BASE}/mainnet.json`);
    });

    it("accepts the upper-case network spelling the SDK uses", () => {
      expect(resolveWaterxConfigUrl(BASE, "MAINNET")).toBe(`${BASE}/mainnet.json`);
    });

    it("trims trailing slashes rather than doubling them", () => {
      expect(resolveWaterxConfigUrl(`${BASE}//`, "testnet")).toBe(`${BASE}/testnet.json`);
    });

    it("preserves a base PATH, so a mirror under a sub-path still resolves", () => {
      expect(resolveWaterxConfigUrl("https://cdn.example/waterx/config", "testnet")).toBe(
        "https://cdn.example/waterx/config/testnet.json",
      );
    });
  });

  describe("legacy complete-file form (transitional)", () => {
    it("uses a matching file URL as-is", () => {
      expect(resolveWaterxConfigUrl(`${BASE}/testnet.json`, "testnet")).toBe(
        `${BASE}/testnet.json`,
      );
    });

    it("still swaps testnet.json ↔ mainnet.json to follow the caller's network", () => {
      expect(resolveWaterxConfigUrl("https://cdn.example/testnet.json", "mainnet")).toBe(
        "https://cdn.example/mainnet.json",
      );
      expect(resolveWaterxConfigUrl("https://cdn.example/mainnet.json", "testnet")).toBe(
        "https://cdn.example/testnet.json",
      );
    });

    it("recognizes the file shape by PATH, so a query string cannot disguise it", () => {
      expect(resolveWaterxConfigUrl("https://cdn.example/testnet.json?v=2", "testnet")).toBe(
        "https://cdn.example/testnet.json?v=2",
      );
    });
  });

  it("returns undefined for an unset or blank value", () => {
    expect(resolveWaterxConfigUrl(undefined, "testnet")).toBeUndefined();
    expect(resolveWaterxConfigUrl("   ", "testnet")).toBeUndefined();
  });
});

describe("waterxConfigUrlForNetwork", () => {
  const prev = process.env.WATERX_CONFIG_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.WATERX_CONFIG_URL;
    else process.env.WATERX_CONFIG_URL = prev;
  });

  it("composes the document URL from the env base", () => {
    process.env.WATERX_CONFIG_URL = BASE;
    expect(waterxConfigUrlForNetwork("MAINNET")).toBe(`${BASE}/mainnet.json`);
  });

  it("returns undefined when unset, leaving the 'no config URL' throw to the client", () => {
    delete process.env.WATERX_CONFIG_URL;
    expect(waterxConfigUrlForNetwork("TESTNET")).toBeUndefined();
  });
});
