/**
 * `parseCanonicalQuote` — the ONE parser for the canonical price plane, shared
 * by the REST reader (`/v1/canonical` items) and the stream client
 * (`/v1/canonical/stream` frames), which the contract makes byte-compatible.
 * Pins the wire shape from the cross-repo plan (2026-10-08): `*_scaled` are
 * u64s and must survive as exact decimal STRINGS; only the price and its time
 * can reject an `ok` quote; a non-ok quote is never rejected for its numbers.
 */
import { describe, expect, it, vi } from "vitest";

import {
  CANONICAL_DROP_REASONS,
  CANONICAL_MAX_FUTURE_DRIFT_MS,
  CanonicalPrecisionError,
  parseCanonicalQuote,
  parseCanonicalText,
} from "../../../src/oracle/canonical/frame.ts";
import { rawCanonicalQuote, rawCanonicalQuoteText } from "../helpers/fixtures/canonical.ts";

const NOW = 1_791_426_000_000;

describe("parseCanonicalQuote — the contract example", () => {
  it("decodes the BTCUSD example from raw text, *_scaled as exact strings, legs included", () => {
    const quote = parseCanonicalQuote(rawCanonicalQuoteText("BTCUSD"), NOW);
    expect(quote).toEqual({
      symbol: "BTCUSD",
      status: "ok",
      reason: "",
      price: 82996.7079006,
      price_scaled: "82996707900600",
      confidence: 24.903161963,
      confidence_scaled: "24903161963",
      timestamp_ms: 1_791_425_996_375,
      config_epoch: 1,
      weight_threshold: 1,
      outlier_tolerance: 5_000_000,
      legs: [
        {
          rule: "waterx",
          weight: 0,
          price_scaled: "82990000000000",
          ts_ms: 1_791_425_996_000,
          status: "ok",
        },
        {
          rule: "pyth_lazer",
          weight: 1,
          price_scaled: "82996707900600",
          ts_ms: 1_791_425_996_375,
          status: "ok",
        },
      ],
    });
  });

  it("a price_scaled above 2^53 survives as the exact decimal string", () => {
    const text = rawCanonicalQuoteText("BTCUSD", { price_scaled: "18446744073709551615" });
    const quote = parseCanonicalQuote(text, NOW);
    expect(typeof quote).toBe("object");
    expect((quote as { price_scaled: string }).price_scaled).toBe("18446744073709551615");
  });

  it("on a runtime without reviver source access, such a literal is REFUSED (malformed), never approximated", () => {
    // Simulate a pre-ES2023 JSON.parse: call the reviver without its `context`.
    const realParse = JSON.parse.bind(JSON);
    vi.spyOn(JSON, "parse").mockImplementation((text: string, reviver?: unknown) =>
      reviver === undefined
        ? realParse(text)
        : realParse(text, (k: string, v: unknown) =>
            (reviver as (k: string, v: unknown) => unknown)(k, v),
          ),
    );
    const text = rawCanonicalQuoteText("BTCUSD", { price_scaled: "18446744073709551615" });
    expect(parseCanonicalQuote(text, NOW)).toBe("malformed");
    expect(() => parseCanonicalText(text)).toThrow(CanonicalPrecisionError);
    // A safe literal still parses on that runtime — the fast path never needs the source.
    expect(
      (parseCanonicalQuote(rawCanonicalQuoteText("BTCUSD"), NOW) as { price_scaled: string })
        .price_scaled,
    ).toBe("82996707900600");
    vi.restoreAllMocks();
  });

  it("accepts an already-parsed object (the batch body is parsed once, items handed in)", () => {
    const quote = parseCanonicalQuote(rawCanonicalQuote("ETHUSD"), NOW);
    expect((quote as { symbol: string }).symbol).toBe("ETHUSD");
  });

  it("a non-JSON string is malformed", () => {
    expect(parseCanonicalQuote("not json", NOW)).toBe("malformed");
  });
});

describe("parseCanonicalQuote — malformed envelopes", () => {
  it.each([
    ["null", null],
    ["an array", [rawCanonicalQuote("BTCUSD")]],
    ["no symbol", rawCanonicalQuote("BTCUSD", { symbol: undefined })],
    ["empty symbol", rawCanonicalQuote("BTCUSD", { symbol: "" })],
    ["numeric status", rawCanonicalQuote("BTCUSD", { status: 1 })],
    ["a status outside the contract", rawCanonicalQuote("BTCUSD", { status: "stale" })],
  ])("%s → malformed", (_label, input) => {
    expect(parseCanonicalQuote(input, NOW)).toBe("malformed");
  });
});

