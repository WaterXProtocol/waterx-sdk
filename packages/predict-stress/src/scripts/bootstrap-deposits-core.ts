#!/usr/bin/env tsx
/**
 * Fund wxa accounts in stress-wallets.json via wallet-USD or PSM MOCK_USDC deposit.
 * Loads signers from the local Sui CLI keystore by matching `owner` address.
 *
 * Usage:
 *   pnpm predict:bootstrap-stress-deposits
 *   E2E_STRESS_DEPOSIT_ALL=1 pnpm predict:bootstrap-stress-deposits
 *   SEED_DEPOSIT_AMOUNT=5000000 pnpm predict:bootstrap-stress-deposits
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { formatSettlementBase, getAccountSettlementBalance } from "../helpers/account-balance.ts";
import { forceDepositAllAvailable, forceDepositToAccount } from "../helpers/account-funding.ts";
import { createE2eClient } from "../helpers/e2e-context.ts";
import { optionalEnv } from "../helpers/e2e-env.ts";
import { readSeedDepositAmount } from "../helpers/env.ts";
import { resolveStressSigner, type StressWalletRow } from "../helpers/resolve-stress-signer.ts";

const WALLETS_FILE = resolve(process.cwd(), "config/wallets.json");

function readWalletRows(): StressWalletRow[] {
  const parsed = JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${WALLETS_FILE}: root must be a JSON array`);
  return parsed as StressWalletRow[];
}

function depositAllEnabled(): boolean {
  const raw = optionalEnv("E2E_STRESS_DEPOSIT_ALL");
  return raw === "1" || raw === "true";
}

async function main(): Promise<void> {
  const sweepAll = depositAllEnabled();
  const amount = readSeedDepositAmount();
  const client = await createE2eClient();
  const rows = readWalletRows();
  if (rows.length === 0) throw new Error("config/wallets.json is empty");

  console.log(
    sweepAll
      ? `Sweeping all wallet USD / MOCK_USDC into ${rows.length} account(s)…\n`
      : `Depositing ${amount} base units per account for ${rows.length} wallet(s)…\n`,
  );

  for (const row of rows) {
    if (!row.accountId?.startsWith("0x")) {
      throw new Error(`${row.label ?? "wallet"}: missing accountId — run pnpm accounts first`);
    }

    const signer = resolveStressSigner(row);
    const owner = signer.toSuiAddress();
    const label = row.label ?? owner;
    const before = await getAccountSettlementBalance(client, row.accountId);
    process.stdout.write(`  ${label} … `);

    if (sweepAll) {
      const { plan, amount: deposited } = await forceDepositAllAvailable(
        client,
        signer,
        row.accountId,
      );
      const fresh = await createE2eClient();
      const after = await getAccountSettlementBalance(fresh, row.accountId);
      console.log(
        `${plan} +${deposited} base → ${formatSettlementBase(after)} (was ${formatSettlementBase(before)})`,
      );
    } else {
      const plan = await forceDepositToAccount(client, signer, row.accountId, amount);
      const fresh = await createE2eClient();
      const after = await getAccountSettlementBalance(fresh, row.accountId);
      console.log(
        `${plan} +${amount} base → ${formatSettlementBase(after)} (was ${formatSettlementBase(before)})`,
      );
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
