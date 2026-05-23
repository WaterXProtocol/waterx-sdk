/**
 * Target on-chain state for the integration trader wxa Account (`trader-e2e-persistent-state.test.ts`).
 * Tickers mirror v3 oracle keys (`BTCUSD`, …) and {@link lifecycle-test-markets}.
 */
export type E2ePersistentPerpRow = {
  isLong: boolean;
  leverage: number;
  simulateLeverage?: number;
  openCollateral: bigint;
  openSize: bigint;
};

/** Markets we try to seed with one dormant slot each (skipped if ticker missing from deployment). */
export const E2E_PERSISTENT_PERP_ORDER: readonly string[] = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "SUIUSD",
];

export const E2E_PERSISTENT_PERP_MARKETS: Partial<Record<string, E2ePersistentPerpRow>> = {
  BTCUSD: {
    isLong: true,
    leverage: 2,
    openCollateral: 10_000_000n,
    openSize: 2_000n,
  },
  ETHUSD: {
    isLong: false,
    leverage: 4,
    openCollateral: 10_000_000n,
    openSize: 2_000n,
  },
  SUIUSD: {
    isLong: true,
    leverage: 5,
    openCollateral: 10_000_000n,
    openSize: 10_000_000n,
  },
  SOLUSD: {
    isLong: false,
    leverage: 4,
    simulateLeverage: 2,
    openCollateral: 10_000_000n,
    openSize: 2_000n,
  },
};

export function activeE2ePersistentPerpTickers(): string[] {
  return [...E2E_PERSISTENT_PERP_ORDER.filter((t) => E2E_PERSISTENT_PERP_MARKETS[t] != null)];
}

export function e2ePersistentPerpTickersForClient(marketsObj: Record<string, unknown>): string[] {
  return activeE2ePersistentPerpTickers().filter((t) => marketsObj[t] != null);
}

export function e2ePersistentPerpRow(ticker: string): E2ePersistentPerpRow {
  const row = E2E_PERSISTENT_PERP_MARKETS[ticker];
  if (!row) {
    throw new Error(`No E2E_PERSISTENT_PERP_MARKETS[${ticker}] — add a row or adjust order.`);
  }
  return row;
}

export const E2E_PERSISTENT_WLP = {
  minBalanceRaw: 1_000_000n,
  mintPullUsdc: 25_000_000n,
} as const;

/** Small enqueue for e2e `cancelRedeemWlp` simulate (integration / preflight wxa account). */
export const E2E_PERSISTENT_REDEEM = {
  lpAmount: 1n,
} as const;

export function e2ePersistentMinAccountUsdcRough(): bigint {
  let sum = E2E_PERSISTENT_WLP.mintPullUsdc + 20_000_000n;
  for (const t of activeE2ePersistentPerpTickers()) {
    sum += e2ePersistentPerpRow(t).openCollateral;
  }
  return sum;
}
