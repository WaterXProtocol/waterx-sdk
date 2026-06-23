import { toBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as fetchMod from "../../../src/fetch.ts";
import { appendConsolidateForSpend } from "../../../src/tx-builders.ts";
import { listMoveCalls } from "../../prediction/helpers/ptb.ts";
import { coinRef, mockConsolidateBalances } from "../helpers/consolidate-mocks.ts";
import { MOCK_CUSTODY_ASSET_TYPE } from "../helpers/fixtures/mock-testnet-config.ts";
import {
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
} from "../helpers/fixtures/ptb-test-dummies.ts";
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

function mockInternalBalance(client: ReturnType<typeof createUnitTestClient>, raw: bigint): void {
  vi.spyOn(client, "simulate").mockResolvedValue(u64Sim(raw) as never);
}

describe("getSpendableCreditBalance", () => {
  let client: ReturnType<typeof createUnitTestClient>;

  beforeEach(() => {
    client = createUnitTestClient();
    vi.restoreAllMocks();
  });

  it("sums internal slot, parked backing, and CREDIT at address", async () => {
    mockInternalBalance(client, 1_000_000n);
    mockConsolidateBalances(client, {
      backingFunds: "500000",
      creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "100000")],
    });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.internalRaw).toBe(1_000_000n);
    expect(result.pendingBackingRaw).toBe(500_000n);
    expect(result.pendingCreditAtAddressRaw).toBe(100_000n);
    expect(result.totalRaw).toBe(1_600_000n);
    expect(result.parkedBacking.length).toBeGreaterThan(0);
  });

  it("returns zeros when every probe is empty", async () => {
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client);

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result).toEqual({
      internalRaw: 0n,
      pendingBackingRaw: 0n,
      pendingCreditAtAddressRaw: 0n,
      totalRaw: 0n,
      parkedBacking: [],
    });
  });

  it("internal-only: totalRaw equals internalRaw", async () => {
    mockInternalBalance(client, 2_500_000n);
    mockConsolidateBalances(client);

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.totalRaw).toBe(2_500_000n);
    expect(result.pendingBackingRaw).toBe(0n);
    expect(result.pendingCreditAtAddressRaw).toBe(0n);
  });

  it("backing-only: totalRaw excludes internal slot", async () => {
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client, { backingFunds: "750000" });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.internalRaw).toBe(0n);
    expect(result.pendingBackingRaw).toBe(750_000n);
    expect(result.totalRaw).toBe(750_000n);
  });

  it("address CREDIT funds-only (reviewer regression read side)", async () => {
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client, { creditFunds: "500000" });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.internalRaw).toBe(0n);
    expect(result.pendingCreditAtAddressRaw).toBe(500_000n);
    expect(result.totalRaw).toBe(500_000n);
  });

  it("address CREDIT coins-only via listCoins probe", async () => {
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client, {
      creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "120000"), coinRef(PTB_DUMMY_COIN_CC, "80000")],
    });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.pendingCreditAtAddressRaw).toBe(200_000n);
    expect(result.totalRaw).toBe(200_000n);
  });

  it("totalRaw always equals component sum", async () => {
    mockInternalBalance(client, 100n);
    mockConsolidateBalances(client, {
      backingFunds: "200",
      creditFunds: "300",
      creditCoins: [coinRef(PTB_DUMMY_DEPOSIT_COIN, "400")],
    });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.totalRaw).toBe(
      result.internalRaw + result.pendingBackingRaw + result.pendingCreditAtAddressRaw,
    );
  });

  it("treats failed CREDIT getBalance as zero address CREDIT", async () => {
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client, { backingFunds: "1000" });
    vi.spyOn(client, "getBalance").mockImplementation(async ({ coinType }) => {
      if (coinType === client.creditType()) throw new Error("rpc down");
      if (coinType === MOCK_CUSTODY_ASSET_TYPE) {
        return {
          balance: { addressBalance: "1000", coinBalance: "0", balance: "1000" },
        } as never;
      }
      return { balance: { addressBalance: "0", coinBalance: "0", balance: "0" } } as never;
    });

    const result = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(result.pendingCreditAtAddressRaw).toBe(0n);
    expect(result.pendingBackingRaw).toBe(1_000n);
  });
});

describe("getSpendableCreditBalance ↔ appendConsolidateForSpend parity", () => {
  it("when internal is zero and address CREDIT funds exist, sweep unlocks totalRaw", async () => {
    const client = createUnitTestClient();
    vi.restoreAllMocks();
    mockInternalBalance(client, 0n);
    mockConsolidateBalances(client, { creditFunds: "500000" });

    const read = await fetchMod.getSpendableCreditBalance(client, PTB_DUMMY_ACCOUNT_ID);
    expect(read.internalRaw).toBe(0n);
    expect(read.totalRaw).toBe(500_000n);

    const tx = new Transaction();
    await appendConsolidateForSpend(client, tx, PTB_DUMMY_ACCOUNT_ID);
    const fns = listMoveCalls(tx).map((c) => c.function);
    expect(fns).toContain("request_deposit_from_funds");
    expect(fns).toContain("consume_deposit_direct");
    expect(fns).not.toContain("mint_from_request");
  });
});
