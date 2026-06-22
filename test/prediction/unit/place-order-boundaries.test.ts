/**
 * Boundary matrix for `place_order` params the SDK forwards verbatim to chain.
 *
 * Pins WHERE each guard lives, so a broker/API regression is caught offline:
 *   - SDK pre-RPC: u64 range (`toBigInt`/`assertU64`), selection enum, market id shape.
 *   - chain `place_order`: `max_spend > 0` (EBadPayment 9), `price_cap <= 10000`
 *     (EBadPriceCap 5), `expiry_ts > now` (EBadExpiry 8).
 *   - chain `fill_order` (broker path): `filled_shares >= min_shares` (EFillBelowMin 7) —
 *     an absurd `minShares` builds a "fillable-looking" order the broker can never fill.
 *
 * The backend DTO (`@IsNumberString`) passes every value below straight through, so
 * these are exactly the payloads `POST /predict/bets/place` can hand the SDK.
 */
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";
import { placeOrder } from "~predict/prediction.ts";
import { describe, expect, it } from "vitest";

import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createMockPredictClient } from "../helpers/mock-client.ts";

const U64_MAX = (1n << 64n) - 1n;
const U64_OVERFLOW = "18446744073709551616"; // u64 max + 1, passes the backend DTO

/** Argument positions in the `place_order` MoveCall (see src/prediction/prediction.ts). */
const ARG = {
  accountId: 4,
  receiverAccountId: 5,
  maxSpend: 6,
  minShares: 9,
  priceCapBps: 10,
  expiryTs: 11,
} as const;

interface PureInput {
  $kind: string;
  Pure?: { bytes: string };
}

interface MoveCallCommand {
  $kind: string;
  MoveCall?: {
    function: string;
    arguments: Array<{ $kind: string; Input?: number }>;
  };
}

function placeOrderPureBytes(tx: Transaction, argIndex: number): Uint8Array {
  const data = tx.getData() as unknown as { commands: MoveCallCommand[]; inputs: PureInput[] };
  const call = data.commands.find(
    (c) => c.$kind === "MoveCall" && c.MoveCall?.function === "place_order",
  );
  if (!call?.MoveCall) throw new Error("place_order MoveCall not found");
  const arg = call.MoveCall.arguments[argIndex];
  if (arg?.$kind !== "Input" || arg.Input === undefined) {
    throw new Error(`argument ${argIndex} is not a Pure input`);
  }
  const input = data.inputs[arg.Input];
  if (input?.$kind !== "Pure" || !input.Pure) {
    throw new Error(`input ${arg.Input} is not Pure`);
  }
  return fromBase64(input.Pure.bytes);
}

function u64Arg(tx: Transaction, argIndex: number): bigint {
  const bytes = placeOrderPureBytes(tx, argIndex);
  expect(bytes).toHaveLength(8);
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]!);
  return value;
}

function idArgHex(tx: Transaction, argIndex: number): string {
  const bytes = placeOrderPureBytes(tx, argIndex);
  expect(bytes).toHaveLength(32);
  return "0x" + Buffer.from(bytes).toString("hex");
}

describe("place_order boundary values the SDK forwards verbatim (chain is the validator)", () => {
  const client = createMockPredictClient();

  it("maxSpend=0 builds a PTB — only chain aborts it (EBadPayment 9); no SDK/API gate", () => {
    const tx = new Transaction();
    placeOrder(client, tx, { ...minimalPlaceOrderParams(client), maxSpend: 0n });
    expect(u64Arg(tx, ARG.maxSpend)).toBe(0n);
  });

  it("priceCapBps=10001 builds a PTB — chain aborts at place (EBadPriceCap 5)", () => {
    const tx = new Transaction();
    placeOrder(client, tx, { ...minimalPlaceOrderParams(client), priceCapBps: "10001" });
    expect(u64Arg(tx, ARG.priceCapBps)).toBe(10001n);
  });

  it("expiryTs in the past builds a PTB — chain aborts at place (EBadExpiry 8)", () => {
    const tx = new Transaction();
    placeOrder(client, tx, { ...minimalPlaceOrderParams(client), expiryTs: 1n });
    expect(u64Arg(tx, ARG.expiryTs)).toBe(1n);
  });

  it("minShares=u64 max builds a PTB — broker fill always aborts EFillBelowMin(7); order rests until expiry", () => {
    const tx = new Transaction();
    placeOrder(client, tx, { ...minimalPlaceOrderParams(client), minShares: U64_MAX });
    expect(u64Arg(tx, ARG.minShares)).toBe(U64_MAX);
  });

  it("receiverAccountId defaults to the payer accountId", () => {
    const tx = new Transaction();
    placeOrder(client, tx, minimalPlaceOrderParams(client));
    expect(idArgHex(tx, ARG.receiverAccountId)).toBe(idArgHex(tx, ARG.accountId));
  });

  it("receiverAccountId is forwarded distinct from the payer (bet-sharing; chain asserts ENotAccountPosition 16)", () => {
    const tx = new Transaction();
    placeOrder(client, tx, {
      ...minimalPlaceOrderParams(client),
      receiverAccountId: PTB_DUMMY.recipient,
    });
    expect(idArgHex(tx, ARG.accountId)).toBe(PTB_DUMMY.accountId);
    expect(idArgHex(tx, ARG.receiverAccountId)).toBe(PTB_DUMMY.recipient);
  });
});

describe("u64 overflow strings are rejected pre-RPC (backend DTO does NOT catch these)", () => {
  const client = createMockPredictClient();

  // The backend `@IsNumberString({ no_symbols: true })` accepts any digit string,
  // including values above u64 max — the SDK throw below is what stops them inside
  // `PredictBetTxService.buildPlaceBet` (today it surfaces as an unhandled 500).
  it.each(["maxSpend", "minShares", "priceCapBps", "expiryTs"] as const)(
    "placeOrder rejects %s above u64 max before any moveCall",
    (field) => {
      const tx = new Transaction();
      expect(() =>
        placeOrder(client, tx, { ...minimalPlaceOrderParams(client), [field]: U64_OVERFLOW }),
      ).toThrow(/exceeds u64 max/);
    },
  );

  it.each(["-1", "1.5", "1e3", "0x10"] as const)(
    "placeOrder rejects non-decimal numeric string %j for maxSpend",
    (raw) => {
      const tx = new Transaction();
      expect(() =>
        placeOrder(client, tx, { ...minimalPlaceOrderParams(client), maxSpend: raw }),
      ).toThrow(/Invalid integer/);
    },
  );
});
