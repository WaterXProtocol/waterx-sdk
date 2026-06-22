import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createAccount } from "@waterx/sdk/prediction/account";
import type { PredictClient } from "@waterx/sdk/prediction/client";
import { getAccountIds, isKeeper } from "@waterx/sdk/prediction/fetch";
import type { TestContext } from "vitest";

import { ensureAccountFunded, resolveOwnerRegistryAccountId } from "./account-funding.ts";
import { createE2eClient } from "./e2e-context.ts";
import {
  hasWriteCredentials,
  loadOptionalKeeperSigner,
  loadSigner,
  readSeedDepositAmount,
} from "./env.ts";
import {
  assertSuccessfulExecution,
  registryAccountIdFromAccountCreated,
  transactionDigest,
} from "./tx-result.ts";

const SEED_FIXTURE_PATH = resolve(process.cwd(), "config/testnet-seeded.json");

interface SeedSnapshot {
  accountId?: string;
  openMarketIdHex?: string;
  claimMarketIdHex?: string;
}

export function readSeedFixture(): SeedSnapshot | undefined {
  if (!existsSync(SEED_FIXTURE_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(SEED_FIXTURE_PATH, "utf8")) as SeedSnapshot;
  } catch {
    return undefined;
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export interface IntegrationCtx {
  client: PredictClient;
  signer: Ed25519Keypair;
  ownerAddress: string;
  keeper?: Ed25519Keypair;
  keeperAddress?: string;
  /** Pre-existing or freshly-created account id (registry id, suitable for view + PTB args). */
  accountId: string;
  seed?: SeedSnapshot;
}

/**
 * Resolve the owner signer, optional keeper, and an account id (reusing an existing one when
 * possible). Throws if `SUI_PRIVATE_KEY` is not set — callers should gate with
 * `describe.skipIf(!hasWriteCredentials())`.
 */
export async function setupIntegration(): Promise<IntegrationCtx> {
  if (!hasWriteCredentials()) {
    throw new Error("SUI_PRIVATE_KEY is not set — integration tests are opt-in");
  }
  const client = await createE2eClient();
  const signer = loadSigner();
  const ownerAddress = signer.toSuiAddress();

  const explicitKeeper = loadOptionalKeeperSigner();
  let keeper: Ed25519Keypair | undefined;
  if (explicitKeeper) {
    const ok = await isKeeper(client, { keeper: explicitKeeper.toSuiAddress() });
    if (ok) keeper = explicitKeeper;
  } else {
    const ok = await isKeeper(client, { keeper: ownerAddress });
    if (ok) keeper = signer;
  }

  const seed = readSeedFixture();
  let accountId = seed?.accountId;
  if (accountId) {
    const resolved = await resolveOwnerRegistryAccountId(client, ownerAddress, accountId);
    accountId = resolved;
  }
  if (!accountId) {
    const ids = await getAccountIds(client, { owner: ownerAddress });
    accountId = ids[0];
  }
  if (!accountId) {
    // Create one.
    const tx = new Transaction();
    tx.setSender(ownerAddress);
    createAccount(client, tx, { alias: `integration-${Date.now()}` });
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
      accountId = registryAccountIdFromAccountCreated(withEvents, client.waterxAccountPackageId());
    }
    if (!accountId) throw new Error("setupIntegration: could not create or resolve account id");
  }

  // Ensure the account can pay for placeOrder (wallet USD or MOCK_USDC PSM).
  await ensureAccountFunded(client, signer, accountId, readSeedDepositAmount());

  return {
    client,
    signer,
    ownerAddress,
    keeper,
    keeperAddress: keeper?.toSuiAddress(),
    accountId,
    seed,
  };
}

/** Skip when `E2E_KEEPER_PRIVATE_KEY` / owner is not a registered on-chain keeper. */
export function requireIntegrationKeeper(
  ctx: IntegrationCtx,
  testCtx: TestContext,
): asserts ctx is IntegrationCtx & { keeper: Ed25519Keypair; keeperAddress: string } {
  if (!ctx.keeper) {
    testCtx.skip(
      true,
      "needs registered keeper — set E2E_KEEPER_PRIVATE_KEY or register SUI_PRIVATE_KEY wallet as keeper",
    );
  }
}

export type IntegrationTxBuilder = (tx: Transaction) => void;

/** Shared-object version races on public testnet (other integration tests / keeper bots). */
export function isStaleObjectError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /needs to be rebuilt/i.test(msg) ||
    /unavailable for consumption/i.test(msg) ||
    /object.*version/i.test(msg)
  );
}

/**
 * Helper: build, sign, execute, wait, re-fetch with events.
 * Rebuilds the PTB and retries on stale shared-object version errors.
 */
export async function executeAndFetch(
  client: PredictClient,
  signer: Ed25519Keypair,
  build: IntegrationTxBuilder,
  opts?: { maxAttempts?: number },
): Promise<unknown> {
  const maxAttempts = opts?.maxAttempts ?? 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const tx = new Transaction();
    build(tx);
    tx.setSender(signer.toSuiAddress());
    try {
      const result = await client.signAndExecuteTransaction({
        signer,
        transaction: tx,
        include: { effects: true, objectTypes: true, events: true },
      });
      assertSuccessfulExecution(result);
      const digest = transactionDigest(result);
      if (!digest) return result;
      await client.waitForTransaction(digest);
      return await client.grpcClient.getTransaction({ digest, include: { events: true } });
    } catch (err) {
      lastErr = err;
      if (!isStaleObjectError(err) || attempt === maxAttempts - 1) throw err;
      const backoffMs = 250 * 2 ** attempt + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw lastErr;
}
