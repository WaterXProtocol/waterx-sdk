import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { createAccount, deposit } from "~predict/account.ts";
import type { PredictClient } from "~predict/client.ts";
import { getAccountData, getAccountIds, isKeeper } from "~predict/fetch.ts";

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

const SEED_FIXTURE_PATH = resolve(process.cwd(), "test/prediction/fixtures/testnet-seeded.json");

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
    try {
      await getAccountData(client, { accountId });
    } catch {
      accountId = undefined;
    }
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

  // Ensure deposit so subsequent placeOrder works.
  const data = await getAccountData(client, { accountId });
  if (!data.hasData) {
    const amount = readSeedDepositAmount();
    const coins = await client.listCoins({
      owner: ownerAddress,
      coinType: client.settlementCoinType(),
    });
    const first = (coins as { objects?: { objectId?: string; balance?: string }[] }).objects?.[0];
    if (!first?.objectId) {
      throw new Error(`No settlement coin in wallet ${ownerAddress} — cannot deposit`);
    }
    const tx = new Transaction();
    tx.setSender(ownerAddress);
    const [split] = tx.splitCoins(tx.object(first.objectId), [amount]);
    deposit(client, tx, { accountId, coin: split });
    const exec = await client.signAndExecuteTransaction({
      signer,
      transaction: tx,
      include: { effects: true, objectTypes: true },
    });
    assertSuccessfulExecution(exec);
  }

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

/**
 * Helper: execute a Transaction signed by `signer`, wait for it, re-fetch with events,
 * and return the full transaction object (suitable for `expectEvent`).
 */
export async function executeAndFetch(
  client: PredictClient,
  signer: Ed25519Keypair,
  tx: Transaction,
): Promise<unknown> {
  tx.setSender(signer.toSuiAddress());
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
}
