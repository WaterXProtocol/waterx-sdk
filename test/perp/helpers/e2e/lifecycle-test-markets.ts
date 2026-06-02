/**
 * Per-market lifecycle / sizing hints for e2e + integration scratch runners (v3 ticker keys).
 *
 * Add/remove tickers in `LIFECYCLE_TEST_TICKER_ORDER`; iteration skips unknown deployments via config.
 */
import type { WaterXClient } from "../../../../src/client.ts";
import { getUsdHintForTicker } from "./oracle-pyth-context.ts";

/** Legacy symbol aliases → oracle ticker (for transitional integration imports). */
const LEGACY_BASE_TO_TICKER: Record<string, string> = {
  BTC: "BTCUSD",
  ETH: "ETHUSD",
  SOL: "SOLUSD",
  SUI: "SUIUSD",
  DEEP: "DEEPUSD",
  WAL: "WALUSD",
  USDC: "USDCUSD",
};

export type LifecycleTestTickerRow = {
  approxUsdHint: number;
  leverage: number;
  openCollateral: bigint;
  isLong: boolean;
  sizeLot: bigint;
  simulateOpenCollateral: bigint;
  simulateLeverage?: number;
  e2ePtb: {
    openCollateral: bigint;
    increaseCollateral: bigint;
    openSize: bigint;
    increaseSize: bigint;
    decreaseSize: bigint;
  };
};

export type LifecycleTestMarketTableRow = Omit<LifecycleTestTickerRow, "approxUsdHint">;

/** @deprecated Use {@link LifecycleTestTickerRow}. */
export type LifecycleTestMarketRow = LifecycleTestTickerRow;

export const LIFECYCLE_TEST_TICKER_ORDER: readonly string[] = [
  "BTCUSD",
  "ETHUSD",
  "SOLUSD",
  "SUIUSD",
];

/** @deprecated Alias — ticker keys used across legacy docs/scripts. */
export const LIFECYCLE_TEST_MARKETS = LIFECYCLE_TEST_TICKER_ORDER;

/** USDC raw amounts shared by scratch sizing helpers (legacy naming). */
export const LIFECYCLE_DEPOSIT_COLLATERAL_USDC = 10_000_000n;
export const LIFECYCLE_INCREASE_COLLATERAL_USDC = 5_000_000n;
export const LIFECYCLE_WITHDRAW_COLLATERAL_USDC = 5_000_000n;

/** Integration probes — wxa USDC balance floor before lifecycle PTBs. */
export const LIFECYCLE_MIN_ACCOUNT_USDC = 50_000_000n;
export const LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC = 10_000_000n;

const TABLE: Record<string, LifecycleTestMarketTableRow> = {
  BTCUSD: {
    leverage: 10,
    openCollateral: 50_000_000n,
    isLong: true,
    sizeLot: rawHintLot(),
    simulateOpenCollateral: 15_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 1_000_000n,
      increaseSize: 500_000n,
      decreaseSize: 300_000n,
    },
  },
  ETHUSD: {
    leverage: 8,
    openCollateral: 40_000_000n,
    isLong: false,
    sizeLot: rawHintLot(),
    simulateOpenCollateral: 12_000_000n,
    e2ePtb: {
      openCollateral: 8_000_000n,
      increaseCollateral: 4_000_000n,
      openSize: 900_000n,
      increaseSize: 450_000n,
      decreaseSize: 250_000n,
    },
  },
  SOLUSD: {
    leverage: 5,
    openCollateral: 20_000_000n,
    isLong: true,
    sizeLot: rawHintLot(),
    simulateOpenCollateral: 8_000_000n,
    e2ePtb: {
      openCollateral: 6_000_000n,
      increaseCollateral: 3_000_000n,
      openSize: 800_000n,
      increaseSize: 400_000n,
      decreaseSize: 200_000n,
    },
  },
  SUIUSD: {
    leverage: 5,
    openCollateral: 15_000_000n,
    isLong: true,
    sizeLot: rawHintLot(),
    simulateOpenCollateral: 6_000_000n,
    e2ePtb: {
      openCollateral: 5_000_000n,
      increaseCollateral: 2_000_000n,
      openSize: 700_000n,
      increaseSize: 350_000n,
      decreaseSize: 180_000n,
    },
  },
};

function rawHintLot(): bigint {
  return 1n;
}

/** Normalize env / CLI aliases (`BTC`) → config ticker (`BTCUSD`). */
export function canonicalLifecycleTicker(symbolOrTicker: string): string {
  const up = symbolOrTicker.trim();
  return LEGACY_BASE_TO_TICKER[up] ?? LEGACY_BASE_TO_TICKER[up.toUpperCase()] ?? up;
}

function resolveTickerKey(symbolOrTicker: string): string {
  return canonicalLifecycleTicker(symbolOrTicker);
}

/** Tickers listed in order that exist on this client's deployment. */
export function activeLifecycleTickersForClient(client: WaterXClient): string[] {
  const markets = client.config.packages.waterx_perp.markets ?? {};
  return LIFECYCLE_TEST_TICKER_ORDER.filter((t) => markets[t] != null);
}

/**
 * @deprecated Use {@link activeLifecycleTickersForClient}. Returned strings are tickers (`BTCUSD`).
 */
export function activeLifecycleTestBasesForClient(client: WaterXClient): string[] {
  return activeLifecycleTickersForClient(client);
}

/** Integration helper — same as {@link activeLifecycleTickersForClient}. */
export function activeLifecycleTestBasesIntegration(client: WaterXClient): string[] {
  return activeLifecycleTickersForClient(client);
}

export function lifecycleTickerRow(ticker: string): LifecycleTestTickerRow {
  const t = resolveTickerKey(ticker);
  const row = TABLE[t];
  if (!row) {
    return {
      approxUsdHint: 1,
      leverage: 5,
      openCollateral: 10_000_000n,
      isLong: true,
      sizeLot: 1n,
      simulateOpenCollateral: 5_000_000n,
      e2ePtb: {
        openCollateral: 5_000_000n,
        increaseCollateral: 2_000_000n,
        openSize: 500_000n,
        increaseSize: 250_000n,
        decreaseSize: 100_000n,
      },
    };
  }
  return { ...row, approxUsdHint: getUsdHintForTicker(t) };
}

/** @deprecated Prefer {@link lifecycleTickerRow}; accepts legacy `BTC`-style or ticker. */
export function lifecycleRow(baseOrTicker: string): LifecycleTestTickerRow {
  return lifecycleTickerRow(resolveTickerKey(baseOrTicker));
}
