/**
 * E2e / preflight: **wallet** (owner address) balances for WLP simulate tests.
 * `buildMintWlpTx` / `buildRequestRedeemWlpTx` use `listCoins(owner)` — not UserAccount TTO.
 *
 * New collaterals: extend {@link e2eWalletCollateralMinForMintSimulate} if decimals differ.
 */
import type { WaterXClient } from "../../src/client.ts";
import type { CollateralAsset } from "../../src/constants.ts";

/** Min raw WLP on the reference **wallet** so redeem/cancel simulate can pick a coin. */
export const E2E_WALLET_WLP_MIN_RAW = 1_000n;

/**
 * Min **wallet** collateral balance to run `buildMintWlpTx` simulate (single coin path).
 * Mock USDC / USDSUI use 6 decimals on testnet.
 */
export function e2eWalletCollateralMinForMintSimulate(asset: CollateralAsset): bigint {
  const tuned: Partial<Record<CollateralAsset, bigint>> = {
    USDC: 1_000_000n,
    USDSUI: 1_000_000n,
  };
  return tuned[asset] ?? 1_000_000n;
}

export async function sumWalletCoinBalance(
  client: WaterXClient,
  owner: string,
  coinType: string,
): Promise<bigint> {
  const { objects } = await client.listCoins({ owner, coinType });
  let sum = 0n;
  for (const o of objects) {
    sum += BigInt(o.balance);
  }
  return sum;
}

export type E2eWlpReadinessKind = "wlp_wallet" | "collateral_wallet";

export type E2eWlpReadinessIssue = {
  kind: E2eWlpReadinessKind;
  collateral?: CollateralAsset;
  detail: string;
};

/**
 * Returns issues when wallet state is insufficient for WLP-related simulate coverage.
 */
export async function collectE2eWlpReadinessIssues(
  client: WaterXClient,
  owner: string,
): Promise<E2eWlpReadinessIssue[]> {
  const issues: E2eWlpReadinessIssue[] = [];

  const wlpSum = await sumWalletCoinBalance(client, owner, client.config.wlpType);
  if (wlpSum < E2E_WALLET_WLP_MIN_RAW) {
    issues.push({
      kind: "wlp_wallet",
      detail: `wallet WLP sum=${wlpSum}, need >= ${E2E_WALLET_WLP_MIN_RAW}`,
    });
  }

  for (const { asset, coinType } of client.getCollateralAssets()) {
    const min = e2eWalletCollateralMinForMintSimulate(asset);
    const sum = await sumWalletCoinBalance(client, owner, coinType);
    if (sum < min) {
      issues.push({
        kind: "collateral_wallet",
        collateral: asset,
        detail: `wallet ${asset} sum=${sum}, need >= ${min} for mint simulate`,
      });
    }
  }

  return issues;
}
