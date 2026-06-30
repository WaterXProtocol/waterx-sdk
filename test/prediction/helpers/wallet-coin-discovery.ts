/**
 * Discover wallet-held coins for predict E2E payment / deposit PTBs.
 * Prefers settlement `::usd::USD`, then testnet MOCK_USDC (PSM backing).
 */
import type { PredictClient } from "~predict/client.ts";

import { listBestWalletCoin, psmConfigReady, resolveMockUsdcCoinType } from "./account-funding.ts";
import { readFixtureOverrides } from "./e2e-env.ts";

export type WalletCoinSource = "env-override" | "settlement-usd" | "mock-usdc";

export interface DiscoveredWalletCoin {
  objectId: string;
  coinType: string;
  source: WalletCoinSource;
  balance: bigint;
}

/** Minimum balance for E2E deposit / payment simulate splits. */
export const E2E_WALLET_COIN_MIN_BALANCE = 1_000_000n;

async function resolveCoinTypeForObject(
  client: PredictClient,
  owner: string,
  objectId: string,
): Promise<string | undefined> {
  const settlement = client.settlementCoinType();
  const usd = await listBestWalletCoin(client, owner, settlement, 0n);
  if (usd?.objectId === objectId) return settlement;
  const mockType = resolveMockUsdcCoinType(client);
  if (mockType) {
    const mock = await listBestWalletCoin(client, owner, mockType, 0n);
    if (mock?.objectId === objectId) return mockType;
  }
  return undefined;
}

export async function discoverBestWalletCoin(
  client: PredictClient,
  owner: string,
  minBalance = E2E_WALLET_COIN_MIN_BALANCE,
): Promise<DiscoveredWalletCoin | undefined> {
  const envOverride = readFixtureOverrides().usdCoinObjectId?.trim();
  if (envOverride) {
    const coinType =
      (await resolveCoinTypeForObject(client, owner, envOverride)) ?? client.settlementCoinType();
    const balance = (await listBestWalletCoin(client, owner, coinType, 0n))?.balance ?? minBalance;
    return { objectId: envOverride, coinType, source: "env-override", balance };
  }

  const settlement = client.settlementCoinType();
  const usd = await listBestWalletCoin(client, owner, settlement, minBalance);
  if (usd) {
    return {
      objectId: usd.objectId,
      coinType: settlement,
      source: "settlement-usd",
      balance: usd.balance,
    };
  }

  const mockType = resolveMockUsdcCoinType(client);
  if (mockType && psmConfigReady(client)) {
    const mock = await listBestWalletCoin(client, owner, mockType, minBalance);
    if (mock) {
      return {
        objectId: mock.objectId,
        coinType: mockType,
        source: "mock-usdc",
        balance: mock.balance,
      };
    }
  }

  return undefined;
}
