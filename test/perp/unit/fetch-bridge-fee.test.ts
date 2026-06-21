/**
 * Unit tests for getBridgeFee — mocks `client.simulate` (no chain).
 *
 * Pins the command index → field mapping (feeAmount / wouldExecute / rate /
 * minFee) so a reorder of the batched view calls can't silently misassign a
 * value, and checks the netAmount derivation plus the would-not-execute
 * (fee ≥ amount) path.
 */
import { bcs } from "@mysten/sui/bcs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBridgeFee } from "../../../src/fetch.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const u64Ret = (v: bigint) => ({ bcs: bcs.u64().serialize(v).toBytes() });
const u128Ret = (v: bigint) => ({ bcs: bcs.u128().serialize(v).toBytes() });
const boolRet = (v: boolean) => ({ bcs: bcs.bool().serialize(v).toBytes() });
const asCommands = (rets: Array<{ bcs: Uint8Array }>) => rets.map((r) => ({ returnValues: [r] }));

const mockSimulate = (
  client: ReturnType<typeof createUnitTestClient>,
  rets: Array<{ bcs: Uint8Array }>,
) =>
  vi.spyOn(client, "simulate").mockResolvedValue({
    $kind: "Success",
    commandResults: asCommands(rets),
  } as never);

const CHAIN = 10002; // a wormhole destination chain id

describe("getBridgeFee", () => {
  const client = createUnitTestClient();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses the 4 views in order and derives netAmount", async () => {
    // 0 feeAmount, 1 wouldExecute, 2 effectiveRate (1e9-scaled), 3 effectiveMinFee
    mockSimulate(client, [u64Ret(100n), boolRet(true), u128Ret(1_000_000n), u64Ret(50n)]);

    const fee = await getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 10_000n });

    expect(fee).toEqual({
      feeAmount: 100n,
      wouldExecute: true,
      effectiveRate: 1_000_000n,
      effectiveMinFee: 50n,
      netAmount: 9_900n, // amount - feeAmount
    });
  });

  it("netAmount is 0n when the exit wouldn't execute (fee ≥ amount)", async () => {
    // a min-fee floor (200) larger than a dust amount (150) → wouldExecute false
    mockSimulate(client, [u64Ret(200n), boolRet(false), u128Ret(0n), u64Ret(200n)]);

    const fee = await getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 150n });

    expect(fee.wouldExecute).toBe(false);
    expect(fee.feeAmount).toBe(200n);
    expect(fee.netAmount).toBe(0n);
  });

  it("throws when withdrawal_queue is not deployed on the network", async () => {
    const noQueue = createUnitTestClient();
    delete noQueue.config.packages.withdrawal_queue;

    await expect(getBridgeFee(noQueue, { evmDestinationChain: CHAIN, amount: 1n })).rejects.toThrow(
      /not deployed/,
    );
  });
});
