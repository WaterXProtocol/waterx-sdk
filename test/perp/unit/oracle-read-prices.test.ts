/**
 * Read executors (`read-prices.ts`) — the Lazer parsed-price POST and the
 * quote-center envelope read, with the WIRE SHAPES PINNED to the live-probed
 * responses (2026-08-19): Lazer `price` is a decimal STRING, `confidence` a
 * plain number, `feedUpdateTimestamp` µs; `formats: []` is REQUIRED in the
 * request; a 403 carries a PLAIN-TEXT entitlement body.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LazerNotEntitledError,
  readLazerPrices,
  readQuoteCenterPrices,
} from "../../../src/oracle/read-prices.ts";
import { LAZER_INFRA } from "../../../src/oracle/rules/pyth-lazer-rule.ts";

/** The live-probed `/v1/latest_price` parsed response, verbatim shape. */
const LIVE_PROBED_RESPONSE = {
  parsed: {
    timestampUs: "1787112945000000",
    priceFeeds: [
      {
        priceFeedId: 1,
        price: "6427983315951",
        exponent: -8,
        confidence: 1675236090,
        marketSession: "regular",
        feedUpdateTimestamp: 1787112945000000,
      },
    ],
  },
};

/** Live-probed 403 body — PLAIN TEXT, not JSON. */
const NOT_ENTITLED_BODY =
  "Not entitled: feed 327 (no grant accepts this feed (asset type 'fx', instrument type 'spot'))";

function mockFetchOnce(response: {
  status?: number;
  json?: unknown;
  text?: string;
}): ReturnType<typeof vi.spyOn> {
  const status = response.status ?? 200;
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => response.json,
    text: async () => response.text ?? JSON.stringify(response.json ?? ""),
  } as unknown as Response);
}

afterEach(() => vi.restoreAllMocks());

