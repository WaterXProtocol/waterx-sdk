/** Assert PTB wiring matches `trading::execute` (base vs collateral PriceResult order). */
import type { Transaction } from "@mysten/sui/transactions";
import { expect } from "vitest";

type TxCommand = Record<string, unknown>;

function cmd(tx: Transaction): { commands: TxCommand[]; inputs: unknown[] } {
  const data = tx.getData();
  return {
    commands: (data.commands ?? []) as TxCommand[],
    inputs: data.inputs ?? [],
  };
}

export function unresolvedObjectIdFromInput(
  data: { inputs?: unknown[] },
  inputIndex: number,
): string | undefined {
  const inp = data.inputs?.[inputIndex] as Record<string, unknown> | undefined;
  if (!inp) return undefined;
  const uo = (inp as { UnresolvedObject?: { objectId?: string } }).UnresolvedObject?.objectId;
  if (typeof uo === "string") return uo;
  const imm = (
    inp as {
      Object?: { ImmOrOwnedObject?: { objectId?: string } };
    }
  ).Object?.ImmOrOwnedObject?.objectId;
  if (typeof imm === "string") return imm;
  return undefined;
}

/**
 * `trading::execute` — 8 args, last is clock; args[4]=request, [5]=base PriceResult, [6]=collateral PriceResult.
 * Price results must reference the last two `float::from_scaled_val` calls before `requestFunctionName`.
 */
export function assertTradingExecutePriceWiring(
  tx: Transaction,
  requestFunctionName: string,
): void {
  const { commands } = cmd(tx);
  const reqIdx = commands.findIndex(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === requestFunctionName,
  );
  expect(reqIdx).toBeGreaterThanOrEqual(0);

  const floatIdx = commands
    .map((c, i) =>
      (c as { MoveCall?: { function?: string } }).MoveCall?.function === "from_scaled_val" ? i : -1,
    )
    .filter((i) => i >= 0 && i < reqIdx);
  expect(floatIdx.length).toBeGreaterThanOrEqual(2);
  const baseFloatIdx = floatIdx[floatIdx.length - 2]!;
  const collFloatIdx = floatIdx[floatIdx.length - 1]!;
  expect(baseFloatIdx).toBeLessThan(collFloatIdx);

  const ex = commands.find(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "execute",
  );
  expect(ex).toBeDefined();
  const args = (ex as { MoveCall: { arguments: unknown[] } }).MoveCall.arguments;
  expect(args).toHaveLength(8);
  expect(args[4]).toEqual({
    NestedResult: [reqIdx, 0],
    $kind: "NestedResult",
  });
  expect(args[5]).toEqual({
    NestedResult: [baseFloatIdx, 0],
    $kind: "NestedResult",
  });
  expect(args[6]).toEqual({
    NestedResult: [collFloatIdx, 0],
    $kind: "NestedResult",
  });
  expect((args[7] as { Input?: unknown }).Input).toBeDefined();
}

/** For `placeOrder`: first two `from_scaled_val` are base/collateral; third is trigger before request. */
export function assertPlaceOrderExecutePriceWiring(tx: Transaction): void {
  const { commands } = cmd(tx);
  const floatIdx = commands
    .map((c, i) =>
      (c as { MoveCall?: { function?: string } }).MoveCall?.function === "from_scaled_val" ? i : -1,
    )
    .filter((i) => i >= 0);
  expect(floatIdx.length).toBeGreaterThanOrEqual(3);
  const baseFloatIdx = floatIdx[0]!;
  const collFloatIdx = floatIdx[1]!;

  const reqIdx = commands.findIndex(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "place_order_request",
  );
  expect(reqIdx).toBeGreaterThanOrEqual(0);
  expect(floatIdx[2]!).toBeLessThan(reqIdx);

  const exIdx = commands.findIndex(
    (c, i) =>
      i > reqIdx && (c as { MoveCall?: { function?: string } }).MoveCall?.function === "execute",
  );
  expect(exIdx).toBeGreaterThanOrEqual(0);
  const args = (commands[exIdx] as { MoveCall: { arguments: unknown[] } }).MoveCall.arguments;
  expect(args).toHaveLength(8);
  expect(args[4]).toEqual({
    NestedResult: [reqIdx, 0],
    $kind: "NestedResult",
  });
  expect(args[5]).toEqual({
    NestedResult: [baseFloatIdx, 0],
    $kind: "NestedResult",
  });
  expect(args[6]).toEqual({
    NestedResult: [collFloatIdx, 0],
    $kind: "NestedResult",
  });
  expect((args[7] as { Input?: unknown }).Input).toBeDefined();
}

