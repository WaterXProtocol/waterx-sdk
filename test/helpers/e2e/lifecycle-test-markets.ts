/**
 * Single source of truth for **integration** + **e2e** per-market lifecycle / open-position tests.
 *
 * - Add a `BaseAsset` key to run that market; **delete the key** to stop running it.
 * - Iteration order is {@link LIFECYCLE_TEST_BASE_ORDER} intersected with keys present in
 *   {@link LIFECYCLE_TEST_MARKETS}.
 * - At runtime, {@link activeLifecycleTestBasesForClient} keeps **one list** but only iterates
 *   bases that exist on the active `WaterXClient` deployment (`client.config.markets`), so
 *   mainnet-only extended symbols are skipped automatically on testnet.
 */
import { createTestnetConfig, WaterXClient } from "@waterx/perp-sdk";

import type { BaseAsset } from "../../../src/constants.ts";
import { getCachedOracleUsdPriceForBase } from "./lifecycle-oracle-usd-prices.ts";

export type LifecycleTestMarketRow = {
  /**
   * USD/base from on-chain oracle simulate cache (see `primeLifecycleOracleUsdPrices` in Vitest
   * setup). Used for e2e `approxPrice` / `computeLeverageDerivedSize`; integration scratch uses
   * on-chain `resize` for sizing but still reads this for helpers that need a USD hint.
   */
  approxPrice: number;
  leverage: number;
  /** Integration `buildOpenPositionTx` collateral (USDC 6dp). */
  openCollateral: bigint;
  isLong: boolean;
  /**
   * Legacy hint for local math; **integration** uses `fetchIntegrationMarketSummaries` (`beforeAll`)
   * for real `lotSize` / `minSize`. Kept for docs / e2e row symmetry.
   */
  sizeLot: bigint;
  /**
   * E2E `buildOpenPositionTx` simulate collateral — usually smaller than `openCollateral`.
   * USDC 6dp.
   */
  simulateOpenCollateral: bigint;
  /**
   * E2E `buildOpenPositionTx` leverage only (defaults to `leverage`). Use when small
   * `simulateOpenCollateral` would otherwise exceed effective max leverage.
   */
  simulateLeverage?: number;
  /**
   * E2E `lifecycle-single-ptb` fixed-size PTB (raw position size units — respect market min/lot).
   */
  e2ePtb: {
    openCollateral: bigint;
    increaseCollateral: bigint;
    openSize: bigint;
    increaseSize: bigint;
    decreaseSize: bigint;
  };
};

/** Table row without `approxPrice` — filled at runtime from the oracle cache. */
export type LifecycleTestMarketTableRow = Omit<LifecycleTestMarketRow, "approxPrice">;

/**
 * Preferred scan / test order. Only bases with a row in {@link LIFECYCLE_TEST_MARKETS} run.
 */
export const LIFECYCLE_TEST_BASE_ORDER: readonly BaseAsset[] = [
  "BTC",
  "ETH",
  "SUI",
  "SOL",
  "WAL",
  "DEEP",
  "AAPLX",
  "GOOGLX",
  "METAX",
  "NVDAX",
  "QQQX",
  "SPYX",
  "TSLAX",
  // 200K-tier — mainnet-only in SDK constants; filtered out on testnet via `activeLifecycleTestBasesForClient`.
  "HYPE",
  "XRP",
  "BNB",
  "ZEC",
  "XAUT",
  "XAG",
  "EURUSD",
  "USDJPY",
  "MSTRX",
  "COINX",
  "HOODX",
  "CRCLX",
  "NFLXX",
  "WTI",
  "BRENT",
];

/** Same PTB sizing template as other xStock lifecycle rows (Float-scale raw sizes). */
function lifecycleRow200kXStock(): LifecycleTestMarketTableRow {
  return {
    leverage: 2,
    openCollateral: 15_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 100_000n,
      increaseSize: 50_000n,
      decreaseSize: 50_000n,
    },
  };
}

/** Tighter raw sizes for high-USD commodities / FX notionals. */
function lifecycleRow200kTight(): LifecycleTestMarketTableRow {
  return {
    leverage: 2,
    openCollateral: 15_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 20_000n,
      increaseSize: 10_000n,
      decreaseSize: 10_000n,
    },
  };
}

/** Large-cap crypto 200K-tier — slightly higher simulate collateral headroom. */
function lifecycleRow200kMajorCrypto(): LifecycleTestMarketTableRow {
  return {
    leverage: 3,
    openCollateral: 20_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 15_000_000n,
    e2ePtb: {
      openCollateral: 15_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 500_000n,
      increaseSize: 250_000n,
      decreaseSize: 250_000n,
    },
  };
}

