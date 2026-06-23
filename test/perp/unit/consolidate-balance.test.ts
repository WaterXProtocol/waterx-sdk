import { describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../../src/client.ts";
import {
  probeAddressCreditBalance,
  probeParkedBackingAssets,
  rescaleRawAmount,
  sumParkedBackingAsCreditRaw,
} from "../../../src/utils/consolidate-balance.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

describe("consolidate-balance utils", () => {
  it("rescaleRawAmount up-scales and down-scales", () => {
    expect(rescaleRawAmount(1_000_000n, 6, 6)).toBe(1_000_000n);
    expect(rescaleRawAmount(1_000_000n, 6, 9)).toBe(1_000_000_000n);
    expect(rescaleRawAmount(1_000_000_000n, 9, 6)).toBe(1_000_000n);
  });

  it("sumParkedBackingAsCreditRaw sums at 1:1 peg", () => {
    const sum = sumParkedBackingAsCreditRaw([
      {
        assetType: MOCK_CUSTODY_ASSET_TYPE,
        decimals: 6,
        fundsRaw: 2_000_000n,
        coinsRaw: 500_000n,
      },
    ]);
    expect(sum).toBe(2_500_000n);
  });

  it("probeParkedBackingAssets returns rows with non-zero funds or coins", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "getBalance").mockResolvedValue({
      balance: { addressBalance: "1000000", coinBalance: "2000000", balance: "3000000" },
    } as never);
    vi.spyOn(client, "listCoins").mockResolvedValue({
      objects: [{ objectId: "0x1", balance: "2000000" }],
    } as never);

    const rows = await probeParkedBackingAssets(client, PTB_DUMMY_ACCOUNT_ID);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.fundsRaw).toBe(1_000_000n);
    expect(rows[0]?.coinsRaw).toBe(2_000_000n);
  });

  it("probeAddressCreditBalance returns funds and coins separately", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "getBalance").mockResolvedValue({
      balance: { addressBalance: "100000", coinBalance: "200000", balance: "300000" },
    } as never);
    vi.spyOn(client, "listCoins").mockResolvedValue({
      objects: [{ objectId: "0x1", balance: "200000" }],
    } as never);

    const row = await probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(row.fundsRaw).toBe(100_000n);
    expect(row.coinsRaw).toBe(200_000n);
  });

  it("probeAddressCreditBalance returns zeros when waterx_credit is missing", async () => {
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    delete config.packages.waterx_credit;
    const client = new WaterXClient("TESTNET", config, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    await expect(probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID)).resolves.toEqual({
      fundsRaw: 0n,
      coinsRaw: 0n,
    });
  });

  it("probeParkedBackingAssets returns [] when native_custody is missing", async () => {
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    delete config.packages.native_custody;
    const client = new WaterXClient("TESTNET", config, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    await expect(probeParkedBackingAssets(client, PTB_DUMMY_ACCOUNT_ID)).resolves.toEqual([]);
  });
});
