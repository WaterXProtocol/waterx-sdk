/**
 * Target on-chain state for the integration reference UserAccount (e2e simulate).
 * `trader-e2e-persistent-state.test.ts` tops up when missing. Other integration tests should use
 * scratch positions only (`trader-position-lifecycle` opens and closes its own).
 *
 * Perp: at least one open position per listed base (params align with e2e open leg).
 * WLP: mint when **UserAccount** balance is below `E2E_PERSISTENT_WLP.minBalanceRaw`.
 *   Wallet-level WLP/collateral for simulate is covered by `e2e-wlp-readiness.ts` + preflight/prepare.
 */
import type { BaseAsset } from "../../src/constants.ts";

export type E2ePersistentPerpRow = {
  isLong: boolean;
  /** `buildOpenPositionTx` leverage; `simulateLeverage` overrides for open if set. */
  leverage: number;
  simulateLeverage?: number;
  /** USDC, 6 decimals. */
  openCollateral: bigint;
  /** Raw position size units. */
  openSize: bigint;
};

/** Scan order; only bases with a row in `E2E_PERSISTENT_PERP_MARKETS` are active. */
export const E2E_PERSISTENT_PERP_ORDER: readonly BaseAsset[] = [
  "BTC",
  "ETH",
  "SUI",
  "SOL",
  "WAL",
  "DEEP",
];

/** Add a key to enable persistent perp for that base; remove the key to disable. */
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

/** Below `minBalanceRaw`, pull `mintPullUsdc` from the account and mint WLP back to the account. */
export const E2E_PERSISTENT_WLP = {
  minBalanceRaw: 1_000_000n,
  mintPullUsdc: 25_000_000n,
} as const;

/** Rough min USDC for bootstrap scripts: sum of perp collaterals + one WLP round + buffer. */
export function e2ePersistentMinAccountUsdcRough(): bigint {
  let sum = E2E_PERSISTENT_WLP.mintPullUsdc + 20_000_000n;
  for (const base of activeE2ePersistentPerpBases()) {
    sum += e2ePersistentPerpRow(base).openCollateral;
  }
  return sum;
}
