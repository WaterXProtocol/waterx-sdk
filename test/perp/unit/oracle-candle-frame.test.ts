/**
 * The live candle plane's wire contract: `parseLiveCandleFrame` (what rejects
 * a frame, what is defaulted, `void` zeroing), `compareLiveCandleFrames` (the
 * quote-center's `order_key`) and `LiveCandleBook` (order + tombstone).
 */
import { describe, expect, it } from "vitest";

import {
  CANDLE_MAX_FUTURE_DRIFT_MS,
  CANDLE_TIMEFRAME_MS,
  CANDLE_TIMEFRAMES,
  compareLiveCandleFrames,
  LiveCandleBook,
  parseLiveCandleFrame,
  type LiveCandleFrame,
} from "../../../src/oracle/candles/frame.ts";
import * as oracle from "../../../src/oracle/index.ts";
import { BUCKET_5M, NOW, rawLiveCandleFrame } from "../helpers/fixtures/candles.ts";

const parsed = (overrides: Record<string, unknown> = {}): LiveCandleFrame => {
  const frame = parseLiveCandleFrame(rawLiveCandleFrame(overrides), NOW);
  if (typeof frame === "string") throw new Error(`fixture did not parse: ${frame}`);
  return frame;
};

describe("parseLiveCandleFrame", () => {
  it("parses the quote-center's documented frame from text or an object", () => {
    const raw = rawLiveCandleFrame();
    const expected = {
      v: 1,
      symbol: "BTCUSD",
      tf: "5m",
      bucket_ms: BUCKET_5M,
      open: 82996.7079006,
      high: 83010.1,
      low: 82990.0,
      close: 83001.25,
      tick_count: 212,
      state: "open",
      source: "canonical",
      updated_at_ms: BUCKET_5M + 112_345,
    };
    expect(parseLiveCandleFrame(JSON.stringify(raw), NOW)).toEqual(expected);
    expect(parseLiveCandleFrame(raw, NOW)).toEqual(expected);
  });

  it.each([
    ["not JSON", "{nope"],
    ["an array", "[]"],
    ["v: 2", rawLiveCandleFrame({ v: 2 })],
    ["no symbol", rawLiveCandleFrame({ symbol: "" })],
    ["an unknown tf", rawLiveCandleFrame({ tf: "2m" })],
    ["an unknown state", rawLiveCandleFrame({ state: "sealed" })],
    ["an unknown source", rawLiveCandleFrame({ source: "lazer" })],
    ["a fractional bucket", rawLiveCandleFrame({ bucket_ms: BUCKET_5M + 0.5 })],
    ["a misaligned bucket", rawLiveCandleFrame({ bucket_ms: BUCKET_5M + 60_000 })],
    ["a string updated_at_ms", rawLiveCandleFrame({ updated_at_ms: "1" })],
    ["a zero open", rawLiveCandleFrame({ open: 0 })],
    ["a NaN-ish close", rawLiveCandleFrame({ close: null })],
    ["low above high", rawLiveCandleFrame({ low: 90_000 })],
  ])("%s is malformed", (_what, input) => {
    expect(parseLiveCandleFrame(input, NOW)).toBe("malformed");
  });

  it("a far-future bucket or updated_at_ms is bad_timestamp (the wedging guard)", () => {
    const future = NOW + CANDLE_MAX_FUTURE_DRIFT_MS + 60_000;
    expect(parseLiveCandleFrame(rawLiveCandleFrame({ updated_at_ms: future }), NOW)).toBe(
      "bad_timestamp",
    );
    const bucket = future - (future % CANDLE_TIMEFRAME_MS["1m"]) + CANDLE_TIMEFRAME_MS["1m"];
    expect(parseLiveCandleFrame(rawLiveCandleFrame({ tf: "1m", bucket_ms: bucket }), NOW)).toBe(
      "bad_timestamp",
    );
  });

  it("a void tombstone parses whatever prices it carries, and zeroes them", () => {
    const frame = parsed({ state: "void", open: null, high: -1, low: "x", close: 5 });
    expect(frame).toMatchObject({ state: "void", open: 0, high: 0, low: 0, close: 0 });
  });

  it("tick_count is a diagnostic: missing or invalid reads 0", () => {
    expect(parsed({ tick_count: undefined }).tick_count).toBe(0);
    expect(parsed({ tick_count: -3 }).tick_count).toBe(0);
  });

  it("every served timeframe is accepted on its own grid", () => {
    for (const tf of CANDLE_TIMEFRAMES) {
      const bucket = NOW - (NOW % CANDLE_TIMEFRAME_MS[tf]);
      expect(parsed({ tf, bucket_ms: bucket, updated_at_ms: NOW }).tf).toBe(tf);
    }
  });
});

