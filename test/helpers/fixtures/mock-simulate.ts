import { vi } from "vitest";

import type { WaterXClient } from "../../../src/client.ts";

type ReturnValue = { bcs?: Uint8Array; value?: { bcs?: Uint8Array } };

export function mockSimulateReturn(
  client: WaterXClient,
  returnValues: ReturnValue[],
  opts: { commandIndex?: number; kind?: "Success" | "FailedTransaction"; error?: string } = {},
) {
  const cmdIdx = opts.commandIndex ?? 0;
  if (opts.kind === "FailedTransaction") {
    return vi.spyOn(client, "simulate").mockResolvedValue({
      $kind: "FailedTransaction",
      FailedTransaction: { status: { error: { message: opts.error ?? "abort" } } },
    } as never);
  }
  const commands = [{ returnValues }];
  return vi.spyOn(client, "simulate").mockResolvedValue({
    $kind: "Success",
    commandResults: commands,
  } as never);
}

/** Paginated view helpers (`getMarketOrders`, etc.) read index 0 + 1. */
export function mockSimulatePaged(
  client: WaterXClient,
  primary: Uint8Array,
  cursor?: Uint8Array | null,
) {
  const returns: ReturnValue[] = [{ bcs: primary }];
  if (cursor !== undefined) {
    returns.push(cursor === null ? {} : { bcs: cursor });
  } else {
    returns.push({});
  }
  return mockSimulateReturn(client, returns);
}

/** Same as `mockSimulatePaged` but nests BCS under `value.bcs` (JSON-RPC shape). */
export function mockSimulatePagedNested(
  client: WaterXClient,
  primary: Uint8Array,
  cursor?: Uint8Array | null,
) {
  const returns: ReturnValue[] = [{ value: { bcs: primary } }];
  if (cursor !== undefined) {
    returns.push(cursor === null ? {} : { value: { bcs: cursor } });
  } else {
    returns.push({});
  }
  return mockSimulateReturn(client, returns);
}

/** Paginated helpers when `commandResults[0].returnValues` is absent. */
export function mockSimulateNoReturnValues(client: WaterXClient) {
  return vi.spyOn(client, "simulate").mockResolvedValue({
    $kind: "Success",
    commandResults: [{}],
  } as never);
}
