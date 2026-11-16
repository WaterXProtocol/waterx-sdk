/**
 * Live candle frames as the quote-center's `/v1/candles/stream` sends them —
 * the documented example (`docs/architecture.md`, "Live candle plane") with
 * per-test overrides. `undefined` in `overrides` removes the field.
 */

/** A 5m bucket boundary (UTC epoch-floor aligned). */
export const BUCKET_5M = 1_791_425_700_000;
/** A parse clock two buckets after that one opened. */
export const NOW = BUCKET_5M + 600_000;

export function rawLiveCandleFrame(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const frame: Record<string, unknown> = {
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
    ...overrides,
  };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete frame[key];
  }
  return frame;
}