describe("compareLiveCandleFrames — (bucket_ms, closed, updated_at_ms)", () => {
  it("orders by bucket, then closed after open/void, then production time", () => {
    const a = parsed({ updated_at_ms: BUCKET_5M + 1 });
    const later = parsed({ updated_at_ms: BUCKET_5M + 2 });
    const closed = parsed({ state: "closed", updated_at_ms: BUCKET_5M + 1 });
    const voided = parsed({ state: "void", updated_at_ms: BUCKET_5M + 3 });
    const next = parsed({ bucket_ms: BUCKET_5M + 300_000, updated_at_ms: BUCKET_5M + 300_000 });

    expect(compareLiveCandleFrames(a, later)).toBeLessThan(0);
    expect(compareLiveCandleFrames(a, a)).toBe(0);
    // closed wins over a LATER-stamped open/void frame of the same bucket
    expect(compareLiveCandleFrames(closed, later)).toBeGreaterThan(0);
    expect(compareLiveCandleFrames(closed, voided)).toBeGreaterThan(0);
    // void orders like open
    expect(compareLiveCandleFrames(voided, later)).toBeGreaterThan(0);
    // a newer bucket beats any frame of an older one
    expect(compareLiveCandleFrames(next, closed)).toBeGreaterThan(0);
  });
});

describe("LiveCandleBook", () => {
  it("keeps the newest bar per (symbol, tf); older and equal frames are stale", () => {
    const book = new LiveCandleBook();
    expect(book.apply(parsed({ updated_at_ms: BUCKET_5M + 10, close: 1 }))).toBe("applied");
    expect(book.apply(parsed({ updated_at_ms: BUCKET_5M + 5, close: 2 }))).toBe("stale");
    expect(book.apply(parsed({ updated_at_ms: BUCKET_5M + 10, close: 3 }))).toBe("stale");
    expect(book.apply(parsed({ tf: "1m", bucket_ms: BUCKET_5M, close: 4 }))).toBe("applied");
    expect(book.bar("BTCUSD", "5m")?.close).toBe(1);
    expect(book.bar("BTCUSD", "1m")?.close).toBe(4);
    expect(book.bars()).toHaveLength(2);
  });

  it("void withdraws the bar; an older replay cannot resurrect it; a newer frame can", () => {
    const book = new LiveCandleBook();
    book.apply(parsed({ updated_at_ms: BUCKET_5M + 10 }));
    expect(book.apply(parsed({ state: "void", updated_at_ms: BUCKET_5M + 20 }))).toBe("voided");
    expect(book.bar("BTCUSD", "5m")).toBeUndefined();
    expect(book.bars()).toEqual([]);
    expect(book.apply(parsed({ updated_at_ms: BUCKET_5M + 15 }))).toBe("stale");
    expect(book.bar("BTCUSD", "5m")).toBeUndefined();
    expect(book.apply(parsed({ state: "closed", updated_at_ms: BUCKET_5M + 5 }))).toBe("applied");
    expect(book.bar("BTCUSD", "5m")?.state).toBe("closed");
  });

  it("delete / clear forget pairs", () => {
    const book = new LiveCandleBook();
    book.apply(parsed());
    book.delete("BTCUSD", "5m");
    expect(book.bar("BTCUSD", "5m")).toBeUndefined();
    book.apply(parsed());
    book.clear();
    expect(book.bars()).toEqual([]);
  });
});

describe("the public surface", () => {
  it("@waterx/sdk/oracle re-exports the candle plane", () => {
    expect(oracle.openCandleStream).toBeTypeOf("function");
    expect(oracle.parseLiveCandleFrame).toBe(parseLiveCandleFrame);
    expect(oracle.LiveCandleBook).toBe(LiveCandleBook);
    expect(oracle.CANDLE_STREAM_ROUTE).toBe("v1/candles/stream");
  });
});
