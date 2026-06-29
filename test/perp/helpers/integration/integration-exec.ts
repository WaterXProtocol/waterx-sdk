/**
 * Sign+execute helpers parameterized by `PerpClient` (e2e preflight + integration setup).
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import type { PerpClient } from "../../../../src/perp/client.ts";
import { getMarketData } from "../../../../src/perp/fetch.ts";
import {
  integrationGasBudget,
  isInsufficientSuiGasError,
} from "../../integration/helpers/integration-gas.ts";
import {
  normalizeIntegrationTxResult,
  type NormalizedIntegrationTxResult,
} from "../e2e/integration-tx-result.ts";
import { isOracleTransientFailureMessage } from "../e2e/transient-rpc.ts";
import { WATERX_PERP_ABORT } from "../waterx-perp-error-codes.ts";

let signAndExecuteChain: Promise<void> = Promise.resolve();

async function execTxUnlocked(
  client: PerpClient,
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
): Promise<NormalizedIntegrationTxResult> {
  tx.setSender(signer.getPublicKey().toSuiAddress());
  tx.setGasBudget(opts?.gasBudget ?? integrationGasBudget("default"));
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

export async function execTxOnClient(
  client: PerpClient,
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
): Promise<NormalizedIntegrationTxResult> {
  const next = signAndExecuteChain.then(() => execTxUnlocked(client, tx, signer, opts));
  signAndExecuteChain = next.then(() => undefined).catch(() => undefined);
  return next;
}

export function assertIntegrationTxSuccess(result: {
  effects?: { status?: { status?: string; error?: unknown } };
}): void {
  const status = result.effects?.status?.status;
  if (status !== "success") {
    throw new Error(`Tx failed: ${JSON.stringify(result.effects?.status?.error)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function integrationTradingRetryDelayMs(): number {
  const raw = process.env.WATERX_INTEGRATION_TRADING_STEP_MS?.trim();
  if (!raw) return 3000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 3000;
}

async function resolveTradingRetryDelayMs(
  client: PerpClient,
  opts?: { retryDelayMs?: number; cooldownTickers?: readonly string[] },
): Promise<number> {
  if (opts?.retryDelayMs !== undefined) return opts.retryDelayMs;
  const envFloor = integrationTradingRetryDelayMs();
  const firstTicker = opts?.cooldownTickers?.[0];
  if (!firstTicker) return envFloor;
  try {
    const md = await getMarketData(client, { ticker: firstTicker });
    const n = Number(md.cooldown_ms);
    if (Number.isFinite(n) && n > 0) return Math.max(envFloor, n + 500);
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

export async function execBuiltTxWithCooldownRetriesOnClient(
  client: PerpClient,
  build: () => Promise<Transaction>,
  signer: Ed25519Keypair,
  opts?: {
    gasBudget?: number;
    maxAttempts?: number;
    retryDelayMs?: number;
    cooldownTickers?: readonly string[];
  },
): Promise<NormalizedIntegrationTxResult> {
  const maxAttempts = opts?.maxAttempts ?? 45;
  const retryDelayMs = await resolveTradingRetryDelayMs(client, opts);
  let last: unknown;
  for (let a = 0; a < maxAttempts; a++) {
    try {
      const tx = await build();
      return await execTxOnClient(
        client,
        tx,
        signer,
        opts?.gasBudget !== undefined ? { gasBudget: opts.gasBudget } : undefined,
      );
    } catch (e) {
      last = e;
      if (isInsufficientSuiGasError(e)) throw e;
      if (!isCooldownNotElapsedError(e)) throw e;
      if (a + 1 >= maxAttempts) throw e;
      await sleep(retryDelayMs);
    }
  }
  throw last;
}

export function classifyPreflightTxError(error: unknown): "oracle" | "sui" | "other" {
  const msg = error instanceof Error ? error.message : String(error);
  if (isOracleTransientFailureMessage(msg)) return "oracle";
  if (
    msg.includes("EStalePrice") ||
    msg.includes("assert_prices_fresh") ||
    msg.includes("Token pool price is stale")
  ) {
    return "oracle";
  }
  if (isInsufficientSuiGasError(error)) return "sui";
  return "other";
}
