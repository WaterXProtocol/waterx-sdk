import { describe, expect, it } from "vitest";

import {
  expectedClaimUsdFromChain,
  settlementBaseToUsd,
} from "../helpers/settlement-claimable-scan.ts";

describe("expectedClaimUsdFromChain", () => {
  const basePosition = {
    selection: "YES" as const,
    filledShares: 50_000_000n,
    filledCost: 25_000_000n,
  };

  it("returns null when market is not resolved", () => {
    expect(expectedClaimUsdFromChain(basePosition, { resolved: false, outcome: null })).toBeNull();
  });

  it("returns filledShares as USD when selection matches YES outcome", () => {
    expect(expectedClaimUsdFromChain(basePosition, { resolved: true, outcome: "YES" })).toBe(50);
  });

  it("returns 0 when selection loses", () => {
    expect(expectedClaimUsdFromChain(basePosition, { resolved: true, outcome: "NO" })).toBe(0);
  });

  it("returns filledCost as USD on INVALID (refund)", () => {
    expect(expectedClaimUsdFromChain(basePosition, { resolved: true, outcome: "INVALID" })).toBe(
      25,
    );
  });

  it("converts settlement base units with 6 decimals", () => {
    expect(settlementBaseToUsd(1_110_000n)).toBeCloseTo(1.11, 6);
  });
});
