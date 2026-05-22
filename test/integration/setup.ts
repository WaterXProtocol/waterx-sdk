/**
 * Integration trader helpers (`pnpm test:integration`). v3 `WaterXClient` + canonical config.
 *
 * Requires `WATERX_INTEGRATION_PRIVATE_KEY` (Bech32 byte array input) or `.integration-trader.keystore`.
 * Destructive close-one test stays opt-in (`WATERX_INTEGRATION_CLOSE_ONE_POSITION=1`).
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { loadRepoEnvFiles } from "../../scripts/load-repo-env.ts";
import type { WaterXClient } from "../../src/client.ts";
import { getAccountsByOwner } from "../../src/fetch.ts";
import { createIntegrationWaterXClient } from "../helpers/e2e/integration-client.ts";
import type { NormalizedIntegrationTxResult } from "../helpers/e2e/integration-tx-result.ts";
import { isOracleTransientFailureMessage } from "../helpers/e2e/transient-rpc.ts";
import {
  execBuiltTxWithCooldownRetriesOnClient,
  execTxOnClient,
} from "../helpers/integration/integration-exec.ts";
import {
  INTEGRATION_TRADER_KEYSTORE_PATH,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../helpers/integration/integration-trader-key.ts";
import {
  getOwnerSuiBalanceMist,
  insufficientSuiSkipReason,
  integrationMinSuiMist,
  isInsufficientSuiGasError,
} from "./helpers/integration-gas.ts";

loadRepoEnvFiles();

export let client!: WaterXClient;

export const clientInit = (async () => {
  const c = await createIntegrationWaterXClient();
  client = c;
  return c;
})();

export {
  INTEGRATION_TRADER_KEYSTORE_PATH,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
};

function normAddr(a: string): string {
  return a.replace(/^0x/i, "").toLowerCase();
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

export async function execTx(
  tx: Transaction,
  signer: Ed25519Keypair,
  opts?: { gasBudget?: number },
): Promise<NormalizedIntegrationTxResult> {
  return execTxOnClient(client, tx, signer, opts);
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

/** Skip (do not fail) when the integration wallet cannot satisfy `setGasBudget` gas selection. */
export async function execIntegrationOrSkipInsufficientSui<T>(
  ctx: IntegrationSkipContext,
  run: () => Promise<T>,
  owner?: string,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (e) {
    if (isInsufficientSuiGasError(e)) {
      ctx.skip(insufficientSuiSkipReason(e, owner));
      return undefined;
    }
    throw e;
  }
}

/**
 * Optional pre-flight SUI check — only when `WATERX_INTEGRATION_MIN_SUI_MIST` is set.
 * By default returns `{ ok: true }` so tests always attempt on-chain execution.
 */
export async function integrationHasMinSui(
  owner: string,
): Promise<{ ok: true; balance: bigint } | { ok: false; balance: bigint; min: bigint }> {
  const balance = await getOwnerSuiBalanceMist(client, owner);
  const min = integrationMinSuiMist();
  if (min === null || balance >= min) return { ok: true, balance };
  return { ok: false, balance, min };
}

export {
  getOwnerSuiBalanceMist,
  integrationGasBudget,
  integrationMinSuiMist,
  isInsufficientSuiGasError,
  insufficientSuiSkipReason,
} from "./helpers/integration-gas.ts";

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
  return execBuiltTxWithCooldownRetriesOnClient(client, build, signer, {
    gasBudget: opts?.gasBudget,
    maxAttempts: opts?.maxAttempts,
    retryDelayMs: opts?.retryDelayMs,
    cooldownTickers:
      opts?.cooldownTickers ??
      (opts?.cooldownMarketIds?.length ? [opts.cooldownMarketIds[0]!] : undefined),
  });
}
