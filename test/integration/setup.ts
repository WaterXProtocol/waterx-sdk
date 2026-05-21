/**
 * Integration trader helpers (`pnpm test:integration`). v3 `WaterXClient` + canonical config.
 *
 * Requires `WATERX_INTEGRATION_PRIVATE_KEY` (Bech32 byte array input) or `.integration-trader.keystore`.
 * Destructive close-one test stays opt-in (`WATERX_INTEGRATION_CLOSE_ONE_POSITION=1`).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { loadRepoEnvFiles } from "../../scripts/load-repo-env.ts";
import type { WaterXClient } from "../../src/client.ts";
import { getAccountsByOwner, getMarketData } from "../../src/fetch.ts";
import { createIntegrationWaterXClient } from "../helpers/e2e/integration-client.ts";
import {
  normalizeIntegrationTxResult,
  type NormalizedIntegrationTxResult,
} from "../helpers/e2e/integration-tx-result.ts";
import { isOracleTransientFailureMessage } from "../helpers/e2e/simulate-assertions.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");

loadRepoEnvFiles({ repoRoot });

export const INTEGRATION_TRADER_KEYSTORE_PATH = path.join(repoRoot, ".integration-trader.keystore");

export let client!: WaterXClient;

export const clientInit = (async () => {
  const c = await createIntegrationWaterXClient();
  client = c;
  return c;
})();

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

function keypairFromSuiKeystoreEntry(encoded: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(fromBase64(encoded).slice(1));
}

export function isIntegrationTraderConfigured(): boolean {
  if (process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim()) return true;
  return existsSync(INTEGRATION_TRADER_KEYSTORE_PATH);
}

export function loadIntegrationTraderKeypair(): Ed25519Keypair {
  const fromEnv = process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim();
  if (fromEnv) {
    return Ed25519Keypair.fromSecretKey(fromEnv);
  }

  if (!existsSync(INTEGRATION_TRADER_KEYSTORE_PATH)) {
    throw new Error(
      "Integration trader key not configured. Add WATERX_INTEGRATION_PRIVATE_KEY to .env " +
        "(Bech32 suiprivkey...) or create .integration-trader.keystore at the repo root.",
    );
  }

  const keys = JSON.parse(readFileSync(INTEGRATION_TRADER_KEYSTORE_PATH, "utf8")) as string[];

  const wantAddr = process.env.WATERX_INTEGRATION_ADDRESS?.trim().toLowerCase();

  for (const entry of keys) {
    let kp: Ed25519Keypair;
    try {
      kp = keypairFromSuiKeystoreEntry(entry);
    } catch (err) {
      console.warn(
        `[integration setup] Skipping keystore entry — failed to decode: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }
    if (!wantAddr || kp.getPublicKey().toSuiAddress().toLowerCase() === wantAddr) {
      return kp;
    }
  }

  throw new Error(
    "No usable Ed25519 key in .integration-trader.keystore " +
      "(or none matching WATERX_INTEGRATION_ADDRESS).",
  );
}

export async function resolveDefaultIntegrationAccountId(trader: Ed25519Keypair): Promise<string> {
  const owner = trader.getPublicKey().toSuiAddress();
  const fromEnv = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
  const accounts = await getAccountsByOwner(client, owner);
  if (!accounts.length) {
    throw new Error(`No wxa Account for integration owner ${owner}`);
  }
  if (fromEnv) {
    const match = accounts.find((a) => normAddr(a) === normAddr(fromEnv));
    if (!match) {
      throw new Error(
        `WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}. ` +
          `Remove it from .env to auto-pick the first account.`,
      );
    }
    return match;
  }
  return accounts[0]!;
}

let integrationSignAndExecuteChain: Promise<void> = Promise.resolve();

async function execTxUnlocked(
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
): Promise<NormalizedIntegrationTxResult> {
  tx.setSender(signer.getPublicKey().toSuiAddress());
  tx.setGasBudget(opts?.gasBudget ?? 200_000_000);
  const raw = await client.grpcClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, events: true, objectTypes: true },
  });
  const result = normalizeIntegrationTxResult(raw);
  await client.grpcClient.waitForTransaction({
    digest: result.digest,
    timeout: 30_000,
  });
  return result;
}

export async function execTx(
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
): Promise<NormalizedIntegrationTxResult> {
  const next = integrationSignAndExecuteChain.then(() => execTxUnlocked(tx, signer, opts));
  integrationSignAndExecuteChain = next.then(() => undefined).catch(() => undefined);
  return next;
}

export function assertSuccess(result: {
  effects?: { status?: { status?: string; error?: unknown } };
}) {
  const status = result.effects?.status?.status;
  if (status !== "success") {
    throw new Error(`Tx failed: ${JSON.stringify(result.effects?.status?.error)}`);
  }
}

export function extractEvent(
  result: { events?: Array<{ type?: string; parsedJson?: unknown }> },
  eventSubstring: string,
): unknown | undefined {
  return (result.events || []).find((e) => (e.type ?? "").includes(eventSubstring))?.parsedJson;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function integrationTradingRetryDelayMs(): number {
  const raw = process.env.WATERX_INTEGRATION_TRADING_STEP_MS?.trim();
  if (!raw) return 3000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

async function resolveIntegrationTradingRetryDelayMs(opts?: {
  retryDelayMs?: number;
  cooldownTickers?: readonly string[];
}): Promise<number> {
  if (opts?.retryDelayMs !== undefined) return opts.retryDelayMs;
  const envFloor = integrationTradingRetryDelayMs();
  const firstTicker = opts?.cooldownTickers?.[0];
  if (!firstTicker) return envFloor;
  try {
    const md = await getMarketData(client, { ticker: firstTicker });
    const n = Number(md.cooldown_ms);
    if (Number.isFinite(n) && n > 0) {
      return Math.max(envFloor, n + 500);
    }
  } catch {
    /* fall through */
  }
  return Math.max(envFloor, 3500);
}

