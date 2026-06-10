import { describe, expect, it } from "vitest";

import {
  DEFAULT_STAGING_BET_USD,
  DEFAULT_STAGING_MAX_SPEND,
  readStagingBetUsd,
  stagingTestUsd,
  usdToSettlementBaseStr,
} from "../helpers/staging-amounts.ts";

describe("staging-amounts", () => {
  it("stagingTestUsd slot convention", () => {
    expect(stagingTestUsd(1)).toBe(1.11);
    expect(stagingTestUsd(2)).toBe(2.22);
    expect(stagingTestUsd(3)).toBe(3.33);
  });

  it("default staging bet is $1.11 → 1110000 base units", () => {
    expect(DEFAULT_STAGING_BET_USD).toBe(1.11);
    expect(DEFAULT_STAGING_MAX_SPEND).toBe("1110000");
    expect(usdToSettlementBaseStr(1.11)).toBe("1110000");
    expect(usdToSettlementBaseStr(2.22)).toBe("2220000");
  });

  it("readStagingBetUsd falls back without env", () => {
    expect(readStagingBetUsd()).toBe(1.11);
  });
});
