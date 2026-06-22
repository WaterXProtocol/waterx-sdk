import { Transaction } from "@mysten/sui/transactions";
import { mapOrderKind, mapOutcome, mapSelection, mapStatus } from "~predict/bcs.ts";
import { outcomeArg, selectionArg } from "~predict/prediction.ts";
import { assertOutcome, assertSelection } from "~predict/utils.ts";
import { describe, expect, it } from "vitest";

import { createMockPredictClient } from "../helpers/mock-client.ts";
import { listMoveCalls } from "../helpers/ptb.ts";

const VALID_SELECTIONS = ["YES", "NO"] as const;
const VALID_OUTCOMES = ["YES", "NO", "INVALID"] as const;

/** Values that must not reach the chain via selectionArg / outcomeArg. */
const INVALID_LITERALS = [
  "",
  "yes",
  "Yes",
  "no",
  "invalid",
  "YES ",
  " YES",
  "NO\n",
  "MAYBE",
  "true",
  "1",
] as const;

describe("assertSelection", () => {
  it.each(VALID_SELECTIONS)("accepts %s", (value) => {
    expect(assertSelection(value)).toBe(value);
  });

  it.each(INVALID_LITERALS)("rejects %j", (value) => {
    expect(() => assertSelection(value)).toThrow(/Invalid Selection/);
  });
});

describe("assertOutcome", () => {
  it.each(VALID_OUTCOMES)("accepts %s", (value) => {
    expect(assertOutcome(value)).toBe(value);
  });

  it.each(INVALID_LITERALS)("rejects %j", (value) => {
    expect(() => assertOutcome(value)).toThrow(/Invalid Outcome/);
  });
});

describe("selectionArg / outcomeArg (PTB encode)", () => {
  const client = createMockPredictClient();

  it.each(VALID_SELECTIONS)("selectionArg builds selection_%s for %s", (value) => {
    const tx = new Transaction();
    selectionArg(client, tx, value);
    const fn = value === "YES" ? "selection_yes" : "selection_no";
    expect(listMoveCalls(tx).at(-1)?.function).toBe(fn);
  });

  it.each(VALID_OUTCOMES)("outcomeArg builds outcome::%s helper for %s", (value) => {
    const tx = new Transaction();
    outcomeArg(client, tx, value);
    const fn = value === "YES" ? "yes" : value === "NO" ? "no" : "invalid";
    expect(listMoveCalls(tx).at(-1)?.function).toBe(fn);
  });

  it.each(["yes", "YES ", "MAYBE"] as const)("selectionArg throws on %j", (value) => {
    const tx = new Transaction();
    expect(() => selectionArg(client, tx, value as "YES")).toThrow(/Invalid Selection/);
    expect(listMoveCalls(tx)).toHaveLength(0);
  });

  it.each(["yes", "MAYBE", "invalid"] as const)("outcomeArg throws on %j", (value) => {
    const tx = new Transaction();
    expect(() => outcomeArg(client, tx, value as "YES")).toThrow(/Invalid Outcome/);
    expect(listMoveCalls(tx)).toHaveLength(0);
  });

  it("passes through pre-built TransactionArgument without validation", () => {
    const tx = new Transaction();
    const sel = selectionArg(client, tx, "NO");
    const out = outcomeArg(client, tx, "INVALID");
    const tx2 = new Transaction();
    expect(selectionArg(client, tx2, sel)).toBe(sel);
    expect(outcomeArg(client, tx2, out)).toBe(out);
    expect(listMoveCalls(tx2)).toHaveLength(0);
  });
});

describe("BCS map* enum decode (on-chain → TS)", () => {
  it.each(["open", "close"] as const)("mapOrderKind accepts lowercase %s", (kind) => {
    expect(mapOrderKind(kind)).toBe(kind.toUpperCase());
  });

  it.each(["pendingclose", "pending_close"] as const)("mapStatus accepts %s", (kind) => {
    expect(mapStatus(kind)).toBe("PENDING_CLOSE");
  });

  it.each(["", "maybe", "OPEN "] as const)("mapOrderKind rejects %j", (kind) => {
    expect(() => mapOrderKind(kind)).toThrow(/Unknown OrderKind/);
  });
});

describe("encode vs decode enum handling", () => {
  it("mapSelection normalizes on-chain casing; assertSelection requires exact literals", () => {
    expect(mapSelection("Yes")).toBe("YES");
    expect(() => assertSelection("Yes")).toThrow(/Invalid Selection/);
  });

  it("mapOutcome normalizes on-chain casing; assertOutcome requires exact literals", () => {
    expect(mapOutcome("Invalid")).toBe("INVALID");
    expect(() => assertOutcome("Invalid")).toThrow(/Invalid Outcome/);
  });

  it("both paths reject unknown variants", () => {
    expect(() => mapSelection("MAYBE")).toThrow(/Unknown Selection/);
    expect(() => assertSelection("MAYBE")).toThrow(/Invalid Selection/);
    expect(() => mapOutcome("DRAW")).toThrow(/Unknown Outcome/);
    expect(() => assertOutcome("DRAW")).toThrow(/Invalid Outcome/);
  });
});
