import { bcs } from "@mysten/sui/bcs";
import { resolveRegistryAccountId } from "~predict/account.ts";
import { describe, expect, it, vi } from "vitest";

import { createMockPredictClient } from "../helpers/mock-client.ts";
import { mockCommandResults } from "../helpers/mock-simulate.ts";

function singleAddressBytes(address: string): Uint8Array {
  const vec = bcs.vector(bcs.Address).serialize([address]);
  const raw = vec instanceof Uint8Array ? vec : vec.toBytes();
  return raw.subarray(1);
}

describe("resolveRegistryAccountId", () => {
  it("parses account_id return bytes from simulate", async () => {
    const client = createMockPredictClient();
    const registryId = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const simulate = vi
      .spyOn(client, "simulate")
      .mockResolvedValue(mockCommandResults([singleAddressBytes(registryId)]));

    await expect(resolveRegistryAccountId(client, "0xaccount_object")).resolves.toBe(registryId);
    expect(simulate).toHaveBeenCalledTimes(1);
  });
});
