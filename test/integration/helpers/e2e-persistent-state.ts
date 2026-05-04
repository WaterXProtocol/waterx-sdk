/**
 * Target on-chain state for the integration trader UserAccount (`trader-e2e-persistent-state.test.ts`).
 */
import type { BaseAsset } from "../../../src/constants.ts";

export type E2ePersistentPerpRow = {
  isLong: boolean;
  leverage: number;
  simulateLeverage?: number;
  openCollateral: bigint;
  openSize: bigint;
};

export const E2E_PERSISTENT_PERP_ORDER: readonly BaseAsset[] = [
  "BTC",
  "ETH",
  "SUI",
  "SOL",
  "WAL",
  "DEEP",
];

export const E2E_PERSISTENT_PERP_MARKETS: Partial<Record<BaseAsset, E2ePersistentPerpRow>> = {
  BTC: {
    isLong: true,
    leverage: 2,
    openCollateral: 10_000_000n,
    openSize: 2000n,
  },
  ETH: {
    isLong: false,
    leverage: 4,
    openCollateral: 10_000_000n,
    openSize: 2000n,
  },
  SUI: {
    isLong: true,
    leverage: 5,
    openCollateral: 10_000_000n,
    openSize: 10_000_000n,
  },
  SOL: {
    isLong: false,
    leverage: 4,
    simulateLeverage: 2,
    openCollateral: 10_000_000n,
    openSize: 2000n,
  },
  WAL: {
    isLong: true,
    leverage: 4,
    openCollateral: 10_000_000n,
    openSize: 10_000_000n,
  },
  DEEP: {
    isLong: false,
    leverage: 4,
    openCollateral: 10_000_000n,
    openSize: 2000n,
  },
};

export function activeE2ePersistentPerpBases(): BaseAsset[] {
  return E2E_PERSISTENT_PERP_ORDER.filter((b) => E2E_PERSISTENT_PERP_MARKETS[b] != null);
}

export function e2ePersistentPerpRow(base: BaseAsset): E2ePersistentPerpRow {
  const row = E2E_PERSISTENT_PERP_MARKETS[base];
  if (!row) {
    throw new Error(`No E2E_PERSISTENT_PERP_MARKETS[${base}] — add a row or remove callers.`);
  }
  return row;
}

export const E2E_PERSISTENT_WLP = {
  minBalanceRaw: 1_000_000n,
  mintPullUsdc: 25_000_000n,
} as const;

export function e2ePersistentMinAccountUsdcRough(): bigint {
  let sum = E2E_PERSISTENT_WLP.mintPullUsdc + 20_000_000n;
  for (const base of activeE2ePersistentPerpBases()) {
    sum += e2ePersistentPerpRow(base).openCollateral;
  }
  return sum;
}
