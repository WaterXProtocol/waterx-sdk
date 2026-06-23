import { toBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { describe, expect, it, vi } from "vitest";

import * as fetchMod from "../../../src/fetch.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_CUSTODY_ASSET_TYPE,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

function u64Sim(value: bigint): {
  $kind: "Success";
  commandResults: { returnValues: { bcs: string }[] }[];
} {
  return {
    $kind: "Success",
    commandResults: [{ returnValues: [{ bcs: toBase64(bcs.u64().serialize(value).toBytes()) }] }],
  };
}

describe("getSpendableCreditBalance", () => {
  it("sums internal slot, parked backing, and CREDIT at address", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "simulate").mockResolvedValue(u64Sim(1_000_000n) as never);
    vi.spyOn(client, "getBalance").mockImplementation(async ({ coinType }) => {
      if (coinType === MOCK_CREDIT_TYPE) {
        return {
          balance: { addressBalance: "0", coinBalance: "100000", balance: "100000" },
        } as never;
      }
      if (coinType === MOCK_CUSTODY_ASSET_TYPE) {
        return {
          balance: { addressBalance: "500000", coinBalance: "0", balance: "500000" },
        } as never;
      }
      return { balance: { addressBalance: "0", coinBalance: "0", balance: "0" } } as never;
    });
    vi.spyOn(client, "listCoins").mockResolvedValue({ objects: [] } as never);

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.internalRaw).toBe(1_000_000n);
    expect(result.pendingBackingRaw).toBe(500_000n);
    expect(result.pendingCreditAtAddressRaw).toBe(100_000n);
    expect(result.totalRaw).toBe(1_600_000n);
    expect(result.parkedBacking.length).toBeGreaterThan(0);
  });

  it("returns zeros when every probe is empty", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "simulate").mockResolvedValue(u64Sim(0n) as never);
    vi.spyOn(client, "getBalance").mockResolvedValue({
      balance: { addressBalance: "0", coinBalance: "0", balance: "0" },
    } as never);
    vi.spyOn(client, "listCoins").mockResolvedValue({ objects: [] } as never);

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result).toEqual({
      internalRaw: 0n,
      pendingBackingRaw: 0n,
      pendingCreditAtAddressRaw: 0n,
      totalRaw: 0n,
      parkedBacking: [],
    });
  });
});