/** Enable a market by adding a row; disable by removing the key. */
export const LIFECYCLE_TEST_MARKETS: Partial<Record<BaseAsset, LifecycleTestMarketTableRow>> = {
  BTC: {
    leverage: 2,
    openCollateral: 50_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 200n,
      increaseSize: 100n,
      decreaseSize: 100n,
    },
  },
  ETH: {
    leverage: 4,
    openCollateral: 42_000_000n,
    isLong: false,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 2000n,
      increaseSize: 1000n,
      decreaseSize: 1000n,
    },
  },
  SUI: {
    leverage: 5,
    openCollateral: 35_000_000n,
    isLong: true,
    sizeLot: 1_000_000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 10_000_000n,
      increaseSize: 5_000_000n,
      decreaseSize: 5_000_000n,
    },
  },
  SOL: {
    leverage: 2,
    openCollateral: 40_000_000n,
    isLong: false,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 2000n,
      increaseSize: 1000n,
      decreaseSize: 1000n,
    },
  },
  WAL: {
    leverage: 4,
    openCollateral: 32_000_000n,
    isLong: true,
    sizeLot: 1_000_000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 10_000_000n,
      increaseSize: 5_000_000n,
      decreaseSize: 5_000_000n,
    },
  },
  DEEP: {
    leverage: 4,
    openCollateral: 30_000_000n,
    isLong: false,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 2000n,
      increaseSize: 1000n,
      decreaseSize: 1000n,
    },
  },
  AAPLX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 100_000n,
      increaseSize: 50_000n,
      decreaseSize: 50_000n,
    },
  },
  GOOGLX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 100_000n,
      increaseSize: 50_000n,
      decreaseSize: 50_000n,
    },
  },
  METAX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 30_000n,
      increaseSize: 15_000n,
      decreaseSize: 15_000n,
    },
  },
  NVDAX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 100_000n,
      increaseSize: 50_000n,
      decreaseSize: 50_000n,
    },
  },
  QQQX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 40_000n,
      increaseSize: 20_000n,
      decreaseSize: 20_000n,
    },
  },
  SPYX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 30_000n,
      increaseSize: 15_000n,
      decreaseSize: 15_000n,
    },
  },
  TSLAX: {
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 5_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 80_000n,
      increaseSize: 40_000n,
      decreaseSize: 40_000n,
    },
  },
  HYPE: lifecycleRow200kMajorCrypto(),
  XRP: {
    ...lifecycleRow200kMajorCrypto(),
    leverage: 4,
    isLong: false,
  },
  BNB: lifecycleRow200kMajorCrypto(),
  ZEC: {
    ...lifecycleRow200kMajorCrypto(),
    leverage: 3,
    isLong: false,
  },
  XAUT: lifecycleRow200kTight(),
  XAG: lifecycleRow200kTight(),
  EURUSD: lifecycleRow200kTight(),
  USDJPY: lifecycleRow200kTight(),
  MSTRX: lifecycleRow200kXStock(),
  COINX: lifecycleRow200kXStock(),
  HOODX: lifecycleRow200kXStock(),
  CRCLX: lifecycleRow200kXStock(),
  NFLXX: lifecycleRow200kXStock(),
  WTI: lifecycleRow200kTight(),
  BRENT: lifecycleRow200kTight(),
};

let cachedTestnetLifecycleClient: WaterXClient | undefined;

/** Shared testnet client for {@link activeLifecycleTestBasesIntegration} (no gRPC retry proxy). */
export function getTestnetLifecycleProbeClient(): WaterXClient {
  if (!cachedTestnetLifecycleClient) {
    cachedTestnetLifecycleClient = new WaterXClient(createTestnetConfig());
  }
  return cachedTestnetLifecycleClient;
}

/** All bases that have a lifecycle table row (ignores deployed network). */
export function activeLifecycleTestBasesConfigured(): BaseAsset[] {
  return LIFECYCLE_TEST_BASE_ORDER.filter((b) => LIFECYCLE_TEST_MARKETS[b] != null);
}

/**
 * Lifecycle bases that exist on **this** client's network (testnet vs mainnet markets map).
 * Use this for e2e simulate + discovery so one manifest covers extended mainnet-only assets.
 */
export function activeLifecycleTestBasesForClient(client: WaterXClient): BaseAsset[] {
  const markets = client.config.markets as Record<string, unknown>;
  return LIFECYCLE_TEST_BASE_ORDER.filter(
    (b) => LIFECYCLE_TEST_MARKETS[b] != null && markets[b] !== undefined,
  );
}

/** Integration scratch: published testnet deployment only. */
export function activeLifecycleTestBasesIntegration(): BaseAsset[] {
  return activeLifecycleTestBasesForClient(getTestnetLifecycleProbeClient());
}

export function lifecycleRow(base: BaseAsset): LifecycleTestMarketRow {
  const row = LIFECYCLE_TEST_MARKETS[base];
  if (!row) {
    throw new Error(
      `No LIFECYCLE_TEST_MARKETS[${base}] — add a row or remove ${base} from callers.`,
    );
  }
  return {
    ...row,
    approxPrice: getCachedOracleUsdPriceForBase(base),
  };
}

/** Integration: `buildIncreasePositionTx` collateral (USDC 6dp). */
export const LIFECYCLE_INCREASE_COLLATERAL_USDC = 12_000_000n;

/** Integration: `buildDepositCollateralTx` collateral add amount (USDC 6dp). */
export const LIFECYCLE_DEPOSIT_COLLATERAL_USDC = 2_000_000n;

/** Integration: `buildWithdrawCollateralTx` collateral release amount (USDC 6dp). */
export const LIFECYCLE_WITHDRAW_COLLATERAL_USDC = 1_000_000n;

/**
 * Minimum account USDC before **scratch** lifecycle (`trader-position-lifecycle`): largest
 * `openCollateral` among enabled bases + increase + fee headroom. E2e persistent slots + WLP live
 * in `test/integration/helpers/e2e-persistent-state.ts` / `trader-e2e-persistent-state.test.ts`.
 */
export const LIFECYCLE_MIN_ACCOUNT_USDC = 130_000_000n;

/**
 * Minimum account USDC for opt-in `WATERX_INTEGRATION_APPROX_PRICE_CHAIN` open+close smoke
 * (uses `simulateOpenCollateral` + headroom; cheaper than full scratch lifecycle).
 * Oracle-cached `approxPrice` is used for that path.
 */
export const LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC = 40_000_000n;
