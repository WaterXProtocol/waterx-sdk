import { describe, expect, it } from "vitest";

import { MOCK_TESTNET_CONFIG } from "../helpers/fixtures/mock-testnet-config.ts";

describe("native_custody config", () => {
  it("MOCK_TESTNET_CONFIG.packages.native_custody is typed and populated", () => {
    const custody = MOCK_TESTNET_CONFIG.packages.native_custody;
    expect(custody).toBeDefined();
    expect(custody?.assets.length).toBeGreaterThan(0);
    const asset = custody!.assets[0]!;
    expect(typeof asset.type).toBe("string");
    expect(typeof asset.decimal).toBe("number");
    expect(typeof asset.mint_fee_scaled).toBe("string");
    expect(typeof asset.burn_fee_scaled).toBe("string");
    expect(typeof asset.min_burn_amount).toBe("string");
  });
});
