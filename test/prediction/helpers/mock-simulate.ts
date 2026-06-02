import type { PredictClient } from "~predict/client.ts";
import { vi, type Mock } from "vitest";

/** Matches `PredictClient#simulate` when `include: { commandResults: true }`. */
export type MockSimulateResult = Awaited<ReturnType<PredictClient["simulate"]>>;

export type MockSimulateFn = PredictClient["simulate"];

/** Vitest mock with the correct `PredictClient#simulate` signature. */
export function stubSimulateResolved(result: MockSimulateResult): Mock<MockSimulateFn> {
  return vi.fn<MockSimulateFn>().mockResolvedValue(result);
}

function mockSuccessResult(
  returnBytes: Uint8Array[],
  mapBcs: (bcs: Uint8Array) => number[] | Uint8Array,
): MockSimulateResult {
  return {
    $kind: "Transaction",
    commandResults: [
      {
        returnValues: returnBytes.map((bcs) => ({ bcs: mapBcs(bcs) })),
        mutatedReferences: [],
      },
    ],
  } as unknown as MockSimulateResult;
}

/** Build a `simulateTransaction` result with one command and N return values (v2 shape). */
export function mockCommandResults(returnBytes: Uint8Array[]): MockSimulateResult {
  return mockSuccessResult(returnBytes, (bcs) => Array.from(bcs));
}

/** Same as mockCommandResults but keeps `bcs` as Uint8Array (some RPC paths return typed arrays). */
export function mockCommandResultsUint8(returnBytes: Uint8Array[]): MockSimulateResult {
  return mockSuccessResult(returnBytes, (bcs) => bcs);
}

/** Simulate result with no return values for command 0. */
export function mockEmptyCommandResults(): MockSimulateResult {
  return {
    $kind: "Transaction",
    commandResults: [{ returnValues: [], mutatedReferences: [] }],
  } as unknown as MockSimulateResult;
}

/** Legacy simulate shape (`results[0].returnValues[i][0]`). */
export function mockLegacyResults(returnBytes: Uint8Array[]): MockSimulateResult {
  return {
    results: [
      {
        returnValues: returnBytes.map((bytes) => [Array.from(bytes)]),
      },
    ],
  } as unknown as MockSimulateResult;
}

export function mockFailedTransaction(message = "simulation failed"): MockSimulateResult {
  return {
    $kind: "FailedTransaction",
    FailedTransaction: { status: { error: { message } } },
  } as unknown as MockSimulateResult;
}
