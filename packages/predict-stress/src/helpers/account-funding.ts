import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { consumeDepositDirect, deposit } from "@waterx/perp-sdk/prediction/account";
import type { PredictClient } from "@waterx/perp-sdk/prediction/client";
import { getAccountData, getAccountIds } from "@waterx/perp-sdk/prediction/fetch";

import { getAccountSettlementBalance } from "./account-balance.ts";
import { assertSuccessfulExecution } from "./tx-result.ts";

interface WalletCoin {
  objectId: string;
  balance: bigint;
}

export type AccountFundingPlan = "skipped" | "wallet-usd" | "psm-mock-usdc" | "needed";

/** Case-insensitive id compare for registry account ids. */
export function sameRegistryAccountId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Resolve a registry account id owned by `owner`. Reuses `preferred` only when it appears in
 * `waterx_account::account_ids` (guards against stale ids in `testnet-seeded.json` after redeploy).
 */
export async function resolveOwnerRegistryAccountId(
  client: PredictClient,
  owner: string,
  preferred?: string,
): Promise<string | undefined> {
  const ids = await getAccountIds(client, { owner });
  if (preferred) {
    const hit = ids.find((id) => sameRegistryAccountId(id, preferred));
    if (hit) return hit;
  }
  return ids[0];
}

/** Pick the wallet coin of `coinType` with the highest balance ≥ `minBalance`. */
export async function listBestWalletCoin(
  client: PredictClient,
  owner: string,
  coinType: string,
  minBalance = 0n,
): Promise<WalletCoin | undefined> {
  const page = await client.listCoins({ owner, coinType });
  const objects =
    (page as { objects?: { objectId?: string; coinObjectId?: string; balance?: string }[] })
      .objects ?? [];
  let best: WalletCoin | undefined;
  for (const o of objects) {
    const objectId = o.objectId ?? o.coinObjectId;
    if (!objectId) continue;
    const balance = BigInt(o.balance ?? 0);
    if (balance < minBalance) continue;
    if (!best || balance > best.balance) best = { objectId, balance };
  }
  return best;
}

/** MOCK_USDC type from `packages.native_custody.assets` (testnet PSM backing). */
export function resolveMockUsdcCoinType(client: PredictClient): string | undefined {
  const native = client.config.packages.native_custody as
    | { assets?: { name?: string; type?: string }[] }
    | undefined;
  const asset = native?.assets?.find(
    (a) => a.name === "MOCK_USDC" || a.type?.includes("::mock_usdc::"),
  );
  return asset?.type;
}

function resolveNativeCustodyPackageId(client: PredictClient): string | undefined {
  const native = client.config.packages.native_custody as { published_at?: string } | undefined;
  return native?.published_at;
}

function resolveCustodyVaultId(client: PredictClient): string | undefined {
  return (client.config.packages.native_custody as { vault?: string } | undefined)?.vault;
}

function resolveCreditRegistryId(client: PredictClient): string | undefined {
  return (client.config.packages.waterx_credit as { credit_registry?: string } | undefined)
    ?.credit_registry;
}

function psmConfigReady(client: PredictClient): boolean {
  return Boolean(
    resolveNativeCustodyPackageId(client) &&
    resolveCustodyVaultId(client) &&
    resolveCreditRegistryId(client) &&
    resolveMockUsdcCoinType(client),
  );
}

export interface WalletUsdDepositParams {
  accountId: string;
  usdCoinId: string;
  amount: bigint;
}

/** Credit settlement USD from a wallet coin into the registry account (`deposit` PTB). */
export function appendWalletUsdDeposit(
  client: PredictClient,
  tx: Transaction,
  params: WalletUsdDepositParams,
): void {
  const [coin] = tx.splitCoins(tx.object(params.usdCoinId), [params.amount]);
  deposit(client, tx, { accountId: params.accountId, coin });
}

export interface PsmDepositParams {
  accountId: string;
  mockUsdcCoinId: string;
  amount: bigint;
}

