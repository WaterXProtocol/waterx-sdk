import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertRequiredPackages,
  clearConfigCache,
  loadConfig,
  parseConfigDocument,
  REQUIRED_PACKAGES,
} from "../../../src/config.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import { PredictClient } from "../../../src/prediction/client.ts";
import {
  MOCK_TESTNET_CONFIG,
  MOCK_TESTNET_CONFIG_RAW,
} from "../../helpers/fixtures/mock-testnet-config.ts";

// The REAL staging-v2 testnet document — parse strictness and the required-
// package check are exercised against live-shape data, not only the trimmed mock.
const STAGING_V2_TESTNET = JSON.parse(
  readFileSync(
    new URL("../helpers/fixtures/waterx-config-v2-testnet.json", import.meta.url),
    "utf8",
  ),
) as Record<string, unknown>;

/** A deep-cloned, mutable copy of the raw mock document (the wire shape). */
function rawDoc(): Record<string, any> {
  return structuredClone(MOCK_TESTNET_CONFIG_RAW) as Record<string, any>;
}

const BASE_URL = "https://waterx.test/testnet.json";
const ok = (body: unknown) => ({ ok: true, json: async () => body });

describe("parseConfigDocument (strict v2 parse + required packages)", () => {
  it("parses the real staging-v2 testnet document and asserts every required package", () => {
    const cfg = parseConfigDocument(STAGING_V2_TESTNET, "TESTNET");
    expect(cfg.network).toBe("testnet");
    expect(cfg.schema_version).toBe(2);
    for (const name of REQUIRED_PACKAGES) expect(cfg.packages[name].published_at).toMatch(/^0x/);
    // Each rule block names its own package; the named entry must exist.
    expect(cfg.packages[cfg.oracle_rules.waterx.package].published_at).toMatch(/^0x/);
    expect(cfg.packages[cfg.oracle_rules.constant.package].published_at).toMatch(/^0x/);
    // Object ids live under `objects.*`, never under `packages.*`.
    expect(cfg.objects.perp.markets.BTCUSD?.market).toMatch(/^0x/);
    expect(cfg.objects.oracle.aggregators.BTCUSD).toMatch(/^0x/);
    expect(Object.keys(cfg.symbols).length).toBeGreaterThan(0);
  });

  it("the parsed document IS the config: no legacy per-package object ids are synthesized", () => {
    const cfg = parseConfigDocument(STAGING_V2_TESTNET, "TESTNET");
    expect(Object.keys(cfg.packages.waterx_perp).sort()).toEqual(
      ["original_id", "published_at", "upgrade_capability", "version"].filter(
        (k) => k in cfg.packages.waterx_perp,
      ),
    );
  });

  it("rejects a network mismatch via the strict parser", () => {
    expect(() => parseConfigDocument(STAGING_V2_TESTNET, "MAINNET")).toThrow(/network/i);
  });

  it("rejects a legacy (schema_version-less, per-package object id) document outright", () => {
    const legacy = {
      network: "testnet",
      packages: {
        bucket_framework: MOCK_TESTNET_CONFIG.packages.bucket_framework,
        waterx_account: {
          ...MOCK_TESTNET_CONFIG.packages.waterx_account,
          account_registry: MOCK_TESTNET_CONFIG.objects.account.registry,
        },
      },
    };
    expect(() => parseConfigDocument(legacy, "TESTNET")).toThrow();
  });

  it("rejects a document missing a package EVERY consumer reads, naming it", () => {
    const doc = rawDoc();
    delete doc.packages.waterx_account;
    delete doc.packages.waterx_referral;
    expect(() => parseConfigDocument(doc, "TESTNET")).toThrow(
      /packages\.\{waterx_account, waterx_referral\} missing/,
    );
  });

  it("loads a document missing the OTHER line's packages — a partial deployment is usable", () => {
    // A network that ships perp before prediction must not block perp
    // consumers: the per-line set is asserted by that line's client instead.
    const doc = rawDoc();
    delete doc.packages.waterx_prediction;
    delete doc.packages.waterx_prediction_gift;
    const cfg = parseConfigDocument(doc, "TESTNET");
    expect(cfg.packages.waterx_perp.published_at).toMatch(/^0x/);
    expect(() => new PerpClient("TESTNET", cfg, {})).not.toThrow();
    expect(() => new PredictClient("TESTNET", cfg)).toThrow(/prediction line/);
  });

  it("rejects a rule block whose named package entry is absent", () => {
    const doc = rawDoc();
    delete doc.packages.pyth_lazer_rule;
    expect(() => parseConfigDocument(doc, "TESTNET")).toThrow(/pyth_lazer_rule/);
  });

  it("does not require the Lazer package when the deployment carries no pyth_lazer block", () => {
    const doc = rawDoc();
    delete doc.oracle_rules.pyth_lazer;
    delete doc.packages.pyth_lazer_rule;
    const cfg = parseConfigDocument(doc, "TESTNET");
    expect(cfg.oracle_rules.pyth_lazer).toBeUndefined();
  });

  it("assertRequiredPackages narrows an already-parsed document in place", () => {
    const parsed = structuredClone(MOCK_TESTNET_CONFIG);
    expect(() => assertRequiredPackages(parsed)).not.toThrow();
  });
});

