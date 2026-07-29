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
});
