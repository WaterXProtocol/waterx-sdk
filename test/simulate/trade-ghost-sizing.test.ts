/**
 * E2E: close / resize / collateral **tx-builders** with ghost `position_id` (no on-chain discovery — expect Move abort, still exercises sponsor + oracle PTB).
 */
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildWithdrawCollateralTx,
} from "@waterx/perp-sdk";
import type { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import { lifecycleTickerRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  simulateWithTransientRetry,
  skipHermesIfFeedUnavailable,
  skipSimulateIfOracleTransient,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";
const GHOST_POSITION_ID = 999_999_999n;

async function simulateTxFromBuilder(
  ctx: { skip: (reason?: string) => void },
  build: () => Promise<Transaction>,
  sender: string,
) {
  let tx: Transaction;
  try {
    tx = await build();
  } catch (e) {
    if (skipHermesIfFeedUnavailable(ctx, e)) return;
    throw e;
  }
  tx.setSender(sender);
  const sim = await simulateWithTransientRetry(() => client.simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, sim)) return;
  expect(sim).toBeDefined();
}

describe(`trade ghost sizing (${e2eNetwork})`, () => {
  const row = lifecycleTickerRow("BTCUSD");
  const ap = rawPrice(Math.max(1, Math.ceil(row.approxUsdHint * 4)));
  const collateralType = client.getPoolTokenType("USDCUSD");

  it("buildClosePositionTx simulates (ghost position)", async (ctx) => {
    await simulateTxFromBuilder(
      ctx,
      () =>
        buildClosePositionTx(client, {
          accountId: DUMMY_ACCOUNT,
          ticker: "BTCUSD",
          collateralType,
          positionId: GHOST_POSITION_ID,
          acceptablePrice: rawPrice(200_000),
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      DUMMY_ACCOUNT,
    );
  }, 180_000);

  it("buildIncreasePositionTx simulates (ghost position)", async (ctx) => {
    await simulateTxFromBuilder(
      ctx,
      () =>
        buildIncreasePositionTx(client, {
          accountId: DUMMY_ACCOUNT,
          ticker: "BTCUSD",
          collateralType,
          positionId: GHOST_POSITION_ID,
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: row.e2ePtb.increaseSize,
          acceptablePrice: ap,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      DUMMY_ACCOUNT,
    );
  }, 180_000);

  it("buildDecreasePositionTx simulates (ghost position)", async (ctx) => {
    await simulateTxFromBuilder(
      ctx,
      () =>
        buildDecreasePositionTx(client, {
          accountId: DUMMY_ACCOUNT,
          ticker: "BTCUSD",
          collateralType,
          positionId: GHOST_POSITION_ID,
          size: row.e2ePtb.decreaseSize,
          acceptablePrice: rawPrice(1),
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      DUMMY_ACCOUNT,
    );
  }, 180_000);

  it("buildDepositCollateralTx simulates (ghost position)", async (ctx) => {
    await simulateTxFromBuilder(
      ctx,
      () =>
        buildDepositCollateralTx(client, {
          accountId: DUMMY_ACCOUNT,
          ticker: "BTCUSD",
          collateralType,
          positionId: GHOST_POSITION_ID,
          collateralAmount: 1000n,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      DUMMY_ACCOUNT,
    );
  }, 180_000);

  it("buildWithdrawCollateralTx simulates (ghost position)", async (ctx) => {
    await simulateTxFromBuilder(
      ctx,
      () =>
        buildWithdrawCollateralTx(client, {
          accountId: DUMMY_ACCOUNT,
          ticker: "BTCUSD",
          collateralType,
          positionId: GHOST_POSITION_ID,
          amount: 1000n,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      DUMMY_ACCOUNT,
    );
  }, 180_000);
});
