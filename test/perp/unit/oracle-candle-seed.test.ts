/**
 * `seedLiveCandles` — the REST seed a (re)connect needs: one two-bucket,
 * `no-cache` request per (ticker, timeframe), bounded concurrency, failures
 * reported and never thrown, and each response applied to the book with the
 * evidence of when it was observed (request time minus `Age`).
 */
import { describe, expect, it } from "vitest";

import {
  CANDLE_TIMEFRAME_MS,
  LiveCandleBook,
  parseLiveCandleFrame,
  type CandlePoint,
  type LiveCandleFrame,
} from "../../../src/oracle/candles/frame.ts";
import { seedLiveCandles } from "../../../src/oracle/candles/seed.ts";

const FAST = { retries: 0, timeoutMs: 1_000 } as const;

/** The current bucket of a timeframe, so the seed's live point is "now". */
const bucketNow = (tf: keyof typeof CANDLE_TIMEFRAME_MS) =>
  Math.floor(Date.now() / CANDLE_TIMEFRAME_MS[tf]) * CANDLE_TIMEFRAME_MS[tf];

const livePoint = (tf: keyof typeof CANDLE_TIMEFRAME_MS, close = 2): CandlePoint => ({
  timestamp_ms: bucketNow(tf),
  open: 1,
  high: 3,
  low: 0.5,
  close,
  count: 7,
  state: "open",
  source: "canonical",
});
const rolledPoint = (tf: keyof typeof CANDLE_TIMEFRAME_MS): CandlePoint => ({
  timestamp_ms: bucketNow(tf) - CANDLE_TIMEFRAME_MS[tf],
  open: 1,
  high: 3,
  low: 0.5,
  close: 2,
  count: 60,
});

function streamFrame(tf: keyof typeof CANDLE_TIMEFRAME_MS, updatedAtMs: number): LiveCandleFrame {
  const frame = parseLiveCandleFrame({
    v: 1,
    symbol: "BTCUSD",
    tf,
    bucket_ms: bucketNow(tf),
    open: 1,
    high: 3,
    low: 0.5,
    close: 1.5,
    tick_count: 3,
    state: "open",
    source: "canonical",
    updated_at_ms: updatedAtMs,
  });
  if (typeof frame === "string") throw new Error(frame);
  return frame;
}

interface Call {
  url: URL;
  headers: Record<string, string>;
}

function fakeFetch(respond: (url: URL) => Response | Promise<Response>): {
  fetchImpl: typeof fetch;
  calls: Call[];
  peak: () => number;
} {
  const calls: Call[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return await respond(url);
    } finally {
      inFlight--;
    }
  }) as typeof fetch;
  return { fetchImpl, calls, peak: () => peak };
}

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

