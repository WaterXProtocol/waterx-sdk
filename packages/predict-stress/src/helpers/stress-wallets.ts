/**
 * Multi-wallet config for staging broker stress scripts.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { ensureAccountFunded, resolveOwnerRegistryAccountId } from "./account-funding.ts";
import { createE2eClient } from "./e2e-context.ts";
import { optionalEnv } from "./e2e-env.ts";
import { loadSignerFromSecret, readSeedDepositAmount } from "./env.ts";
import type { IntegrationCtx } from "./integration-setup.ts";

export interface StressWalletEntry {
  /** Optional label for logs (default: wallet-1, wallet-2, …). */
  label?: string;
  /** `suiprivkey1…` or 0x + 64 hex seed. */
  privateKey: string;
  /** wxa registry account id for POST /predict/bets/place + on-chain place. */
  accountId: string;
  /** Optional per-wallet stake override (USD, e.g. 1.01). See `resolveStressBetUsd`. */
  betUsd?: number;
}

const DEFAULT_WALLETS_FILE = resolve(process.cwd(), "config/wallets.json");

function parseWalletEntry(raw: unknown, index: number): StressWalletEntry {
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`stress wallet[${index}]: expected object`);
  }
  const row = raw as Record<string, unknown>;
  const privateKey = String(row.privateKey ?? "").trim();
  const accountId = String(row.accountId ?? "").trim();
  if (!privateKey) throw new Error(`stress wallet[${index}]: missing privateKey`);
  if (!accountId.startsWith("0x")) {
    throw new Error(`stress wallet[${index}]: accountId must start with 0x`);
  }
  const label = row.label != null ? String(row.label).trim() : undefined;
  let betUsd: number | undefined;
  if (row.betUsd != null) {
    const n = Number(row.betUsd);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`stress wallet[${index}]: betUsd must be a positive number`);
    }
    betUsd = n;
  }
  return { label, privateKey, accountId, betUsd };
}

/** Load wallet list from `E2E_STRESS_WALLETS_FILE` or inline `E2E_STRESS_WALLETS_JSON`. */
export function loadStressWallets(): StressWalletEntry[] {
  const inline = optionalEnv("E2E_STRESS_WALLETS_JSON")?.trim();
  if (inline) {
    const parsed = JSON.parse(inline) as unknown;
    if (!Array.isArray(parsed)) throw new Error("E2E_STRESS_WALLETS_JSON must be a JSON array");
    return parsed.map((row, i) => parseWalletEntry(row, i));
  }

  const filePath = optionalEnv("E2E_STRESS_WALLETS_FILE") ?? DEFAULT_WALLETS_FILE;
  const resolved = resolve(process.cwd(), filePath);
  if (!existsSync(resolved)) {
    throw new Error(
      `stress wallets file not found: ${resolved} — copy stress-wallets.example.json and fill 8 entries`,
    );
  }
  const parsed = JSON.parse(readFileSync(resolved, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error(`${resolved}: root must be a JSON array`);
  return parsed.map((row, i) => parseWalletEntry(row, i));
}

/** Resolve signer + funded wxa account for one stress wallet (no keeper). */
export async function setupStressWallet(entry: StressWalletEntry): Promise<IntegrationCtx> {
  const client = await createE2eClient();
  const signer = loadSignerFromSecret(entry.privateKey);
  const ownerAddress = signer.toSuiAddress();
  const accountId = await resolveOwnerRegistryAccountId(client, ownerAddress, entry.accountId);
  if (!accountId) {
    throw new Error(
      `no wxa account for ${entry.label ?? ownerAddress} — check accountId or create account on-chain`,
    );
  }
  await ensureAccountFunded(client, signer, accountId, readSeedDepositAmount());

  return {
    client,
    signer,
    ownerAddress,
    accountId,
    seed: undefined,
  };
}

export function stressWalletLabel(entry: StressWalletEntry, index: number): string {
  return entry.label?.trim() || `wallet-${index + 1}`;
}