export function assertPlaceOrderRequestShape(
  tx: Transaction,
  opts: {
    expectedMarket: string;
    collateralType: string;
    baseType: string;
    lpType: string;
  },
): void {
  const data = tx.getData();
  const commands = (data.commands ?? []) as TxCommand[];
  const place = commands.find(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "place_order_request",
  );
  const execute = commands.find(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "execute",
  );
  expect(place).toBeDefined();
  expect(execute).toBeDefined();
  const placeMc = (
    place as {
      MoveCall: { typeArguments: string[]; arguments: { Input?: number }[] };
    }
  ).MoveCall;
  const exMc = (execute as { MoveCall: { typeArguments: string[] } }).MoveCall;
  expect(placeMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  expect(exMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  const marketArgInput = placeMc.arguments[2]?.Input;
  expect(marketArgInput).toBeDefined();
  const oid = unresolvedObjectIdFromInput(data, marketArgInput!);
  expect(oid).toBe(opts.expectedMarket);
}

export function assertCancelOrderRequestShape(
  tx: Transaction,
  opts: {
    expectedMarket: string;
    collateralType: string;
    baseType: string;
    lpType: string;
  },
): void {
  const data = tx.getData();
  const commands = (data.commands ?? []) as TxCommand[];
  const cancel = commands.find(
    (c) =>
      (c as { MoveCall?: { function?: string } }).MoveCall?.function === "cancel_order_request",
  );
  const execute = commands.find(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "execute",
  );
  expect(cancel).toBeDefined();
  expect(execute).toBeDefined();
  const cancelMc = (
    cancel as {
      MoveCall: { typeArguments: string[]; arguments: { Input?: number }[] };
    }
  ).MoveCall;
  const exMc = (execute as { MoveCall: { typeArguments: string[] } }).MoveCall;
  expect(cancelMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  expect(exMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  const marketArgInput = cancelMc.arguments[2]?.Input;
  expect(marketArgInput).toBeDefined();
  const oid = unresolvedObjectIdFromInput(data, marketArgInput!);
  expect(oid).toBe(opts.expectedMarket);
}

/** `match_orders` wires base then collateral PriceResult (indices after shared-object args). */
export function assertMatchOrdersPriceWiring(tx: Transaction): void {
  const { commands } = cmd(tx);
  const matchIdx = commands.findIndex(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "match_orders",
  );
  expect(matchIdx).toBeGreaterThanOrEqual(0);
  const floatIdx = commands
    .map((c, i) =>
      (c as { MoveCall?: { function?: string } }).MoveCall?.function === "from_scaled_val" ? i : -1,
    )
    .filter((i) => i >= 0 && i < matchIdx);
  expect(floatIdx.length).toBeGreaterThanOrEqual(2);
  const baseFloatIdx = floatIdx[floatIdx.length - 2]!;
  const collFloatIdx = floatIdx[floatIdx.length - 1]!;

  const ex = commands[matchIdx];
  const args = (ex as { MoveCall: { arguments: unknown[] } }).MoveCall.arguments;
  expect(args[5]).toEqual({ NestedResult: [baseFloatIdx, 0], $kind: "NestedResult" });
  expect(args[6]).toEqual({ NestedResult: [collFloatIdx, 0], $kind: "NestedResult" });
}

export function assertOpenPositionTypesAndMarket(
  tx: Transaction,
  opts: {
    expectedMarket: string;
    collateralType: string;
    baseType: string;
    lpType: string;
  },
): void {
  const data = tx.getData();
  const commands = (data.commands ?? []) as TxCommand[];
  const open = commands.find(
    (c) =>
      (c as { MoveCall?: { function?: string } }).MoveCall?.function === "open_position_request",
  );
  const execute = commands.find(
    (c) => (c as { MoveCall?: { function?: string } }).MoveCall?.function === "execute",
  );
  expect(open).toBeDefined();
  expect(execute).toBeDefined();
  const openMc = (
    open as {
      MoveCall: { typeArguments: string[]; arguments: { Input?: number }[] };
    }
  ).MoveCall;
  const exMc = (execute as { MoveCall: { typeArguments: string[] } }).MoveCall;
  expect(openMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  expect(exMc.typeArguments).toEqual([opts.collateralType, opts.baseType, opts.lpType]);
  const marketArgInput = openMc.arguments[2]?.Input;
  expect(marketArgInput).toBeDefined();
  const oid = unresolvedObjectIdFromInput(data, marketArgInput!);
  expect(oid).toBe(opts.expectedMarket);
}
