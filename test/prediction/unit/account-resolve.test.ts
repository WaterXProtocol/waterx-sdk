import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { resolveRegistryAccountId } from "~predict/account.ts";
import { describe, expect, it, vi } from "vitest";

import { TESTNET_FIXTURE_IDS } from "../fixtures/testnet-config.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";

describe("resolveRegistryAccountId", () => {
  it("simulates account::account_id and parses the registry id", async () => {
    const client = createMockPredictClient();
    const registryId = TESTNET_FIXTURE_IDS.accountRegistry;
    const simulate = vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "Success",
      commandResults: [{ returnValues: [{ bcs: bcs.Address.serialize(registryId).toBytes() }] }],
    } as never);

    const out = await resolveRegistryAccountId(client, "0xaccount_object");
    expect(out).toBe(registryId);
    expect(simulate).toHaveBeenCalledOnce();
    expect(simulate.mock.calls[0]![0]).toBeInstanceOf(Transaction);
  });
});
