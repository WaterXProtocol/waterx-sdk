import type { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import type { BaseAsset } from "../../../src/constants.ts";
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildWithdrawCollateralTx,
} from "../../../src/tx-builders.ts";
import type { DiscoveredPosition } from "../e2e/discover-on-chain-position.ts";
import type { LifecycleTestMarketRow } from "../e2e/lifecycle-test-markets.ts";
import {
  alignExplicitTradingSize,
  computeValidPartialDecreaseSize,
  getMarketTradingSizeConstraints,
  MATRIX_SKIP_PREFIX,
} from "../trading/market-trading-size-constraints.ts";
import { WATERX_PERP_ABORT } from "../waterx-perp-error-codes.ts";

const ONE_USDC = 1_000_000n;

export type DerivedOpExpect =
  | { kind: "success"; minCommands: number }
  | { kind: "abort"; abortCode: number; locationIncludes?: string };

export type DerivedTradingMatrixCase = {
  op: "increase" | "decrease" | "deposit" | "withdraw" | "close";
  polarity: "positive" | "negative";
  label: string;
  expect: DerivedOpExpect;
  buildTx: (
    client: WaterXClient,
    d: DiscoveredPosition,
    row: LifecycleTestMarketRow,
  ) => Promise<Transaction>;
};

function pid(d: DiscoveredPosition): number {
  return Number(d.positionId);
}

/**
 * Per-op positive/negative simulate matrix for one discovered open position.
 * `ghostPositionId` should be `marketSummary.nextPositionId + 100n` (non-existent id).
 */
export function deriveTradingMatrixCases(
  d: DiscoveredPosition,
  row: LifecycleTestMarketRow,
  ghostPositionId: bigint,
): DerivedTradingMatrixCase[] {
  const accountId = d.accountObjectAddress;
  const base = d.base as BaseAsset;
  const pos = d.position;
  const collateral = d.collateral;

  // Discovered mainnet positions often sit near max leverage; even 1% withdraw
  // can hit 104 on thin rows. Use 0.25% of collateral (25 bps), floored at 1 unit.
  const withdrawPositiveRaw = (pos.collateralAmount * 25n) / 10_000n;
  const withdrawAmt = withdrawPositiveRaw > 0n ? withdrawPositiveRaw : 1n;

  const cases: DerivedTradingMatrixCase[] = [
    {
      op: "increase",
      polarity: "positive",
      label: "increase — positive (collateral + size)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: async (client) => {
        const entry = client.getMarketEntry(base);
        const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.marketId);
        const aligned = alignExplicitTradingSize(BigInt(row.e2ePtb.increaseSize), minSize, lotSize);
        if (aligned == null) {
          throw new Error(
            `${MATRIX_SKIP_PREFIX}NO_VALID_INCREASE_SIZE base=${base} raw=${row.e2ePtb.increaseSize} min=${minSize} lot=${lotSize}`,
          );
        }
        return buildIncreasePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: aligned,
        });
      },
    },
    {
      op: "increase",
      polarity: "negative",
      label: "increase — negative (ghost positionId → err_position_not_found)",
      expect: {
        kind: "abort",
        abortCode: WATERX_PERP_ABORT.POSITION_NOT_FOUND,
        locationIncludes: "err_position_not_found",
      },
      buildTx: (client) =>
        buildIncreasePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: Number(ghostPositionId),
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: row.e2ePtb.increaseSize,
        }),
    },
    {
      op: "decrease",
      polarity: "positive",
      label: "decrease — positive (partial)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: async (client) => {
        const entry = client.getMarketEntry(base);
        const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.marketId);
        const dec = computeValidPartialDecreaseSize(pos.size, minSize, lotSize);
        if (dec == null) {
          throw new Error(
            `${MATRIX_SKIP_PREFIX}NO_VALID_PARTIAL_DECREASE base=${base} positionSize=${pos.size} min=${minSize} lot=${lotSize}`,
          );
        }
        return buildDecreasePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
          size: dec,
        });
      },
    },
    {
      op: "decrease",
      polarity: "negative",
      label: "decrease — negative (size > position)",
      expect: {
        kind: "abort",
        abortCode: WATERX_PERP_ABORT.POSITION_FLIP_NOT_SUPPORTED,
        locationIncludes: "err_position_flip_not_supported",
      },
      buildTx: (client) =>
        buildDecreasePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
          size: pos.size + 1n,
        }),
    },
    {
      op: "deposit",
      polarity: "positive",
      label: "deposit collateral — positive (+1 unit)",
      expect: { kind: "success", minCommands: 11 },
      buildTx: (client) =>
        buildDepositCollateralTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
          collateralAmount: ONE_USDC,
        }),
    },
    {
      op: "deposit",
      polarity: "negative",
      label: "deposit collateral — negative (ghost position)",
      expect: {
        kind: "abort",
        abortCode: WATERX_PERP_ABORT.POSITION_NOT_FOUND,
        locationIncludes: "err_position_not_found",
      },
      buildTx: (client) =>
        buildDepositCollateralTx(client, {
          accountId,
          base,
          collateral,
          positionId: Number(ghostPositionId),
          collateralAmount: ONE_USDC,
        }),
    },
    {
      op: "withdraw",
      polarity: "positive",
      label: "withdraw collateral — positive (0.25%)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: (client) =>
        buildWithdrawCollateralTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
          amount: withdrawAmt,
        }),
    },
    {
      op: "withdraw",
      polarity: "negative",
      label: "withdraw collateral — negative (ghost positionId → err_position_not_found)",
      expect: {
        kind: "abort",
        abortCode: WATERX_PERP_ABORT.POSITION_NOT_FOUND,
        locationIncludes: "err_position_not_found",
      },
      buildTx: (client) =>
        buildWithdrawCollateralTx(client, {
          accountId,
          base,
          collateral,
          positionId: Number(ghostPositionId),
          amount: withdrawAmt,
        }),
    },
    {
      op: "close",
      polarity: "positive",
      label: "close — positive",
      expect: { kind: "success", minCommands: 10 },
      buildTx: (client) =>
        buildClosePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: pid(d),
        }),
    },
    {
      op: "close",
      polarity: "negative",
      label: "close — negative (ghost position)",
      expect: {
        kind: "abort",
        abortCode: WATERX_PERP_ABORT.POSITION_NOT_FOUND,
        locationIncludes: "err_position_not_found",
      },
      buildTx: (client) =>
        buildClosePositionTx(client, {
          accountId,
          base,
          collateral,
          positionId: Number(ghostPositionId),
        }),
    },
  ];

  return cases;
}
