import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "@waterx/sdk/prediction/client";
import { getKeeperAddresses } from "@waterx/sdk/prediction/fetch";

import { resolveAccountOwner } from "./account-owner.ts";

type SimulateResult = Awaited<ReturnType<PredictClient["simulate"]>>;

/** Resolves the owning address of an on-chain object (for admin-cap PTB simulation). */
export async function resolveObjectOwner(client: PredictClient, objectId: string): Promise<string> {
  const res = (await client.getObject(objectId)) as {
    object?: { owner?: { address?: string; AddressOwner?: string } };
    data?: { owner?: string | { AddressOwner?: string } };
    owner?: { AddressOwner?: string };
  };
  const owner =
    res.object?.owner?.address ??
    res.object?.owner?.AddressOwner ??
    (typeof res.data?.owner === "string" ? res.data.owner : res.data?.owner?.AddressOwner) ??
    res.owner?.AddressOwner;
  if (typeof owner !== "string" || !owner.startsWith("0x")) {
    throw new Error(`Could not resolve owner for object ${objectId}`);
  }
  return owner;
}

/** Sets a plausible sender for dry-run simulation when Move checks `tx_context::sender()`. */
export async function setSimulateSender(
  client: PredictClient,
  tx: Transaction,
  explicit?: string,
): Promise<void> {
  const sender =
    explicit ??
    (await getKeeperAddresses(client))[0] ??
    "0x0000000000000000000000000000000000000000000000000000000000000001";
  tx.setSenderIfNotSet(sender);
}

export async function simulateWithSender(
  client: PredictClient,
  tx: Transaction,
  explicit?: string,
) {
  await setSimulateSender(client, tx, explicit);
  return client.simulate(tx);
}

export { resolveAccountOwner, tryResolveAccountOwner } from "./account-owner.ts";

/** Dry-run with the wallet that owns `coinObjectId`. */
export async function expectSimulateSuccessAsCoinOwner(
  client: PredictClient,
  tx: Transaction,
  coinObjectId: string,
): Promise<SimulateResult> {
  const owner = await resolveObjectOwner(client, coinObjectId);
  return expectSimulateSuccess(client, tx, owner);
}

/** Dry-run with the wallet that owns `accountId` (required for account-scoped PTBs). */
export async function expectSimulateSuccessAsAccountOwner(
  client: PredictClient,
  tx: Transaction,
  accountId: string,
): Promise<SimulateResult> {
  const owner = await resolveAccountOwner(client, accountId);
  return expectSimulateSuccess(client, tx, owner);
}

export function simulateErrorMessage(result: SimulateResult): string {
  if (result.$kind !== "FailedTransaction") return "";
  const err = (result as { FailedTransaction?: { status?: { error?: { message?: string } } } })
    .FailedTransaction?.status?.error;
  return err?.message ?? JSON.stringify(err);
}

/** Dry-run must succeed (not `FailedTransaction`). */
export async function expectSimulateSuccess(
  client: PredictClient,
  tx: Transaction,
  explicit?: string,
): Promise<SimulateResult> {
  const result = await simulateWithSender(client, tx, explicit);
  if (result.$kind === "FailedTransaction") {
    throw new Error(
      `Expected simulate success, got FailedTransaction: ${simulateErrorMessage(result)}`,
    );
  }
  return result;
}

/** Dry-run must abort with `FailedTransaction`. */
export async function expectSimulateFailure(
  client: PredictClient,
  tx: Transaction,
  explicit?: string,
): Promise<SimulateResult> {
  const result = await simulateWithSender(client, tx, explicit);
  // Lazy import: keeps this module loadable outside the Vitest runner (e.g. the
  // seed script imports `resolveAccountOwner` from here via the discovery chain).
  const { expect } = await import("vitest");
  expect(result.$kind, simulateErrorMessage(result) || "expected FailedTransaction").toBe(
    "FailedTransaction",
  );
  return result;
}

/** Returns the Move abort code from a FailedTransaction message, if present. */
export function parseMoveAbortCode(message: string): number | undefined {
  const match = message.match(/abort code:\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}
