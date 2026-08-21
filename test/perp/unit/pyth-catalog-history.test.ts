/**
 * Pyth Pro symbol catalog (`GET /v1/symbols`, keyless) + chart history
 * (`GET /v1/{channel}/history`, Bearer) — the two Pro read surfaces that
 * replace the retired Hermes `/v2/price_feeds` catalog and Benchmarks
 * history. Record shapes pinned to the 2026-08-19 probe (`pyth_lazer_id`
 * integer, `hermes_id` hex-or-absent, `symbol` fully qualified, `schedule`
 * in the market-hours grammar).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPythProHistory } from "../../../src/oracle/pyth-pro-history.ts";
import { fetchPythSymbolCatalog } from "../../../src/oracle/symbol-catalog.ts";
import { mockFetchResponse } from "../helpers/fixtures/quote-center.ts";

afterEach(() => vi.restoreAllMocks());

describe("fetchPythSymbolCatalog", () => {
  const PROBED_RECORDS = [
    {
      pyth_lazer_id: 1,
      hermes_id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      symbol: "Crypto.BTC/USD",
      asset_type: "crypto",
      state: "stable",
      min_channel: "real_time",
    },
    {
      pyth_lazer_id: 112,
      hermes_id: null,
      symbol: "Equity.US.AAPL/USD",
      schedule: "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0101/C",
      asset_type: "equity",
      state: "stable",
      min_channel: "fixed_rate@200ms",
    },
  ];

  it("GETs the keyless catalog endpoint — no Authorization header attached", async () => {
    const spy = mockFetchResponse({ json: PROBED_RECORDS });

    await fetchPythSymbolCatalog();

    const [url, init] = spy.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://pyth.dourolabs.app/v1/symbols");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("returns the probed record shape: integer lazer id, hermes hex or null, schedule string", async () => {
    mockFetchResponse({ json: PROBED_RECORDS });

    const records = await fetchPythSymbolCatalog();

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      pyth_lazer_id: 1,
      hermes_id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      symbol: "Crypto.BTC/USD",
      asset_type: "crypto",
      state: "stable",
      min_channel: "real_time",
    });
    expect(records[1]!.hermes_id).toBeNull();
    expect(records[1]!.schedule).toContain("America/New_York");
  });

  it("skips a malformed row instead of sinking the ~3.6k others", async () => {
    mockFetchResponse({ json: [{ symbol: "no-lazer-id" }, PROBED_RECORDS[0]] });

    const records = await fetchPythSymbolCatalog();

    expect(records).toHaveLength(1);
    expect(records[0]!.symbol).toBe("Crypto.BTC/USD");
  });

  it("throws on a non-2xx response and on a non-array body", async () => {
    // 404 — a DETERMINISTIC failure fetchWithPolicy hands back un-retried
    // (5xx/429 instead exhaust the retry budget into a FetchPolicyError).
    mockFetchResponse({ status: 404, text: "gone" });
    await expect(fetchPythSymbolCatalog()).rejects.toThrow(/Pyth symbol catalog fetch failed: 404/);

    vi.restoreAllMocks();
    mockFetchResponse({ json: { not: "an array" } });
    await expect(fetchPythSymbolCatalog()).rejects.toThrow(/non-array body/);
  });
});

describe("fetchPythProHistory", () => {
  const UDF_BODY = { s: "ok", t: [1], o: [1], h: [1], l: [1], c: [1], v: [0] };

  it("GETs /v1/{channel}/history with the UDF params and the Bearer key", async () => {
    const spy = mockFetchResponse({ json: UDF_BODY });

    const out = await fetchPythProHistory({
      channel: "fixed_rate@1000ms",
      symbol: "Crypto.BTC/USD",
      resolution: "60",
      fromSec: 1_700_000_000,
      toSec: 1_700_003_600,
      apiKey: "secret-key",
    });

    const [rawUrl, init] = spy.mock.calls[0]! as unknown as [string, RequestInit];
    const url = new URL(rawUrl);
    expect(url.origin).toBe("https://pyth.dourolabs.app");
    expect(decodeURIComponent(url.pathname)).toBe("/v1/fixed_rate@1000ms/history");
    expect(url.searchParams.get("symbol")).toBe("Crypto.BTC/USD");
    expect(url.searchParams.get("resolution")).toBe("60");
    expect(url.searchParams.get("from")).toBe("1700000000");
    expect(url.searchParams.get("to")).toBe("1700003600");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    // The UDF body passes through verbatim — bar-shape interpretation stays
    // with the charting consumer.
    expect(out).toEqual(UDF_BODY);
  });

  it("throws with status + body on non-2xx (the caller's Benchmarks-fallback trigger)", async () => {
    mockFetchResponse({ status: 403, text: "Not entitled: history" });

    await expect(
      fetchPythProHistory({
        channel: "fixed_rate@1000ms",
        symbol: "Crypto.BTC/USD",
        resolution: "60",
        fromSec: 0,
        toSec: 1,
        apiKey: "k",
      }),
    ).rejects.toThrow(/Pyth Pro history fetch failed: 403 Not entitled: history/);
  });
});
