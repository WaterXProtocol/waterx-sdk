/**
 * E2E helpers for native-custody (CREDIT PSM) simulate + integration.
 */
import type { WaterXClient } from "../../../src/client.ts";
import { e2eCanonicalWxaAccountIds } from "./canonical-testnet-account.ts";
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

export function isCreditPipelineConfigured(client: WaterXClient): boolean {
  return Boolean(
    client.config.packages.waterx_credit?.credit_registry &&
    client.config.packages.native_custody?.vault,
  );
}

export function creditPipelineSkipReason(): string {
  return "waterx_credit / native_custody not in deployment config";
}

/** Prefer env wxa ids, then built-in testnet canonical account (CI-safe). */
export async function resolveCustodyWxaRow(
  client: WaterXClient,
): Promise<{ accountId: string; owner: string } | null> {
  const accountId =
    process.env.WATERX_E2E_WXA_ACCOUNT_ID?.trim() ||
    process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim() ||
    e2eCanonicalWxaAccountIds(resolveE2eNetwork())[0];
  if (!accountId) return null;
  try {
    const owner = await getAccountOwnerByAccountId(client, accountId);
    return { accountId, owner };
  } catch {
    return null;
  }
}

export function custodyWxaSkipReason(): string {
  return "No wxa account resolved (env WATERX_E2E_WXA_ACCOUNT_ID / WATERX_INTEGRATION_ACCOUNT_ID or testnet canonical account)";
}
