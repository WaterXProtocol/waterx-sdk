import type { Transaction } from "@mysten/sui/transactions";
import { expect } from "vitest";

/** Stable snapshot of a built PTB for legacy vs facade comparison. */
export function transactionData(tx: Transaction): ReturnType<Transaction["getData"]> {
  return tx.getData();
}

export function assertTransactionsEqual(
  legacy: Transaction,
  facade: Transaction,
  label?: string,
): void {
  expect(transactionData(facade), label ?? "facade PTB").toStrictEqual(transactionData(legacy));
}

export function assertTransactionArraysEqual(
  legacy: Transaction[],
  facade: Transaction[],
  label?: string,
): void {
  expect(facade.length, `${label ?? "facade"}: tx count`).toBe(legacy.length);
  for (let i = 0; i < legacy.length; i++) {
    assertTransactionsEqual(legacy[i]!, facade[i]!, label ? `${label}[${i}]` : `[${i}]`);
  }
}

export async function assertAsyncResultsEqual<T>(
  legacy: Promise<T>,
  facade: Promise<T>,
): Promise<void> {
  const [a, b] = await Promise.all([legacy, facade]);
  expect(b).toStrictEqual(a);
}

export type DualPathTxCase<C, F> = {
  name: string;
  kind?: "single" | "array";
  buildLegacy: (client: C) => Transaction | Transaction[] | Promise<Transaction | Transaction[]>;
  buildFacade: (facade: F) => Transaction | Transaction[] | Promise<Transaction | Transaction[]>;
};

export async function assertDualPathTxCase<C, F>(
  caseDef: DualPathTxCase<C, F>,
  legacyClient: C,
  facade: F,
): Promise<void> {
  const legacyResult = await caseDef.buildLegacy(legacyClient);
  const facadeResult = await caseDef.buildFacade(facade);
  if (caseDef.kind === "array") {
    assertTransactionArraysEqual(
      legacyResult as Transaction[],
      facadeResult as Transaction[],
      caseDef.name,
    );
    return;
  }
  assertTransactionsEqual(legacyResult as Transaction, facadeResult as Transaction, caseDef.name);
}
