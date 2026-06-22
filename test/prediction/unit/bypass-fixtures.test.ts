import { describe, expect, it } from "vitest";

import { likelyBypassFilledFixtures } from "../helpers/integration-user-journey.ts";

describe("likelyBypassFilledFixtures", () => {
  it("true when position exists but no resting open order", () => {
    expect(likelyBypassFilledFixtures({ openPositionId: 0n })).toBe(true);
  });

  it("false when open order is present", () => {
    expect(likelyBypassFilledFixtures({ openOrderId: 5n, openPositionId: 0n })).toBe(false);
  });

  it("false when neither order nor position", () => {
    expect(likelyBypassFilledFixtures({})).toBe(false);
  });
});
