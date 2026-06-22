/**
 * E2E: paginated WLP redeem queue.
 */
import { getRedeemRequests } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork } from "../helpers/e2e/e2e-client.ts";

describe(`read WLP redeem queue (${e2eNetwork})`, () => {
  it("getRedeemRequests returns vector page + optional cursor", async () => {
    const page = await getRedeemRequests(client, { cursor: 0n, pageSize: 20n });
    expect(Array.isArray(page.requests)).toBe(true);
    if (page.nextCursor != null) {
      const page2 = await getRedeemRequests(client, {
        cursor: page.nextCursor,
        pageSize: 10n,
      });
      expect(Array.isArray(page2.requests)).toBe(true);
    }
  }, 90_000);
});
