import { describe, expect, it, vi } from "vitest";

import {
  probeAddressCreditBalance,
  probeParkedBackingAssets,
  rescaleRawAmount,
  sumParkedBackingAsCreditRaw,
} from "../../../src/account/funding/balance.ts";
import { PerpClient } from "../../../src/perp/client.ts";
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

  it("rescaleRawAmount defaults the target to COLLATERAL_DECIMALS (6) for a 9-dec source", () => {
    // hypothetical 9-dec backing asset → CREDIT (6-dec) via the default target
    expect(rescaleRawAmount(1_500_000_000n, 9)).toBe(1_500_000n);
    // truncation on downscale: sub-CREDIT-unit dust is dropped, never rounded up
    expect(rescaleRawAmount(1_999n, 9)).toBe(1n);
    expect(rescaleRawAmount(999n, 9)).toBe(0n);
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

  it("sumParkedBackingAsCreditRaw rescales a hypothetical 9-dec backing asset per-row", () => {
    // mixed-decimal backing set: 6-dec USDC-like + 9-dec asset, summed into
    // 6-dec CREDIT — each row must use its own config `decimals`, not flat 6
    const sum = sumParkedBackingAsCreditRaw([
      {
        assetType: MOCK_CUSTODY_ASSET_TYPE,
        decimals: 6,
        fundsRaw: 2_000_000n, // 2.0 units
        coinsRaw: 500_000n, // 0.5 units
      },
      {
        assetType: "0x9::mock_nine_dec::MOCK_NINE_DEC",
        decimals: 9,
        fundsRaw: 3_000_000_000n, // 3.0 units
        coinsRaw: 250_000_000n, // 0.25 units
      },
    ]);
    expect(sum).toBe(5_750_000n); // 5.75 units at 6-dec CREDIT scale
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
    const client = new PerpClient("TESTNET", config, {
      oracleSource: "waterx_rule",
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    await expect(probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID)).resolves.toEqual({
      fundsRaw: 0n,
      coinsRaw: 0n,
    });
  });

  it("probeAddressCreditBalance returns funds-only row", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "getBalance").mockResolvedValue({
      balance: { addressBalance: "420000", coinBalance: "0", balance: "420000" },
    } as never);
    vi.spyOn(client, "listCoins").mockResolvedValue({ objects: [] } as never);

    await expect(probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID)).resolves.toEqual({
      fundsRaw: 420_000n,
      coinsRaw: 0n,
    });
  });

  it("probeAddressCreditBalance propagates getBalance failure (no swallow-to-zero)", async () => {
    const client = createUnitTestClient();
    vi.spyOn(client, "getBalance").mockRejectedValue(new Error("rpc down"));
    vi.spyOn(client, "listCoins").mockResolvedValue({
      objects: [{ objectId: "0x1", balance: "5000" }],
    } as never);

    // Swallowing the failure used to report fundsRaw: 0n as if authoritative,
    // letting consolidate builders construct txs that abort on-chain later.
    await expect(probeAddressCreditBalance(client, PTB_DUMMY_ACCOUNT_ID)).rejects.toThrow(
      "rpc down",
    );
  });

  it("probeParkedBackingAssets returns [] when native_custody is missing", async () => {
    const config = structuredClone(MOCK_TESTNET_CONFIG);
    delete config.packages.native_custody;
    const client = new PerpClient("TESTNET", config, {
      oracleSource: "waterx_rule",
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    await expect(probeParkedBackingAssets(client, PTB_DUMMY_ACCOUNT_ID)).resolves.toEqual([]);
  });
});
