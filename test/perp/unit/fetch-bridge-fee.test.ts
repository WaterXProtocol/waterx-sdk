/**
 * Unit tests for getBridgeFee — mocks `client.simulate` (no chain).
 *
 * Pins the command index → field mapping (feeAmount / wouldExecute / rate /
 * minFee) so a reorder of the batched view calls can't silently misassign a
 * value, and checks the netAmount derivation plus the would-not-execute
 * (fee ≥ amount) path.
 */
import { bcs } from "@mysten/sui/bcs";
import type { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag } from "@mysten/sui/utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBridgeFee } from "../../../src/perp/fetch.ts";
import {
  MOCK_CREDIT_TYPE,
  MOCK_SUI_CREDIT,
  MOCK_TESTNET_CONFIG,
} from "../../helpers/fixtures/mock-testnet-config.ts";
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

/** Mock simulate AND hand back the PTB it was given, so the view calls can be inspected. */
const mockSimulateCapturing = (
  client: ReturnType<typeof createUnitTestClient>,
  rets: Array<{ bcs: Uint8Array }>,
): { tx?: Transaction } => {
  const captured: { tx?: Transaction } = {};
  vi.spyOn(client, "simulate").mockImplementation(async (tx) => {
    captured.tx = tx;
    return { $kind: "Success", commandResults: asCommands(rets) } as never;
  });
  return captured;
};

const viewCalls = (tx: Transaction) =>
  tx
    .getData()
    .commands.filter((c) => "MoveCall" in c && c.MoveCall)
    .map((c) => c.MoveCall!);
const objectInputIds = (tx: Transaction) =>
  tx.getData().inputs.map((input) => input.UnresolvedObject?.objectId);

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

  it("quotes the requested credit's OWN queue with its normalized type (alias or Move type)", async () => {
    const OK = [u64Ret(1n), boolRet(true), u128Ret(0n), u64Ret(0n)];
    for (const creditType of ["SUI", "sui", MOCK_SUI_CREDIT.creditType]) {
      const captured = mockSimulateCapturing(client, OK);
      await getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 10_000n, creditType });
      const calls = viewCalls(captured.tx!);
      expect(calls).toHaveLength(4);
      for (const call of calls) {
        expect(call.typeArguments, `creditType=${creditType}`).toEqual([
          normalizeStructTag(MOCK_SUI_CREDIT.creditType),
        ]);
      }
      const ids = objectInputIds(captured.tx!);
      expect(ids).toContain(MOCK_SUI_CREDIT.queue);
      expect(ids).not.toContain(MOCK_TESTNET_CONFIG.objects.withdrawal_queue.queue);
      vi.restoreAllMocks();
    }
  });

  it("defaults to the USD queue + type, and rejects an unknown credit before simulating", async () => {
    const captured = mockSimulateCapturing(client, [
      u64Ret(1n),
      boolRet(true),
      u128Ret(0n),
      u64Ret(0n),
    ]);
    await getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 10_000n });
    expect(viewCalls(captured.tx!)[0]!.typeArguments).toEqual([
      normalizeStructTag(MOCK_CREDIT_TYPE),
    ]);
    expect(objectInputIds(captured.tx!)).toContain(
      MOCK_TESTNET_CONFIG.objects.withdrawal_queue.queue,
    );

    const simulate = vi.spyOn(client, "simulate");
    simulate.mockClear();
    await expect(
      getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 1n, creditType: "DEEP" }),
    ).rejects.toThrow(/no credit stack named DEEP/);
    expect(simulate).not.toHaveBeenCalled();
  });

  it("netAmount is 0n when the exit wouldn't execute (fee ≥ amount)", async () => {
    // a min-fee floor (200) larger than a dust amount (150) → wouldExecute false
    mockSimulate(client, [u64Ret(200n), boolRet(false), u128Ret(0n), u64Ret(200n)]);

    const fee = await getBridgeFee(client, { evmDestinationChain: CHAIN, amount: 150n });

    expect(fee.wouldExecute).toBe(false);
    expect(fee.feeAmount).toBe(200n);
    expect(fee.netAmount).toBe(0n);
  });
});