function isCooldownNotElapsedError(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return (
    s.includes("err_cooldown_not_elapsed") ||
    s.includes(`abort code: ${WATERX_PERP_ABORT.COOLDOWN_NOT_ELAPSED}`)
  );
}

export type IntegrationSkipContext = { skip: (reason?: string) => void };

/** On transient oracle / Pyth infra failure, skip instead of failing the integration suite. */
export async function execIntegrationOrSkipOracleTransient<T>(
  ctx: IntegrationSkipContext,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isOracleTransientFailureMessage(msg)) {
      ctx.skip(`Oracle feed/aggregate failed (transient): ${msg}`);
      return undefined;
    }
    throw e;
  }
}

/** @deprecated Use {@link execIntegrationOrSkipOracleTransient}. */
export const execIntegrationOrSkipSupra = execIntegrationOrSkipOracleTransient;

/**
 * Retry builder when Move returns `err_cooldown_not_elapsed`. Pass **`cooldownTickers`** so delay
 * follows on-chain `MarketConfig.cooldown_ms`.
 */
export async function execBuiltTxWithCooldownRetries(
  build: () => Promise<Transaction>,
  signer: Ed25519Keypair,
  opts?: {
    gasBudget?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    /** @deprecated Prefer `cooldownTickers`. */
    cooldownMarketIds?: string[];
    cooldownTickers?: readonly string[];
  },
): Promise<NormalizedIntegrationTxResult> {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const retryDelayMs = await resolveIntegrationTradingRetryDelayMs({
    retryDelayMs: opts?.retryDelayMs,
    cooldownTickers:
      opts?.cooldownTickers ??
      (opts?.cooldownMarketIds?.length ? [opts.cooldownMarketIds[0]!] : undefined),
  });
  let last: unknown;
  for (let a = 0; a < maxAttempts; a++) {
    try {
      const tx = await build();
      return await execTx(
        tx,
        signer,
        opts?.gasBudget !== undefined ? { gasBudget: opts.gasBudget } : undefined,
      );
    } catch (e) {
      last = e;
      if (!isCooldownNotElapsedError(e)) throw e;
      if (a + 1 >= maxAttempts) throw e;
      await sleep(retryDelayMs);
    }
  }
  throw last;
}
