/**
 * E2E: error paths for fetch helpers (`WATERX_E2E_NETWORK` / --testnet).
 */
import { getPosition, isValidReferralCode, referralCodeExists } from "@waterx/perp-sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`fetch error / edge cases (${e2eNetwork} simulate)`, () => {
  it("getPosition for very unlikely position id throws or fails simulate", async () => {
    await expect(
      getPosition(client, {
        ticker: "BTCUSD",
        positionId: 999_999_999n,
        basePriceUsd: 0n,
        collateralPriceUsd: 0n,
      }),
    ).rejects.toThrow();
  }, 60_000);

  it("isValidReferralCode rejects uppercase", async () => {
    const ok = await isValidReferralCode(client, "INVALID");
    expect(ok).toBe(false);
  }, 60_000);

  it("referralCodeExists for random code", async () => {
    const exists = await referralCodeExists(client, "zzzznotacode999");
    expect(typeof exists).toBe("boolean");
  }, 60_000);
});
