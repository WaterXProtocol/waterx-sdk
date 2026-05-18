import { afterEach, describe, expect, it, vi } from "vitest";

import { clearConfigCache, defaultConfigUrl, loadConfig } from "../../src/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

describe("loadConfig validation", () => {
  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
  });

  it("defaultConfigUrl points at waterx-config raw JSON", () => {
    expect(defaultConfigUrl("TESTNET")).toContain("waterx-config");
    expect(defaultConfigUrl("TESTNET")).toContain("testnet.json");
  });

  it("throws when fetch is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    await expect(loadConfig("TESTNET")).rejects.toThrow(/no global `fetch`/);
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    await expect(loadConfig("TESTNET")).rejects.toThrow(/HTTP 404/);
  });

  it("throws when network mismatches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...MOCK_TESTNET_CONFIG, network: "mainnet" }),
      })),
    );
    await expect(loadConfig("TESTNET")).rejects.toThrow(/declares network=mainnet/);
  });

  it("throws when required package missing published_at", async () => {
    const bad = structuredClone(MOCK_TESTNET_CONFIG);
    (bad.packages.waterx_perp as { published_at: string }).published_at = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => bad })),
    );
    await expect(loadConfig("TESTNET")).rejects.toThrow(/missing packages\.waterx_perp/);
  });
});
