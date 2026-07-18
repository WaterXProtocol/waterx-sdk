import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearConfigCache, loadConfig } from "../../../src/perp/config.ts";
import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

const MOCK_TESTNET_CONFIG_URL = "https://waterx.test/fixtures/mock-testnet.json";
// Shared URL for the tests that only stub `fetch` — the URL now comes solely
// from the `waterxConfigUrl` opt (there is no env-var fallback / default).
const BASE_URL = "https://waterx.test/testnet.json";

describe("loadConfig validation", () => {
  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("throws when no config URL is passed (no env fallback / default)", async () => {
    await expect(loadConfig("TESTNET")).rejects.toThrow(/no config URL/);
  });

  it("fetches the waterxConfigUrl as-is", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => MOCK_TESTNET_CONFIG }));
    await loadConfig("TESTNET", {
      waterxConfigUrl: "https://explicit.test/opts.json",
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(fetchMock).toHaveBeenCalledWith("https://explicit.test/opts.json", expect.anything());
  });

  it("throws when fetch is unavailable", async () => {
    vi.stubGlobal("fetch", undefined);
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(
      /no global `fetch`/,
    );
  });

  it("throws on HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(/HTTP 404/);
  });

  it("throws when network mismatches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ...MOCK_TESTNET_CONFIG, network: "mainnet" }),
      })),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(
      /declares network=mainnet/,
    );
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
    const cfg = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL });
    expect(cfg.packages.waterx_credit?.credit_registry).toMatch(/^0x/);
    expect(cfg.packages.waterx_perp).toBeUndefined();
  });

  it("throws when config has no packages object", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ network: "testnet" }) })),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(
      /has no packages object/,
    );
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
    const cfg = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL });
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
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(
      /missing packages\.waterx_perp/,
    );
  });

  it("fetches and parses canonical-shaped testnet JSON", async () => {
    const cfg = await loadConfig("TESTNET", {
      waterxConfigUrl: MOCK_TESTNET_CONFIG_URL,
      fetchImpl: (async () => ({
        ok: true,
        json: async () => MOCK_TESTNET_CONFIG,
      })) as unknown as typeof fetch,
    });
    expect(cfg.network).toBe("testnet");
    expect(cfg.packages.wlp?.published_at).toMatch(/^0x/);
    expect(cfg.packages.waterx_perp.markets.BTCUSD).toBeDefined();
  });

  it("retries a transient HTTP failure (503) then succeeds", async () => {
    // Fake timers so the real 250ms + 500ms retry backoff doesn't cost wall
    // clock in the suite (precedent: wormhole.test.ts's waitForVaa polling
    // tests) — `advanceTimersByTimeAsync` also pumps the microtask queue
    // between timer advances, so the mocked fetch's own promise resolutions
    // still interleave correctly.
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
    }) as unknown as typeof fetch;

    const pending = loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await vi.advanceTimersByTimeAsync(1_000); // covers the 250ms + 500ms backoff
    const cfg = await pending;

    expect(cfg.network).toBe("testnet");
    expect(calls).toBe(3);
  });

  it("returns the last-known-good config when a later refresh fails persistently", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
      return { ok: false, status: 503, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const pendingSecond = loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await vi.advanceTimersByTimeAsync(1_000); // covers the fallback call's own 250ms + 500ms backoff
    const second = await pendingSecond;

    expect(second).toEqual(first);
    // The fallback call still exhausted its own 3 attempts (calls 2-4)
    // before falling back — proves it's a real retry-then-fallback, not a
    // silent skip of the refresh.
    expect(calls).toBe(4);
  });

  it("throws on first load when every retry attempt fails (no last-known-good to fall back to)", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const pending = loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const assertion = expect(pending).rejects.toThrow(/HTTP 500/);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("returns the last-known-good config when a refresh's 200 response has malformed JSON", async () => {
    // A 200 with a garbage body is a refresh failure exactly like a non-ok
    // status — it must not crash a caller that already has a working
    // config for this URL. `.json()` throwing is NOT a retryable condition
    // (fetchWithPolicy already returned successfully; parsing is loadConfig's
    // own concern), so this exercises the json()/validateConfig try/catch
    // directly, not the retry loop.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON");
        },
      };
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const second = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });

    expect(second).toEqual(first);
    expect(calls).toBe(2);
  });

  it("rethrows on first load when the 200 response has malformed JSON (no last-known-good to fall back to)", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token in JSON");
      },
    })) as unknown as typeof fetch;

    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl })).rejects.toThrow(
      /Unexpected token/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns the last-known-good config when a refresh's 200 response fails validateConfig", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
      // A 200 with a shape validateConfig rejects (no packages object).
      return { ok: true, json: async () => ({ network: "testnet" }) };
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const second = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });

    expect(second).toEqual(first);
    expect(calls).toBe(2);
  });

  it("uses in-memory cache when opts.cache is true", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
    }) as unknown as typeof fetch;
    await loadConfig("TESTNET", {
      waterxConfigUrl: MOCK_TESTNET_CONFIG_URL,
      cache: true,
      fetchImpl,
    });
    await loadConfig("TESTNET", {
      waterxConfigUrl: MOCK_TESTNET_CONFIG_URL,
      cache: true,
      fetchImpl,
    });
    expect(calls).toBe(1);
  });

  it("cache: true reads an entry populated by an earlier cache: false load (unified cache map)", async () => {
    // The config cache is now a single module map written unconditionally on
    // every successful load; `opts.cache` only gates the early-return READ.
    // So a `cache: false` (default) call still populates the map, and a
    // later `cache: true` call for the same URL hits that entry instead of
    // re-fetching — same URL's latest successful fetch, strictly fresher
    // than any fallback would be.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return { ok: true, json: async () => MOCK_TESTNET_CONFIG };
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", {
      waterxConfigUrl: MOCK_TESTNET_CONFIG_URL,
      fetchImpl,
    });
    const second = await loadConfig("TESTNET", {
      waterxConfigUrl: MOCK_TESTNET_CONFIG_URL,
      cache: true,
      fetchImpl,
    });

    expect(second).toEqual(first);
    expect(calls).toBe(1);
  });
});
