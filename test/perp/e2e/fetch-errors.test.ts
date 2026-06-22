/**
 * E2E: negative fetch paths (simulate abort / decode failures).
 */
import { getPosition } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`fetch error paths (${e2eNetwork} simulate)`, () => {
  it("getPosition for very unlikely position id rejects", async () => {
    await expect(
      getPosition(client, {
        ticker: "BTCUSD",
        positionId: 999_999_999n,
        basePriceUsd: 0n,
        collateralPriceUsd: 0n,
      }),
    ).rejects.toThrow();
  }, 60_000);
});
