/**
 * Data-driven **scratch** perp scenarios: one row per enabled {@link LIFECYCLE_TEST_MARKETS} base.
 * Used by integration (full on-chain lifecycle) and e2e simulate (open dry-runs + optional stateful).
 *
 * To add a market: extend {@link LIFECYCLE_TEST_MARKETS}; order follows {@link LIFECYCLE_TEST_BASE_ORDER}.
 */
import type { BaseAsset } from "../../src/constants.ts";
import type { LifecycleTestMarketRow } from "./lifecycle-test-markets.ts";
import {
  LIFECYCLE_DEPOSIT_COLLATERAL_USDC,
  LIFECYCLE_INCREASE_COLLATERAL_USDC,
  LIFECYCLE_TEST_BASE_ORDER,
  LIFECYCLE_TEST_MARKETS,
  LIFECYCLE_WITHDRAW_COLLATERAL_USDC,
  lifecycleRow,
} from "./lifecycle-test-markets.ts";

/** Minimum Move commands we expect a successful `buildOpenPositionTx` simulate to execute (heuristic). */
export const SCRATCH_EXPECT = {
  simulate: {
    /** `approxPrice` / explicit `size` / table-approx open (no on-chain resize). */
    minCommandsOpenStandard: 9,
    /** Open sized via on-chain `resize`. */
    minCommandsOpenResize: 10,
  },
  integration: {
    /** After `PositionOpened`, leverage must be in (0, maxLeverageBps]. */
    openLeverageBpsMinExclusive: 0n,
    /** Collateral delta after deposit (USDC raw). */
    depositDelta: LIFECYCLE_DEPOSIT_COLLATERAL_USDC,
    /** Collateral delta after withdraw (USDC raw). */
    withdrawDelta: LIFECYCLE_WITHDRAW_COLLATERAL_USDC,
  },
} as const;

export type ScratchTradingScenario = {
  /** Stable id for Vitest titles, e.g. `scratch-BTC`. */
  id: string;
  base: BaseAsset;
  /** Full lifecycle row (approx table, e2ePtb, flags). */
  row: LifecycleTestMarketRow;
  /** `buildOpenPositionTx` on integration (larger collateral). */
  integrationOpen: {
    collateral: bigint;
    leverage: number;
    isLong: boolean;
  };
  /** `buildOpenPositionTx` on simulate (small collateral + optional simulateLeverage). */
  simulateOpen: {
    collateral: bigint;
    leverage: number;
    isLong: boolean;
  };
  /** `buildIncreasePositionTx` (collateral + leverage for on-chain resize sizing). */
  increase: { collateral: bigint; leverage: number };
  depositCollateral: bigint;
  withdrawCollateral: bigint;
  /**
   * Sizes/collateral for **stateful** simulate (existing position on reference account).
   * Mirrors legacy `tx-builders-simulate` BTC constants, scaled per-market via `e2ePtb`.
   */
  statefulSimulate: {
    depositCollateral: bigint;
    withdrawAmount: bigint;
    increaseCollateral: bigint;
    increaseSize: bigint;
    decreaseSize: bigint;
  };
};

function basesInOrder(): BaseAsset[] {
  return LIFECYCLE_TEST_BASE_ORDER.filter((b) => LIFECYCLE_TEST_MARKETS[b] != null);
}

/**
 * All scratch scenarios for currently configured testnet markets (same set as `activeLifecycleTestBases()`).
 */
export function scratchTradingScenarios(): ScratchTradingScenario[] {
  return basesInOrder().map((base) => {
    const row = lifecycleRow(base);
    const levSim = row.simulateLeverage ?? row.leverage;
    return {
      id: `scratch-${base}`,
      base,
      row,
      integrationOpen: {
        collateral: row.openCollateral,
        leverage: row.leverage,
        isLong: row.isLong,
      },
      simulateOpen: {
        collateral: row.simulateOpenCollateral,
        leverage: levSim,
        isLong: row.isLong,
      },
      increase: { collateral: LIFECYCLE_INCREASE_COLLATERAL_USDC, leverage: row.leverage },
      depositCollateral: LIFECYCLE_DEPOSIT_COLLATERAL_USDC,
      withdrawCollateral: LIFECYCLE_WITHDRAW_COLLATERAL_USDC,
      statefulSimulate: {
        depositCollateral: 1_000_000n,
        withdrawAmount: 1_000_000n,
        increaseCollateral: row.e2ePtb.increaseCollateral,
        increaseSize: row.e2ePtb.increaseSize,
        decreaseSize: row.e2ePtb.decreaseSize,
      },
    };
  });
}
