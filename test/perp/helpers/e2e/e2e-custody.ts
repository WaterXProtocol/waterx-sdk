/**
 * E2E helpers for native-custody (CREDIT PSM) simulate + integration.
 */
import type { PerpClient } from "../../../../src/perp/client.ts";
import {
  e2eCanonicalWxaAccountIds,
  e2eCanonicalWxaOwner,
  wxaAccountIdHints,
} from "./canonical-testnet-account.ts";
import {
  discoverWxaAccountWithUsdcForWlpMint,
  discoverWxaAccountWithWlpBalance,
} from "./discover-on-chain-position.ts";
import { resolveE2eNetwork } from "./e2e-client.ts";
import { getAccountOwnerByAccountId } from "./fetch-read-helpers-for-tests.ts";

export const CUSTODY_SIMULATE_AMOUNT = 1_000n;

/** Move type unlikely to be registered on any deployment (negative simulate only). */
export const UNREGISTERED_CUSTODY_ASSET_TYPE =
  "0x0000000000000000000000000000000000000000000000000000000000000001::negative_sim::NOT_REGISTERED";

/** Simulate gas cap (mist); override via `WATERX_E2E_SIMULATE_GAS_BUDGET`. Kept low for CI wallets. */
export function e2eSimulateGasBudget(): number {
  const raw = process.env.WATERX_E2E_SIMULATE_GAS_BUDGET?.trim();
  if (raw && /^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return 30_000_000;
}

export function isCreditPipelineConfigured(client: PerpClient): boolean {
  return Boolean(
    client.config.packages.waterx_credit?.credit_registry &&
    client.config.packages.native_custody?.vault,
  );
}

export function creditPipelineSkipReason(): string {
  return "waterx_credit / native_custody not in deployment config";
}

export type CustodyWxaRow = { accountId: string; owner: string };

/** Process-lifetime memo — credit/custody suites call this from multiple `beforeAll`s. */
let custodyWxaRowCache: Promise<CustodyWxaRow | null> | undefined;
let custodyWxaRowCacheClient: PerpClient | undefined;

/**
 * Prefer env wxa ids, then canonical owner mapping, then (testnet only) on-chain wxa discovery.
 *
 * On **mainnet**, after env/canonical hints fail we return `null` instead of scanning every
 * market for WLP/USDC balances — that path routinely exceeds the 180s `beforeAll` hookTimeout.
 * Set `WATERX_E2E_WXA_ACCOUNT_ID` + `WATERX_E2E_WXA_OWNER` (mainnet ids) to exercise stateful paths.
 */
export async function resolveCustodyWxaRow(
  client: PerpClient,
): Promise<CustodyWxaRow | null> {
  if (custodyWxaRowCache && custodyWxaRowCacheClient === client) {
    return custodyWxaRowCache;
  }
  custodyWxaRowCacheClient = client;
  custodyWxaRowCache = resolveCustodyWxaRowUncached(client);
  return custodyWxaRowCache;
}

async function resolveCustodyWxaRowUncached(
  client: PerpClient,
): Promise<CustodyWxaRow | null> {
  const network = resolveE2eNetwork();
  const canonicalOwner = e2eCanonicalWxaOwner(network);
  const canonicalIds = e2eCanonicalWxaAccountIds(network);

  for (const accountId of wxaAccountIdHints(network)) {
    if (canonicalOwner && canonicalIds.some((id) => id.toLowerCase() === accountId.toLowerCase())) {
      return { accountId, owner: canonicalOwner };
    }
    try {
      const owner = await getAccountOwnerByAccountId(client, accountId);
      return { accountId, owner };
    } catch {
      /* try next hint */
    }
  }

  // Mainnet: no built-in canonical wxa. Skip the multi-minute all-market WLP/USDC fallback.
  if (network === "mainnet") {
    return null;
  }

  const wxa =
    (await discoverWxaAccountWithWlpBalance(client, 1n)) ??
    (await discoverWxaAccountWithUsdcForWlpMint(client, CUSTODY_SIMULATE_AMOUNT));
  if (wxa) {
    return { accountId: wxa.accountId, owner: wxa.ownerAddress };
  }

  return null;
}

export function custodyWxaSkipReason(): string {
  const network = resolveE2eNetwork();
  if (network === "mainnet") {
    return "No mainnet wxa resolved — set WATERX_E2E_WXA_ACCOUNT_ID + WATERX_E2E_WXA_OWNER (mainnet has no canonical fallback / no all-market WXA scan)";
  }
  return "No wxa account resolved (env WATERX_E2E_WXA_ACCOUNT_ID / WATERX_INTEGRATION_ACCOUNT_ID, canonical testnet account, or on-chain wxa discovery)";
}
