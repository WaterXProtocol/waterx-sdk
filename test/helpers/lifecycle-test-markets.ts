/**
 * Single source of truth for **integration** + **e2e** per-market lifecycle / open-position tests.
 *
 * - Add a `BaseAsset` key to run that market in both suites; **delete the key** (or comment block)
 *   to stop running it.
 * - Iteration order is {@link LIFECYCLE_TEST_BASE_ORDER} intersected with keys present in
 *   {@link LIFECYCLE_TEST_MARKETS}.
 */
import type { BaseAsset } from "../../src/constants.ts";

export type LifecycleTestMarketRow = {
  /**
   * Ballpark USD/base for simulate / e2e `approxPrice` and `computeLeverageDerivedSize`.
   * Integration scratch lifecycle uses on-chain `resize` only (ignores this field).
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
];

/** Enable a market by adding a row; disable by removing the key. */
export const LIFECYCLE_TEST_MARKETS: Partial<Record<BaseAsset, LifecycleTestMarketRow>> = {
  BTC: {
    approxPrice: 100_000,
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
    approxPrice: 3800,
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
    approxPrice: 1,
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
    approxPrice: 180,
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
    approxPrice: 0.45,
    leverage: 4,
    openCollateral: 32_000_000n,
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
  DEEP: {
    approxPrice: 0.12,
    leverage: 4,
    openCollateral: 30_000_000n,
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
  AAPLX: {
    approxPrice: 200,
    leverage: 2,
    openCollateral: 10_000_000n,
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
  },
  GOOGLX: {
    approxPrice: 170,
    leverage: 2,
    openCollateral: 10_000_000n,
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
  },
  METAX: {
    approxPrice: 600,
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 30_000n,
      increaseSize: 15_000n,
      decreaseSize: 15_000n,
    },
  },
  NVDAX: {
    approxPrice: 130,
    leverage: 2,
    openCollateral: 10_000_000n,
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
  },
  QQQX: {
    approxPrice: 490,
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 40_000n,
      increaseSize: 20_000n,
      decreaseSize: 20_000n,
    },
  },
  SPYX: {
    approxPrice: 560,
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 30_000n,
      increaseSize: 15_000n,
      decreaseSize: 15_000n,
    },
  },
  TSLAX: {
    approxPrice: 250,
    leverage: 2,
    openCollateral: 10_000_000n,
    isLong: true,
    sizeLot: 1000n,
    simulateOpenCollateral: 10_000_000n,
    e2ePtb: {
      openCollateral: 10_000_000n,
      increaseCollateral: 5_000_000n,
      openSize: 80_000n,
      increaseSize: 40_000n,
      decreaseSize: 40_000n,
    },
  },
};

/** Bases that have a row — in stable order. */
export function activeLifecycleTestBases(): BaseAsset[] {
  return LIFECYCLE_TEST_BASE_ORDER.filter((b) => LIFECYCLE_TEST_MARKETS[b] != null);
}

export function lifecycleRow(base: BaseAsset): LifecycleTestMarketRow {
  const row = LIFECYCLE_TEST_MARKETS[base];
  if (!row) {
    throw new Error(
      `No LIFECYCLE_TEST_MARKETS[${base}] — add a row or remove ${base} from callers.`,
    );
  }
  return row;
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
 * in `e2e-persistent-state.ts` / `trader-e2e-persistent-state.test.ts`.
 */
export const LIFECYCLE_MIN_ACCOUNT_USDC = 130_000_000n;

/**
 * Minimum account USDC for opt-in `WATERX_INTEGRATION_APPROX_PRICE_CHAIN` open+close smoke
 * (uses `simulateOpenCollateral` + headroom; cheaper than full scratch lifecycle).
 */
export const LIFECYCLE_APPROX_PRICE_CHAIN_SMOKE_MIN_USDC = 40_000_000n;