/**
 * PSM path: MOCK_USDC → `custody_vault::mint` → `consume_deposit_direct` into the registry account.
 * Testnet-only when `native_custody` + `waterx_credit` are present in waterx-config.
 */
export function appendPsmDeposit(
  client: PredictClient,
  tx: Transaction,
  params: PsmDepositParams,
): void {
  const custodyPkg = resolveNativeCustodyPackageId(client);
  const vault = resolveCustodyVaultId(client);
  const creditRegistry = resolveCreditRegistryId(client);
  const mockUsdc = resolveMockUsdcCoinType(client);
  const usd = client.settlementCoinType();
  if (!custodyPkg || !vault || !creditRegistry || !mockUsdc) {
    throw new Error(
      "PSM deposit requires packages.native_custody and packages.waterx_credit in waterx-config",
    );
  }

  const [backing] = tx.splitCoins(tx.object(params.mockUsdcCoinId), [params.amount]);
  const [depositRequest] = tx.moveCall({
    target: `${custodyPkg}::custody_vault::mint`,
    typeArguments: [mockUsdc, usd],
    arguments: [
      tx.object(vault),
      tx.object(creditRegistry),
      tx.object(client.accountRegistry()),
      tx.pure.id(params.accountId),
      backing,
      tx.pure.vector("u8", []),
    ],
  });
  consumeDepositDirect(client, tx, { depositRequest, coinType: usd });
}

/**
 * Decide how to fund a registry account before `placeOrder`.
 * Skips when the account already holds enough settlement balance, or when prediction-side
 * `hasData` is true (account has prior orders/positions).
 */
export async function planAccountFunding(
  client: PredictClient,
  owner: string,
  amount: bigint,
  params: { accountId: string },
): Promise<AccountFundingPlan> {
  await assertRegisteredAccount(client, owner, params.accountId);

  const stored = await getAccountSettlementBalance(client, params.accountId);
  if (stored >= amount) return "skipped";

  const data = await getAccountData(client, { accountId: params.accountId });
  if (data.hasData) return "skipped";

  if (await listBestWalletCoin(client, owner, client.settlementCoinType(), amount)) {
    return "wallet-usd";
  }

  const mockUsdcType = resolveMockUsdcCoinType(client);
  if (mockUsdcType && psmConfigReady(client)) {
    if (await listBestWalletCoin(client, owner, mockUsdcType, amount)) {
      return "psm-mock-usdc";
    }
  }

  return "needed";
}

export function formatFundingNeededError(
  client: PredictClient,
  owner: string,
  accountId: string,
  amount: bigint,
): string {
  const usd = client.settlementCoinType();
  const mock = resolveMockUsdcCoinType(client);
  const mockHint = mock ? ` or ${amount} base units of ${mock} (PSM mint into account)` : "";
  return (
    `Cannot fund account ${accountId} for wallet ${owner}: need ${amount} base units of ` +
    `${usd} in wallet${mockHint}.`
  );
}

async function assertRegisteredAccount(
  client: PredictClient,
  owner: string,
  accountId: string,
): Promise<void> {
  const registered = await resolveOwnerRegistryAccountId(client, owner, accountId);
  if (!registered) {
    throw new Error(
      `Account ${accountId} is not registered for owner ${owner} — run createAccount first`,
    );
  }
  if (!sameRegistryAccountId(registered, accountId)) {
    throw new Error(
      `Account ${accountId} is stale (not in waterx_account registry for ${owner}) — ` +
        `use ${registered} or create a new account`,
    );
  }
}

