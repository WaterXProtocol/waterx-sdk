import type { Transaction } from "@mysten/sui/transactions";

import type { WaterXClient } from "../../../src/client.ts";
import { rawPrice } from "../../../src/utils/math.ts";
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildWithdrawCollateralTx,
} from "../../../src/tx-builders.ts";
import {
  posCollateralAmount,
  posSize,
  type DiscoveredPosition,
} from "../e2e/discover-on-chain-position.ts";
import type { LifecycleTestTickerRow } from "../e2e/lifecycle-test-markets.ts";
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
    row: LifecycleTestTickerRow,
  ) => Promise<Transaction>;
};

function pid(d: DiscoveredPosition): number {
  return Number(d.positionId);
}

/** Loose cap for simulate-only executes — multiples of oracle USD hint. */
function acceptablePriceFromRow(row: LifecycleTestTickerRow): bigint {
  return rawPrice(Math.max(1, Math.ceil(row.approxUsdHint * 4)));
}

/**
 * Per-op positive/negative simulate matrix for one discovered open position.
 * `ghostPositionId` should be a non-existent id (e.g. `next_position_id + 100n`).
 */
export function deriveTradingMatrixCases(
  d: DiscoveredPosition,
  row: LifecycleTestTickerRow,
  ghostPositionId: bigint,
): DerivedTradingMatrixCase[] {
  const accountId = d.accountObjectAddress;
  const ticker = d.ticker;
  const pos = d.position;

  const withdrawPositiveRaw = (posCollateralAmount(pos) * 25n) / 10_000n;
  const withdrawAmt = withdrawPositiveRaw > 0n ? withdrawPositiveRaw : 1n;

  const cases: DerivedTradingMatrixCase[] = [
    {
      op: "increase",
      polarity: "positive",
      label: "increase — positive (collateral + size)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: async (client) => {
        const entry = client.getMarket(ticker);
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        const acceptablePrice = acceptablePriceFromRow(row);
        const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.market);
        const aligned = alignExplicitTradingSize(BigInt(row.e2ePtb.increaseSize), minSize, lotSize);
        if (aligned == null) {
          throw new Error(
            `${MATRIX_SKIP_PREFIX}NO_VALID_INCREASE_SIZE ticker=${ticker} raw=${row.e2ePtb.increaseSize} min=${minSize} lot=${lotSize}`,
          );
        }
        return buildIncreasePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: aligned,
          acceptablePrice,
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
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildIncreasePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: Number(ghostPositionId),
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: row.e2ePtb.increaseSize,
          acceptablePrice: acceptablePriceFromRow(row),
        });
      },
    },
    {
      op: "decrease",
      polarity: "positive",
      label: "decrease — positive (partial)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: async (client) => {
        const entry = client.getMarket(ticker);
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        const acceptablePrice = acceptablePriceFromRow(row);
        const { minSize, lotSize } = await getMarketTradingSizeConstraints(client, entry.market);
        const dec = computeValidPartialDecreaseSize(posSize(pos), minSize, lotSize);
        if (dec == null) {
          throw new Error(
            `${MATRIX_SKIP_PREFIX}NO_VALID_PARTIAL_DECREASE ticker=${ticker} positionSize=${posSize(pos)} min=${minSize} lot=${lotSize}`,
          );
        }
        return buildDecreasePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          size: dec,
          acceptablePrice,
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
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildDecreasePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          size: posSize(pos) + 1n,
          acceptablePrice: acceptablePriceFromRow(row),
        });
      },
    },
    {
      op: "deposit",
      polarity: "positive",
      label: "deposit collateral — positive (+1 unit)",
      expect: { kind: "success", minCommands: 11 },
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildDepositCollateralTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          collateralAmount: ONE_USDC,
        });
      },
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
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildDepositCollateralTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: Number(ghostPositionId),
          collateralAmount: ONE_USDC,
        });
      },
    },
    {
      op: "withdraw",
      polarity: "positive",
      label: "withdraw collateral — positive (0.25%)",
      expect: { kind: "success", minCommands: 10 },
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildWithdrawCollateralTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          amount: withdrawAmt,
        });
      },
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
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildWithdrawCollateralTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: Number(ghostPositionId),
          amount: withdrawAmt,
        });
      },
    },
    {
      op: "close",
      polarity: "positive",
      label: "close — positive",
      expect: { kind: "success", minCommands: 10 },
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildClosePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: pid(d),
          acceptablePrice: acceptablePriceFromRow(row),
        });
      },
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
      buildTx: (client) => {
        const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
        return buildClosePositionTx(client, {
          accountId,
          ticker,
          collateralType,
          positionId: Number(ghostPositionId),
          acceptablePrice: acceptablePriceFromRow(row),
        });
      },
    },
  ];

  return cases;
}
