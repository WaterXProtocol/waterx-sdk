import { formatFundingInterval } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

describe("formatFundingInterval", () => {
  it("pins the wire labels FE/BE must emit byte-identically", () => {
    expect(formatFundingInterval(3_600_000)).toBe("1H");
    expect(formatFundingInterval(28_800_000)).toBe("8H");
    // Non-integer hours are preserved, not rounded.
    expect(formatFundingInterval(5_400_000)).toBe("1.5H");
    // Below one hour switches to minutes.
    expect(formatFundingInterval(1_800_000)).toBe("30M");
  });

  it("pins the edge labels the happy path does not reach", () => {
    // A market with no funding interval configured. `0 / MS_PER_HOUR` is not
    // >= 1, so it falls to the minute branch and renders "0M" — NOT "0H", and
    // not an empty string or a throw. Byte-identity with the BE means this
    // degenerate label has to match too.
    expect(formatFundingInterval(0)).toBe("0M");
    // Sub-minute-resolution intervals keep their fraction, exactly like the
    // non-integer HOUR case above — no rounding to a whole minute.
    expect(formatFundingInterval(90_000)).toBe("1.5M");
    expect(formatFundingInterval(45_000)).toBe("0.75M");
    // One millisecond under the hour boundary still renders as minutes, at
    // full f64 precision — the label is `String(n)`, with no fixed-decimal pass.
    expect(formatFundingInterval(3_599_999)).toBe("59.99998333333333M");
  });
});