/** Deposit `amount` into the account regardless of `hasData` (extra top-up). */
export async function forceDepositToAccount(
  client: PredictClient,
  signer: Ed25519Keypair,
  accountId: string,
  amount: bigint,
): Promise<Exclude<AccountFundingPlan, "skipped" | "needed">> {
  if (amount <= 0n) {
    throw new Error(`forceDepositToAccount: amount must be positive, got ${amount}`);
  }
  const owner = signer.toSuiAddress();
  await assertRegisteredAccount(client, owner, accountId);

  const tx = new Transaction();
  tx.setSender(owner);
  let plan: Exclude<AccountFundingPlan, "skipped" | "needed">;

  const usd = await listBestWalletCoin(client, owner, client.settlementCoinType(), amount);
  if (usd) {
    plan = "wallet-usd";
    appendWalletUsdDeposit(client, tx, {
      accountId,
      usdCoinId: usd.objectId,
      amount,
    });
  } else {
    const mockUsdcType = resolveMockUsdcCoinType(client);
    if (!mockUsdcType || !psmConfigReady(client)) {
      throw new Error(formatFundingNeededError(client, owner, accountId, amount));
    }
    const mock = await listBestWalletCoin(client, owner, mockUsdcType, amount);
    if (!mock) throw new Error(formatFundingNeededError(client, owner, accountId, amount));
    plan = "psm-mock-usdc";
    appendPsmDeposit(client, tx, { accountId, mockUsdcCoinId: mock.objectId, amount });
  }

  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, objectTypes: true },
  });
  assertSuccessfulExecution(result);
  return plan;
}

/**
 * Sweep all settlement USD or MOCK_USDC still in the owner wallet into the registry account.
 * Returns deposited base units (0 when the wallet has nothing left to deposit).
 */
export async function forceDepositAllAvailable(
  client: PredictClient,
  signer: Ed25519Keypair,
  accountId: string,
): Promise<{ plan: Exclude<AccountFundingPlan, "skipped" | "needed">; amount: bigint }> {
  const owner = signer.toSuiAddress();
  await assertRegisteredAccount(client, owner, accountId);

  const usd = await listBestWalletCoin(client, owner, client.settlementCoinType(), 1n);
  if (usd && usd.balance > 0n) {
    const plan = await forceDepositToAccount(client, signer, accountId, usd.balance);
    return { plan, amount: usd.balance };
  }

  const mockUsdcType = resolveMockUsdcCoinType(client);
  if (mockUsdcType && psmConfigReady(client)) {
    const mock = await listBestWalletCoin(client, owner, mockUsdcType, 1n);
    if (mock && mock.balance > 0n) {
      const plan = await forceDepositToAccount(client, signer, accountId, mock.balance);
      return { plan, amount: mock.balance };
    }
  }

  throw new Error(
    `Cannot deposit for ${owner}: wallet has no settlement USD or MOCK_USDC left to sweep`,
  );
}

/** Execute wallet-USD deposit or PSM mint so the account can `placeOrder`. */
export async function ensureAccountFunded(
  client: PredictClient,
  signer: Ed25519Keypair,
  accountId: string,
  amount: bigint,
): Promise<Exclude<AccountFundingPlan, "needed">> {
  const owner = signer.toSuiAddress();
  const plan = await planAccountFunding(client, owner, amount, { accountId });
  if (plan === "skipped") return "skipped";
  if (plan === "needed") {
    throw new Error(formatFundingNeededError(client, owner, accountId, amount));
  }

  const tx = new Transaction();
  tx.setSender(owner);
  if (plan === "wallet-usd") {
    const usd = await listBestWalletCoin(client, owner, client.settlementCoinType(), amount);
    if (!usd) throw new Error(formatFundingNeededError(client, owner, accountId, amount));
    appendWalletUsdDeposit(client, tx, {
      accountId,
      usdCoinId: usd.objectId,
      amount,
    });
  } else {
    const mockUsdcType = resolveMockUsdcCoinType(client)!;
    const mock = await listBestWalletCoin(client, owner, mockUsdcType, amount);
    if (!mock) throw new Error(formatFundingNeededError(client, owner, accountId, amount));
    appendPsmDeposit(client, tx, { accountId, mockUsdcCoinId: mock.objectId, amount });
  }

  const result = await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, objectTypes: true },
  });
  assertSuccessfulExecution(result);
  return plan;
}
