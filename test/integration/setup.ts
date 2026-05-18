/**
 * Testnet integration helpers (`pnpm test:integration`). See `test/README.md`.
 * Set `WATERX_INTEGRATION_CLOSE_ONE_POSITION=1` to run the opt-in “close one perp” test (default
 * off — avoids closing an e2e persistent slot; see `test/integration/helpers/e2e-persistent-state.ts`).
 */
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import {
  createTestnetConfig,
  getAccountsByOwner,
  getMarketCooldownMs,
  TESTNET_OBJECTS,
  TESTNET_TYPES,
  WaterXClient,
} from "@waterx/perp-sdk";
import dotenv from "dotenv";

import { normalizeIntegrationTxResult } from "../helpers/e2e/integration-tx-result";
import { isOracleTransientFailureMessage } from "../helpers/e2e/simulate-assertions.ts";
import { WATERX_PERP_ABORT } from "../helpers/waterx-perp-error-codes.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "../..");

/**
 * Env precedence (integration tests):
 * 1. Shell-exported vars — never overwritten by files.
 * 2. `.env.local` — overrides `.env` only for keys that were not set in the shell at process start.
 * 3. `.env` — fills remaining keys (dotenv default: do not override existing `process.env`).
 */
const envBeforeFiles: NodeJS.ProcessEnv = { ...process.env };

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const envLocalPath = path.join(repoRoot, ".env.local");
if (existsSync(envLocalPath)) {
  const parsedLocal = dotenv.parse(readFileSync(envLocalPath, "utf8"));
  for (const [key, value] of Object.entries(parsedLocal)) {
    if (!Object.hasOwn(envBeforeFiles, key)) {
      process.env[key] = value;
    }
  }
}

export const INTEGRATION_TRADER_KEYSTORE_PATH = path.join(repoRoot, ".integration-trader.keystore");

/** Full testnet config (Pyth + Supra) — same oracle path as `WaterXClient.testnet()` / e2e simulate. */
export const client = new WaterXClient(createTestnetConfig());

export { TESTNET_OBJECTS, TESTNET_TYPES };

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
    throw new Error(`No WaterX UserAccount for integration owner ${owner}`);
  }
  if (fromEnv) {
    const match = accounts.find((a) => normAddr(a.accountId) === normAddr(fromEnv));
    if (!match) {
      throw new Error(
        `WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}. ` +
          `Remove it from .env to auto-pick the first account.`,
      );
    }
    return match.accountId;
  }
  return accounts[0]!.accountId;
}

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
}

/**
 * Serialize `signAndExecute` **within this Node worker** only. With Vitest multi-fork, each worker
 * has its own queue — use `singleFork` for integration-trader (see `vitest.config.ts`) so one
 * process serializes all txs for the shared key. Read-only RPC is not serialized.
 */
let integrationSignAndExecuteChain: Promise<void> = Promise.resolve();

async function execTxUnlocked(
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
) {
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
) {
  const next = integrationSignAndExecuteChain.then(() => execTxUnlocked(tx, signer, opts));
  integrationSignAndExecuteChain = next.then(() => undefined).catch(() => undefined);
  return next;
}

export function assertSuccess(result: any) {
  const status = result.effects?.status?.status;
  if (status !== "success") {
    throw new Error(`Tx failed: ${result.effects?.status?.error}`);
  }
}

export function extractEvent(result: any, eventSubstring: string): any | undefined {
  return (result.events || []).find((e: any) => (e.type || "").includes(eventSubstring))
    ?.parsedJson;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Env floor (ms) between retries when a trading tx hits `err_cooldown_not_elapsed` (206).
 * When `cooldownMarketIds` is passed to {@link execBuiltTxWithCooldownRetries}, the effective
 * delay is `max(this, on-chain cooldown_ms + 500)` (see `getMarketCooldownMs`); if the fetch
 * fails or `cooldown_ms` is 0, falls back to `max(env, 3500)`.
 */
export function integrationTradingRetryDelayMs(): number {
  const raw = process.env.WATERX_INTEGRATION_TRADING_STEP_MS?.trim();
  if (!raw) return 3000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

async function resolveIntegrationTradingRetryDelayMs(opts?: {
  retryDelayMs?: number;
  cooldownMarketIds?: string[];
}): Promise<number> {
  if (opts?.retryDelayMs !== undefined) return opts.retryDelayMs;
  const envFloor = integrationTradingRetryDelayMs();
  if (!opts?.cooldownMarketIds?.length) return envFloor;
  try {
    const cd = await getMarketCooldownMs(client, opts.cooldownMarketIds[0]!);
    const n = Number(cd);
    if (Number.isFinite(n) && n > 0) {
      return Math.max(envFloor, n + 500);
    }
  } catch {
    /* use fallback below */
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

/**
 * Testnet Supra push oracle abort during PTB resolution — infra / pair registration, not SDK logic.
 * Matches `isOracleTransientFailureMessage` in simulate helpers for consistent skip behavior.
 */
export function isSupraOracleInfrastructureError(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return s.includes("supra_rule::feed");
}

function isOracleTransientExecError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return isOracleTransientFailureMessage(msg);
}

/** Vitest `TestContext` slice — any object with `skip` works. */
export type IntegrationSkipContext = { skip: (reason?: string) => void };

/**
 * Runs an async integration action; on testnet oracle infra / transient aggregate failures, marks
 * the test skipped instead of failing (same patterns as {@link isOracleTransientFailureMessage}
 * and Supra feed errors in simulate suites).
 *
 * @returns `undefined` when skipped (caller should `return`); otherwise the action result.
 */
export async function execIntegrationOrSkipSupra<T>(
  ctx: IntegrationSkipContext,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isSupraOracleInfrastructureError(e)) {
      ctx.skip(`Testnet Supra oracle unavailable (transient): ${msg}`);
      return undefined;
    }
    if (isOracleTransientExecError(e)) {
      ctx.skip(`Oracle feed/aggregate failed (transient): ${msg}`);
      return undefined;
    }
    throw e;
  }
}

/**
 * Build a fresh PTB each attempt (prices/oracle state must be rebuilt) and retry when the chain
 * returns `err_cooldown_not_elapsed` (per-position trading cooldown on testnet).
 *
 * Pass `cooldownMarketIds` (shared `Market` object ids) so the retry spacing matches
 * `Market.config.cooldown_ms` on chain (e.g. 60s testnet) instead of polling every few seconds.
 */
export async function execBuiltTxWithCooldownRetries(
  build: () => Promise<Transaction>,
  signer: Ed25519Keypair,
  opts?: {
    gasBudget?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    cooldownMarketIds?: string[];
  },
) {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const retryDelayMs = await resolveIntegrationTradingRetryDelayMs(opts);
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
