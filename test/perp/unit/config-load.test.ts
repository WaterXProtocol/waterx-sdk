import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearConfigCache, defaultConfigUrl, loadConfig } from "../../../src/perp/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

const MOCK_TESTNET_CONFIG_URL = "https://waterx.test/fixtures/mock-testnet.json";

describe("loadConfig validation", () => {
  beforeEach(() => {
    clearConfigCache();
  });

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

  it("accepts credit-only config shape (no waterx_perp)", async () => {
    const creditOnly = {
      network: "testnet",
      packages: {
        bucket_framework: MOCK_TESTNET_CONFIG.packages.bucket_framework,
        waterx_account: MOCK_TESTNET_CONFIG.packages.waterx_account,
        waterx_credit: MOCK_TESTNET_CONFIG.packages.waterx_credit,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => creditOnly })),
    );
    const cfg = await loadConfig("TESTNET");
    expect(cfg.packages.waterx_credit?.credit_registry).toMatch(/^0x/);
    expect(cfg.packages.waterx_perp).toBeUndefined();
  });

  it("throws when config has no packages object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ network: "testnet" }) })),
    );
    await expect(loadConfig("TESTNET")).rejects.toThrow(/has no packages object/);
  });

  it("accepts account-only minimal config (no perp, no credit)", async () => {
    const minimal = {
      network: "testnet",
      packages: {
        bucket_framework: MOCK_TESTNET_CONFIG.packages.bucket_framework,
        waterx_account: MOCK_TESTNET_CONFIG.packages.waterx_account,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => minimal })),
    );
    const cfg = await loadConfig("TESTNET");
    expect(cfg.packages.waterx_account.account_registry).toMatch(/^0x/);
    expect(cfg.packages.waterx_perp).toBeUndefined();
    expect(cfg.packages.waterx_credit).toBeUndefined();
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

  it("fetches and parses canonical-shaped testnet JSON", async () => {
    const cfg = await loadConfig("TESTNET", {
      configUrl: MOCK_TESTNET_CONFIG_URL,
      fetchImpl: (async () => ({
        ok: true,
        json: async () => MOCK_TESTNET_CONFIG,
      })) as unknown as typeof fetch,
    });
    expect(cfg.network).toBe("testnet");
    expect(cfg.packages.wlp?.published_at).toMatch(/^0x/);
    expect(cfg.packages.waterx_perp.markets.BTCUSD).toBeDefined();
  });

  it("uses in-memory cache when opts.cache is true", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
    }) as unknown as typeof fetch;
    await loadConfig("TESTNET", {
      configUrl: MOCK_TESTNET_CONFIG_URL,
      cache: true,
      fetchImpl,
    });
    await loadConfig("TESTNET", {
      configUrl: MOCK_TESTNET_CONFIG_URL,
      cache: true,
      fetchImpl,
    });
    expect(calls).toBe(1);
  });
});