describe("readLazerPrices", () => {
  it("POSTs the pinned parsed-read request — formats: [] REQUIRED, per-feed timestamp property, Bearer key", async () => {
    const spy = mockFetchOnce({ json: LIVE_PROBED_RESPONSE });

    await readLazerPrices({ apiKey: "k", feedIds: [1, 2], network: "MAINNET" });

    const [url, init] = spy.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe(`${LAZER_INFRA.MAINNET.endpoint}/v1/latest_price`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer k",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      priceFeedIds: [1, 2],
      properties: ["price", "exponent", "confidence", "feedUpdateTimestamp", "marketSession"],
      // Empty array ≠ absent: absent is rejected; [] means parsed-only (no
      // signed blob paid for on a read path).
      formats: [],
      parsed: true,
      channel: LAZER_INFRA.MAINNET.channel,
    });
  });

  it("decodes the live-probed shape: string price × 10^exponent, numeric confidence, µs → ms", async () => {
    mockFetchOnce({ json: LIVE_PROBED_RESPONSE });

    const out = await readLazerPrices({ apiKey: "k", feedIds: [1] });

    const entry = out.get(1)!;
    expect(entry.price).toBeCloseTo(64279.83315951, 6);
    expect(entry.conf).toBeCloseTo(16.7523609, 6);
    expect(entry.publishTimeMs).toBe(1787112945000);
  });

  it("channel defaults per network (mainnet 1000ms / testnet 200ms) and accepts an override", async () => {
    const spy = mockFetchOnce({ json: LIVE_PROBED_RESPONSE });
    await readLazerPrices({ apiKey: "k", feedIds: [1] }); // network defaults MAINNET
    expect(JSON.parse(String((spy.mock.calls[0]![1] as RequestInit).body)).channel).toBe(
      "fixed_rate@1000ms",
    );

    vi.restoreAllMocks();
    const spy2 = mockFetchOnce({ json: LIVE_PROBED_RESPONSE });
    await readLazerPrices({ apiKey: "k", feedIds: [1], network: "TESTNET" });
    expect(JSON.parse(String((spy2.mock.calls[0]![1] as RequestInit).body)).channel).toBe(
      "fixed_rate@200ms",
    );

    vi.restoreAllMocks();
    const spy3 = mockFetchOnce({ json: LIVE_PROBED_RESPONSE });
    await readLazerPrices({ apiKey: "k", feedIds: [1], channel: "fixed_rate@200ms" });
    expect(JSON.parse(String((spy3.mock.calls[0]![1] as RequestInit).body)).channel).toBe(
      "fixed_rate@200ms",
    );
  });

  it("SKIPS an entry with no feedUpdateTimestamp — never timestamps it off the batch timestampUs", async () => {
    // A closed-market feed answers with no per-feed timestamp; stamping it
    // with the batch's answer time would masquerade a stale print as fresh.
    mockFetchOnce({
      json: {
        parsed: {
          timestampUs: "1787112945000000",
          priceFeeds: [
            { priceFeedId: 9, price: "100", exponent: -2, confidence: 1 }, // no feedUpdateTimestamp
            LIVE_PROBED_RESPONSE.parsed.priceFeeds[0], // id 1, fully populated
          ],
        },
      },
    });

    const out = await readLazerPrices({ apiKey: "k", feedIds: [9, 1] });

    expect(out.has(9)).toBe(false); // skipped, not batch-stamped
    expect(out.has(1)).toBe(true);
    expect(out.size).toBe(1);
  });

  it("missing confidence decodes as conf 0, not NaN", async () => {
    mockFetchOnce({
      json: {
        parsed: {
          priceFeeds: [
            { priceFeedId: 3, price: "500", exponent: -2, feedUpdateTimestamp: 1_000_000 },
          ],
        },
      },
    });

    const out = await readLazerPrices({ apiKey: "k", feedIds: [3] });

    expect(out.get(3)).toEqual({ price: 5, conf: 0, publishTimeMs: 1000 });
  });

  it("403 → LazerNotEntitledError carrying the verbatim plain-text body and the requested feed ids", async () => {
    mockFetchOnce({ status: 403, text: NOT_ENTITLED_BODY });

    const rejection = expect(readLazerPrices({ apiKey: "k", feedIds: [327, 1] })).rejects;
    await rejection.toBeInstanceOf(LazerNotEntitledError);
    await rejection.toThrow(NOT_ENTITLED_BODY);
    try {
      mockFetchOnce({ status: 403, text: NOT_ENTITLED_BODY });
      await readLazerPrices({ apiKey: "k", feedIds: [327, 1] });
    } catch (e) {
      expect((e as LazerNotEntitledError).feedIds).toEqual([327, 1]);
    }
  });

  it("propagates a 400 channel rejection with the endpoint's own wording", async () => {
    mockFetchOnce({
      status: 400,
      text: "Channel fixed_rate@200ms violates rate limit. Minimum allowed channel is 1000ms",
    });

    await expect(readLazerPrices({ apiKey: "k", feedIds: [1] })).rejects.toThrow(
      /Lazer price read failed: 400 Channel fixed_rate@200ms violates rate limit/,
    );
  });

  it("returns an empty map without fetching for an empty feed-id list", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect((await readLazerPrices({ apiKey: "k", feedIds: [] })).size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("readQuoteCenterPrices", () => {
  /** Wire-faithful `/v1/quotes/update` body (u64s as JSON integers). */
  const ENVELOPE_BODY = `{
    "intent": 1,
    "timestamp_ms": 1784800000000,
    "signature": "${"ab".repeat(64)}",
    "payload": { "items": [
      {
        "symbol": "BTCUSD", "ticker": "BTCUSDT",
        "sources": [2, 3], "method": "median",
        "price_timestamp_ms": 1784799999000,
        "price_n": 63700000000000, "price_scale": 1000000000,
        "confidence_n": 10000000000, "confidence_scale": 1000000000,
        "max_source_deviation_bps": 0, "num_sources": 2
      },
      {
        "symbol": "XAUUSD", "ticker": "XAUUSD",
        "sources": [2], "method": "median",
        "price_timestamp_ms": 1784799998000,
        "price_n": 2400000000000, "price_scale": 1000000000,
        "confidence_n": 0, "confidence_scale": 0,
        "max_source_deviation_bps": 0, "num_sources": 1
      }
    ] }
  }`;

  function mockEnvelopeFetch(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => ENVELOPE_BODY,
    } as unknown as Response);
  }

  it("reads via GET /v1/quotes/update and decodes price_n/price_scale per item", async () => {
    const spy = mockEnvelopeFetch();

    const out = await readQuoteCenterPrices({
      endpoint: "https://qc.example",
      symbols: ["BTCUSD", "XAUUSD"],
    });

    const url = new URL(String(spy.mock.calls[0]![0]));
    expect(url.pathname).toBe("/v1/quotes/update");
    expect(url.searchParams.get("symbols")).toBe("BTCUSD,XAUUSD");

    expect(out.get("BTCUSD")).toEqual({
      price: 63700,
      conf: 10,
      publishTimeMs: 1784799999000,
    });
  });

  it("a 0 scale decodes as 0 (no value), never Infinity", async () => {
    mockEnvelopeFetch();

    const out = await readQuoteCenterPrices({
      endpoint: "https://qc.example",
      symbols: ["XAUUSD"],
    });

    expect(out.get("XAUUSD")).toEqual({
      price: 2400,
      conf: 0, // confidence_scale 0 → 0, not Infinity
      publishTimeMs: 1784799998000,
    });
  });

  it("drops served-but-unrequested symbols instead of leaking the whole envelope", async () => {
    mockEnvelopeFetch();

    const out = await readQuoteCenterPrices({
      endpoint: "https://qc.example",
      symbols: ["BTCUSD"],
    });

    expect([...out.keys()]).toEqual(["BTCUSD"]);
  });

  it("returns an empty map without fetching for an empty symbol list", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    expect(
      (await readQuoteCenterPrices({ endpoint: "https://qc.example", symbols: [] })).size,
    ).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("preserves a proxy endpoint's base path (joinEndpointPath, not new URL)", async () => {
    const spy = mockEnvelopeFetch();

    await readQuoteCenterPrices({
      endpoint: "https://app.example/api/quote-center",
      symbols: ["BTCUSD"],
    });

    expect(new URL(String(spy.mock.calls[0]![0])).pathname).toBe(
      "/api/quote-center/v1/quotes/update",
    );
  });
});