describe("seedLiveCandles", () => {
  it("asks for the two-bucket window per (ticker, tf) with include_open and no-cache, and applies live points only", async () => {
    const { fetchImpl, calls } = fakeFetch((url) => {
      const tf = url.searchParams.get("tf") as "1m" | "5m";
      return json([rolledPoint(tf), livePoint(tf)]);
    });
    const book = new LiveCandleBook();

    const result = await seedLiveCandles({
      endpoint: "https://app.example/api/qc/",
      tickers: ["BTCUSD", " ETHUSD ", "BTCUSD"],
      timeframes: ["1m", "5m"],
      book,
      headers: { "X-Internal-Key": "k" },
      fetch: { ...FAST, fetchImpl },
    });

    expect(result).toEqual({ requests: 4, applied: 4, reasserted: 0, failures: [] });
    expect(
      calls.map((c) => `${c.url.pathname}?tf=${c.url.searchParams.get("tf")!}`).sort(),
    ).toEqual([
      "/api/qc/v1/candles/BTCUSD?tf=1m",
      "/api/qc/v1/candles/BTCUSD?tf=5m",
      "/api/qc/v1/candles/ETHUSD?tf=1m",
      "/api/qc/v1/candles/ETHUSD?tf=5m",
    ]);
    for (const { url, headers } of calls) {
      const tf = url.searchParams.get("tf") as "1m" | "5m";
      const from = Number(url.searchParams.get("from"));
      const to = Number(url.searchParams.get("to"));
      expect(from % CANDLE_TIMEFRAME_MS[tf]).toBe(0);
      expect(to - from).toBeLessThan(2 * CANDLE_TIMEFRAME_MS[tf]); // never a wide window
      expect(url.searchParams.get("include_open")).toBe("true");
      expect(url.searchParams.has("limit")).toBe(false);
      expect(headers).toMatchObject({ "Cache-Control": "no-cache", "X-Internal-Key": "k" });
    }
    expect(book.bar("ETHUSD", "5m")).toMatchObject({ close: 2, tick_count: 7, updated_at_ms: 0 });
    expect(book.bars()).toHaveLength(4); // the rolled points were not applied
  });

  it("never rejects: a failed request is reported and the others still seed", async () => {
    const { fetchImpl } = fakeFetch((url) => {
      if (url.pathname.endsWith("/ETHUSD")) return new Response("nope", { status: 503 });
      if (url.pathname.endsWith("/SOLUSD")) throw new TypeError("fetch failed");
      if (url.pathname.endsWith("/XRPUSD")) return json({ error: "not an array" });
      return json([livePoint("1m")]);
    });
    const book = new LiveCandleBook();

    const result = await seedLiveCandles({
      endpoint: "http://qc.example",
      tickers: ["BTCUSD", "ETHUSD", "SOLUSD", "XRPUSD"],
      timeframes: ["1m", "2m" as never],
      book,
      fetch: { ...FAST, fetchImpl },
    });

    expect(result.requests).toBe(8);
    expect(result.applied).toBe(1);
    expect(result.failures.map((f) => `${f.ticker}:${f.timeframe}`).sort()).toEqual([
      "BTCUSD:2m",
      "ETHUSD:1m",
      "ETHUSD:2m",
      "SOLUSD:1m",
      "SOLUSD:2m",
      "XRPUSD:1m",
      "XRPUSD:2m",
    ]);
    expect(
      result.failures.find((f) => f.ticker === "ETHUSD" && f.timeframe === "1m")?.error,
    ).toMatch(/503/);
    expect(book.bar("BTCUSD", "1m")).toBeDefined();
  });

  it("bounds the requests in flight", async () => {
    const { fetchImpl, peak } = fakeFetch(() => json([]));
    const tickers = Array.from({ length: 12 }, (_, i) => `T${String(i)}USD`);
    const result = await seedLiveCandles({
      endpoint: "http://qc.example",
      tickers,
      book: new LiveCandleBook(),
      concurrency: 3,
      fetch: { ...FAST, fetchImpl },
    });
    expect(result.requests).toBe(72); // 12 tickers × all six timeframes
    expect(peak()).toBeLessThanOrEqual(3);
    expect(peak()).toBeGreaterThan(1);
  });

  it("a fresh seed re-asserts a suspect bar with the server's values", async () => {
    const { fetchImpl } = fakeFetch(() => json([livePoint("1m", 2.5)]));
    const book = new LiveCandleBook();
    book.apply(streamFrame("1m", Date.now() - 5_000));
    book.markSuspect(["BTCUSD"]);
    expect(book.bar("BTCUSD", "1m")).toBeUndefined();

    const result = await seedLiveCandles({
      endpoint: "http://qc.example",
      tickers: ["BTCUSD"],
      timeframes: ["1m"],
      book,
      fetch: { ...FAST, fetchImpl },
    });

    expect(result).toMatchObject({ applied: 0, reasserted: 1 });
    expect(book.bar("BTCUSD", "1m")?.close).toBe(2.5);
  });

  it("a response a cache says is OLDER than the suspect mark (Age) re-asserts nothing", async () => {
    const { fetchImpl } = fakeFetch(() => json([livePoint("1m")], { Age: "30" }));
    const book = new LiveCandleBook();
    book.apply(streamFrame("1m", Date.now() - 5_000));
    book.markSuspect(["BTCUSD"]);

    const result = await seedLiveCandles({
      endpoint: "http://qc.example",
      tickers: ["BTCUSD"],
      timeframes: ["1m"],
      book,
      fetch: { ...FAST, fetchImpl },
    });

    expect(result).toMatchObject({ applied: 0, reasserted: 0, failures: [] });
    expect(book.bar("BTCUSD", "1m")).toBeUndefined(); // still hidden
  });
});
