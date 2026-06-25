/**
 * Unit tests for getBridgeLimits — mocks `client.simulate` (no chain).
 *
 * Pins the manually-tracked command index → field mapping for every arg
 * permutation (base / +backing / +accountId / both), so a reorder of the
 * batched view calls can't silently misassign a value.
 */
import { bcs } from "@mysten/sui/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBridgeLimits } from "../../../src/perp/fetch.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

/** A valid 32-byte account id for the per-account `personalBurned` arg. */
const ACCOUNT_ID = `0x${"a".repeat(64)}`;
const TOKEN_20B = Array.from({ length: 20 }, (_, i) => i + 1);

const u64Ret = (v: bigint) => ({ bcs: bcs.u64().serialize(v).toBytes() });
const boolRet = (v: boolean) => ({ bcs: bcs.bool().serialize(v).toBytes() });
const asCommands = (rets: Array<{ bcs: Uint8Array }>) => rets.map((r) => ({ returnValues: [r] }));

// Distinct values per field so a wrong index surfaces as a wrong assertion.
const BASE = [
  boolRet(false), // 0 paused
  u64Ret(1000n), // 1 dailyMintLimit
  u64Ret(100n), // 2 dailyMinted
  u64Ret(500n), // 3 maxMintPerTx
  u64Ret(2000n), // 4 dailyBurnLimit
  u64Ret(200n), // 5 dailyBurned
  u64Ret(600n), // 6 maxBurnPerTx
  u64Ret(50n), // 7 personalBurnCapAmount
];
const BACKING_RET = u64Ret(42n);
const PERSONAL_RET = u64Ret(7n);

const mockSimulate = (
  client: ReturnType<typeof createUnitTestClient>,
  rets: Array<{ bcs: Uint8Array }>,
) =>
  vi.spyOn(client, "simulate").mockResolvedValue({
    $kind: "Success",
    commandResults: asCommands(rets),
  } as never);

describe("getBridgeLimits", () => {
  const client = createUnitTestClient();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("base call: parses the 8 always-read views; no backing/personal", async () => {
    mockSimulate(client, BASE);

    const limits = await getBridgeLimits(client);

    expect(limits).toEqual({
      paused: false,
      dailyMintLimit: 1000n,
      dailyMinted: 100n,
      maxMintPerTx: 500n,
      dailyBurnLimit: 2000n,
      dailyBurned: 200n,
      maxBurnPerTx: 600n,
      personalBurnCapAmount: 50n,
    });
    expect(limits.backingMinted).toBeUndefined();
    expect(limits.personalBurned).toBeUndefined();
  });

  it("+backing: reads minted_for at command index 8", async () => {
    mockSimulate(client, [...BASE, BACKING_RET]);

    const limits = await getBridgeLimits(client, {
      backing: { wormholeChainId: 10002, token: TOKEN_20B },
    });

    expect(limits.backingMinted).toBe(42n);
    expect(limits.personalBurned).toBeUndefined();
    expect(limits.maxBurnPerTx).toBe(600n); // base fields still correct
  });

  it("+accountId: reads personal_burned at command index 8 (no backing)", async () => {
    mockSimulate(client, [...BASE, PERSONAL_RET]);

    const limits = await getBridgeLimits(client, { accountId: ACCOUNT_ID });

    expect(limits.personalBurned).toBe(7n);
    expect(limits.backingMinted).toBeUndefined();
    expect(limits.personalBurnCapAmount).toBe(50n);
  });

  it("both: backing at index 8, personal_burned at index 9", async () => {
    mockSimulate(client, [...BASE, BACKING_RET, PERSONAL_RET]);

    const limits = await getBridgeLimits(client, {
      accountId: ACCOUNT_ID,
      backing: { wormholeChainId: 10003, token: TOKEN_20B },
    });

    expect(limits.backingMinted).toBe(42n);
    expect(limits.personalBurned).toBe(7n);
  });

  it("reflects paused = true", async () => {
    mockSimulate(client, [boolRet(true), ...BASE.slice(1)]);

    const limits = await getBridgeLimits(client);
    expect(limits.paused).toBe(true);
  });

  it("throws when wormhole_bridge is not deployed on the network", async () => {
    const noBridge = createUnitTestClient();
    delete noBridge.config.packages.wormhole_bridge;

    await expect(getBridgeLimits(noBridge)).rejects.toThrow(/not deployed/);
  });
});
