#!/usr/bin/env tsx
/**
 * Create wxa accounts for every entry in stress-wallets.json (skips owners that already have one).
 * Loads signers from the local Sui CLI keystore by matching `owner` address.
 *
 * Usage:
 *   pnpm predict:bootstrap-stress-accounts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createAccount } from "@waterx/perp-sdk/prediction/account";
import { getAccountIds } from "@waterx/perp-sdk/prediction/fetch";

import { resolveOwnerRegistryAccountId } from "../helpers/account-funding.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { resolveStressSigner, type StressWalletRow } from "../helpers/resolve-stress-signer.ts";
import {
  assertSuccessfulExecution,
  registryAccountIdFromAccountCreated,
  transactionDigest,
} from "../helpers/tx-result.ts";

const WALLETS_FILE = resolve(process.cwd(), "config/wallets.json");

function readWalletRows(): StressWalletRow[] {
  const parsed = JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${WALLETS_FILE}: root must be a JSON array`);
  return parsed as StressWalletRow[];
}

function writeWalletRows(rows: StressWalletRow[]): void {
  writeFileSync(WALLETS_FILE, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

async function ensureAccountForWallet(
  row: StressWalletRow,
  signer: Ed25519Keypair,
): Promise<string> {
  const client = await createE2eClient();
  const owner = signer.toSuiAddress();
  const expectedOwner = row.owner?.toLowerCase();
  if (expectedOwner && expectedOwner !== owner.toLowerCase()) {
    throw new Error(`${row.label ?? owner}: keystore address ${owner} != config owner ${row.owner}`);
  }

  const existing = await resolveOwnerRegistryAccountId(client, owner, row.accountId);
  if (existing) {
    console.log(`  reuse ${row.label ?? owner}: ${existing}`);
    return existing;
  }

  const alias = row.label?.trim() || `stress-${owner.slice(2, 10)}`;
  const tx = new Transaction();
  tx.setSender(owner);
  createAccount(client, tx, { alias });
  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, objectTypes: true, events: true },
  });
  assertSuccessfulExecution(result);
  const digest = transactionDigest(result);
  if (digest) {
    await client.waitForTransaction(digest);
    const withEvents = await client.grpcClient.getTransaction({
      digest,
      include: { events: true },
    });
    const accountId = registryAccountIdFromAccountCreated(
      withEvents,
      client.waterxAccountPackageId(),
    );
    if (accountId) {
      console.log(`  created ${row.label ?? owner}: ${accountId} (${digest})`);
      return accountId;
    }
  }

  const ids = await getAccountIds(client, { owner });
  if (ids[0]) {
    console.log(`  created ${row.label ?? owner}: ${ids[0]} (from registry)`);
    return ids[0];
  }
  throw new Error(`${row.label ?? owner}: createAccount succeeded but no account id found`);
}

async function main(): Promise<void> {
  const rows = readWalletRows();
  if (rows.length === 0) throw new Error("config/wallets.json is empty");

  console.log(`Bootstrapping ${rows.length} stress wallet account(s)…\n`);
  let updated = 0;

  for (const row of rows) {
    const signer = resolveStressSigner(row);
    const owner = signer.toSuiAddress();
    if (!row.owner) row.owner = owner;
    const accountId = await ensureAccountForWallet(row, signer);
    if (row.accountId !== accountId) {
      row.accountId = accountId;
      updated += 1;
    }
  }

  writeWalletRows(rows);
  console.log(`\nDone. Updated ${updated} accountId(s) in stress-wallets.json`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