describe("loadConfig", () => {
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
    const fetchMock = vi.fn(async () => ok(MOCK_TESTNET_CONFIG_RAW));
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

  it("throws when the document declares another network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ ...rawDoc(), network: "mainnet" })),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(/network/i);
  });

  it("throws on a legacy document (no schema_version) — there is no cast-and-hope path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ network: "testnet", packages: MOCK_TESTNET_CONFIG.packages })),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow();
  });

  it("throws when a package every consumer reads is missing", async () => {
    const doc = rawDoc();
    delete doc.packages.bucket_framework;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok(doc)),
    );
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL })).rejects.toThrow(
      /packages\.\{bucket_framework\} missing/,
    );
  });

  it("returns the parsed document (unknown fields stripped, every read under objects.*)", async () => {
    const doc = rawDoc();
    doc.some_future_field = { x: 1 };
    const cfg = await loadConfig("TESTNET", {
      waterxConfigUrl: BASE_URL,
      fetchImpl: (async () => ok(doc)) as unknown as typeof fetch,
    });
    expect(cfg).toEqual(MOCK_TESTNET_CONFIG);
    expect((cfg as Record<string, unknown>).some_future_field).toBeUndefined();
    expect(cfg.objects.perp.markets.BTCUSD).toBeDefined();
  });

  it("retries a transient HTTP failure (503) then succeeds", async () => {
    // Fake timers so the real 250ms + 500ms retry backoff doesn't cost wall
    // clock in the suite — `advanceTimersByTimeAsync` also pumps the microtask
    // queue between timer advances, so the mocked fetch's own promise
    // resolutions still interleave correctly.
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls < 3) return { ok: false, status: 503, json: async () => ({}) };
      return ok(MOCK_TESTNET_CONFIG_RAW);
    }) as unknown as typeof fetch;

    const pending = loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await vi.advanceTimersByTimeAsync(1_000); // covers the 250ms + 500ms backoff
    const cfg = await pending;

    expect(cfg.network).toBe("testnet");
    expect(calls).toBe(3);
  });

  it("falls back to last-known-good when a refresh fails TRANSIENTLY (503)", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return ok(MOCK_TESTNET_CONFIG_RAW);
      return { ok: false, status: 503, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const pendingSecond = loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await vi.advanceTimersByTimeAsync(1_000); // covers the fallback call's own 250ms + 500ms backoff
    const second = await pendingSecond;

    expect(second).toBe(first);
    // The fallback call still exhausted its own 3 attempts (calls 2-4)
    // before falling back — proves it's a real retry-then-fallback, not a
    // silent skip of the refresh.
    expect(calls).toBe(4);
  });

  it("keys the cache by network+url: a mainnet request never reuses a testnet snapshot for the same url (primary read)", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1 ? ok(MOCK_TESTNET_CONFIG_RAW) : ok({ ...rawDoc(), network: "mainnet" });
    }) as unknown as typeof fetch;

    const testnet = await loadConfig("TESTNET", {
      waterxConfigUrl: BASE_URL,
      cache: true,
      fetchImpl,
    });
    const mainnet = await loadConfig("MAINNET", {
      waterxConfigUrl: BASE_URL,
      cache: true,
      fetchImpl,
    });

    expect(testnet.network).toBe("testnet");
    expect(mainnet.network).toBe("mainnet");
    // The mainnet request did NOT reuse the cached testnet snapshot for the
    // same url — it fetched fresh (a url-only key would have returned testnet).
    expect(calls).toBe(2);
  });

  it("keys the resilience fallback by network+url: a failing mainnet refresh never falls back to a testnet snapshot for the same url", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      // Testnet load (call 1) succeeds and is cached; every mainnet call fails.
      return calls === 1
        ? ok(MOCK_TESTNET_CONFIG_RAW)
        : { ok: false, status: 503, json: async () => ({}) };
    }) as unknown as typeof fetch;

    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, cache: true, fetchImpl });

    // Same url, different network, persistent failure: there is no mainnet
    // last-known-good, so this must THROW rather than serve the cached testnet
    // config (whose object ids are for the wrong chain).
    const pending = loadConfig("MAINNET", { waterxConfigUrl: BASE_URL, cache: true, fetchImpl });
    const assertion = expect(pending).rejects.toThrow(/HTTP 503/);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
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

  it("does NOT fall back on malformed JSON — a bad document is deterministic", async () => {
    // A 200 carrying garbage describes THIS url, not a passing blip: the next
    // attempt returns the same garbage. Serving the stale snapshot would let a
    // process repointed at a retired or pre-v2 endpoint build against dead
    // object ids forever. Only transport-level failures fall back.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return ok(MOCK_TESTNET_CONFIG_RAW);
      return {
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON");
        },
      };
    }) as unknown as typeof fetch;

    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl })).rejects.toThrow(
      /Unexpected token/,
    );
    expect(calls).toBe(2);
  });

  it("does NOT fall back on a deterministic HTTP status (404) — the URL moved", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1
        ? ok(MOCK_TESTNET_CONFIG_RAW)
        : { ok: false, status: 404, json: async () => ({}) };
    }) as unknown as typeof fetch;

    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl })).rejects.toThrow(
      /HTTP 404/,
    );
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

  it("does NOT fall back when a refresh's 200 response fails the strict parse", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) return ok(MOCK_TESTNET_CONFIG_RAW);
      return ok({ schema_version: 2, network: "testnet" });
    }) as unknown as typeof fetch;

    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    await expect(loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl })).rejects.toThrow();
    expect(calls).toBe(2);
  });

  it("uses in-memory cache when opts.cache is true", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return ok(MOCK_TESTNET_CONFIG_RAW);
    }) as unknown as typeof fetch;
    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, cache: true, fetchImpl });
    await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, cache: true, fetchImpl });
    expect(calls).toBe(1);
  });

  it("cache: true reads an entry populated by an earlier cache: false load (unified cache map)", async () => {
    // The config cache is a single module map written unconditionally on
    // every successful load; `opts.cache` only gates the early-return READ.
    // So a `cache: false` (default) call still populates the map, and a
    // later `cache: true` call for the same URL hits that entry instead of
    // re-fetching — same URL's latest successful fetch, strictly fresher
    // than any fallback would be.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return ok(MOCK_TESTNET_CONFIG_RAW);
    }) as unknown as typeof fetch;

    const first = await loadConfig("TESTNET", { waterxConfigUrl: BASE_URL, fetchImpl });
    const second = await loadConfig("TESTNET", {
      waterxConfigUrl: BASE_URL,
      cache: true,
      fetchImpl,
    });

    expect(second).toBe(first);
    expect(calls).toBe(1);
  });
});