describe("parseCanonicalQuote — an ok quote is rejected only on its price and its time", () => {
  it.each([
    ["missing", undefined],
    ["a string", "100"],
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
  ])("price %s → non_positive_price", (_label, price) => {
    expect(parseCanonicalQuote(rawCanonicalQuote("BTCUSD", { price }), NOW)).toBe(
      "non_positive_price",
    );
  });

  it.each([
    ["missing", undefined],
    ["a string", "1791425996375"],
    ["zero", 0],
    ["implausibly far in the future", NOW + CANONICAL_MAX_FUTURE_DRIFT_MS + 1_000],
  ])("timestamp_ms %s → bad_timestamp", (_label, timestamp_ms) => {
    expect(parseCanonicalQuote(rawCanonicalQuote("BTCUSD", { timestamp_ms }), NOW)).toBe(
      "bad_timestamp",
    );
  });

  it("a timestamp inside the drift tolerance passes", () => {
    const quote = parseCanonicalQuote(
      rawCanonicalQuote("BTCUSD", { timestamp_ms: NOW + CANONICAL_MAX_FUTURE_DRIFT_MS - 1_000 }),
      NOW,
    );
    expect((quote as { status: string }).status).toBe("ok");
  });

  it("missing diagnostics default rather than reject: confidence 0, legs [], config_epoch 0, price_scaled '0'", () => {
    const quote = parseCanonicalQuote(
      rawCanonicalQuote("BTCUSD", {
        confidence: undefined,
        confidence_scaled: undefined,
        legs: undefined,
        config_epoch: undefined,
        weight_threshold: "1",
        outlier_tolerance: null,
        price_scaled: undefined,
      }),
      NOW,
    );
    expect(quote).toMatchObject({
      status: "ok",
      confidence: 0,
      confidence_scaled: "0",
      legs: [],
      config_epoch: 0,
      weight_threshold: 0,
      outlier_tolerance: 0,
      price_scaled: "0",
    });
  });

  it("a malformed leg is defaulted field by field, never dropped", () => {
    const quote = parseCanonicalQuote(
      rawCanonicalQuote("BTCUSD", { legs: [{ rule: "waterx" }, "garbage"] }),
      NOW,
    );
    expect((quote as { legs: unknown[] }).legs).toEqual([
      { rule: "waterx", weight: 0, price_scaled: "0", ts_ms: 0, status: "" },
    ]);
  });
});

describe("parseCanonicalQuote — an unavailable quote carries its reason and is never price-validated", () => {
  const unavailable = (over: Record<string, unknown> = {}) =>
    rawCanonicalQuote("XAUTUSD", {
      status: "unavailable",
      reason: "no_canonical_evaluation",
      price: 0,
      price_scaled: 0,
      confidence: 0,
      confidence_scaled: 0,
      timestamp_ms: 0,
      ...over,
    });

  it("passes through with its reason and a zero timestamp", () => {
    expect(parseCanonicalQuote(unavailable(), NOW)).toMatchObject({
      symbol: "XAUTUSD",
      status: "unavailable",
      reason: "no_canonical_evaluation",
      price: 0,
      timestamp_ms: 0,
    });
  });

  it("a missing or empty reason reads 'unspecified' — never ''", () => {
    expect(
      (parseCanonicalQuote(unavailable({ reason: "" }), NOW) as { reason: string }).reason,
    ).toBe("unspecified");
    expect(
      (parseCanonicalQuote(unavailable({ reason: undefined }), NOW) as { reason: string }).reason,
    ).toBe("unspecified");
  });

  it("an implausible future timestamp becomes 0 rather than a drop", () => {
    const quote = parseCanonicalQuote(unavailable({ timestamp_ms: NOW + 10 * 60_000 }), NOW);
    expect((quote as { timestamp_ms: number }).timestamp_ms).toBe(0);
  });

  it("a plausible timestamp is kept (the stream guard orders on it)", () => {
    const quote = parseCanonicalQuote(unavailable({ timestamp_ms: NOW - 5 }), NOW);
    expect((quote as { timestamp_ms: number }).timestamp_ms).toBe(NOW - 5);
  });

  it("its price fields are ZEROED whatever the wire sent — a stale last value can never leak", () => {
    expect(
      parseCanonicalQuote(
        unavailable({
          price: 61234.5,
          price_scaled: 61234500000000,
          confidence: 3,
          confidence_scaled: 3000000000,
        }),
        NOW,
      ),
    ).toMatchObject({
      status: "unavailable",
      price: 0,
      price_scaled: "0",
      confidence: 0,
      confidence_scaled: "0",
    });
  });

  it("a negative price does not reject it", () => {
    expect(parseCanonicalQuote(unavailable({ price: -5 }), NOW)).toMatchObject({
      status: "unavailable",
      price: 0,
    });
  });

  it("the ok arm normalises reason to '' whatever the wire says", () => {
    const quote = parseCanonicalQuote(rawCanonicalQuote("BTCUSD", { reason: "ignored" }), NOW);
    expect((quote as { reason: string }).reason).toBe("");
  });
});

describe("CANONICAL_DROP_REASONS", () => {
  it("is the closed vocabulary consumers label metrics with", () => {
    expect(CANONICAL_DROP_REASONS).toEqual([
      "malformed",
      "non_positive_price",
      "bad_timestamp",
      "unsolicited",
      "out_of_order",
      "duplicate",
    ]);
  });
});
