/**
 * E2E: discovered position — increase / decrease / deposit / withdraw / close (simulate).
 */
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildWithdrawCollateralTx,
} from "@waterx/perp-sdk";
import { beforeAll, describe, it } from "vitest";

import {
  discoverStatefulSimulatePosition,
  DISCOVERY_OPTS_STATEFUL_SIMULATE,
  posCollateralAmount,
  posIsLong,
  posSize,
  type DiscoveredPosition,
} from "../helpers/e2e/discover-on-chain-position.ts";
import { client, e2eNetwork, rawPrice } from "../helpers/e2e/e2e-client.ts";
import { lifecycleTickerRow } from "../helpers/e2e/lifecycle-test-markets.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfStateDependent,
} from "../helpers/e2e/simulate-assertions.ts";
import { runBuiltTradingTx } from "../helpers/trading/run-trading-scenario.ts";
import { closeOrDecreaseAcceptablePrice } from "../integration/helpers/integration-market-snapshot.ts";

function assertDiscoveredTradingSim(ctx: { skip: (reason?: string) => void }, sim: unknown): void {
  if (sim === undefined) return;
  if (skipSimulateIfStateDependent(ctx, sim)) return;
  assertSimulateSuccess(sim, 1);
}

describe(`trade on discovered position (${e2eNetwork})`, () => {
  let discovered: DiscoveredPosition | null;

  beforeAll(async () => {
    discovered = await discoverStatefulSimulatePosition(client, DISCOVERY_OPTS_STATEFUL_SIMULATE);
  }, 300_000);

  it("simulates increase on discovered row", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const row = lifecycleTickerRow(d.ticker);
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const ap = rawPrice(Math.max(1, Math.ceil(row.approxUsdHint * 4)));
    const sim = await runBuiltTradingTx({
      client,
      mode: "simulate",
      simulateSender: d.ownerAddress,
      oracleTransientCtx: ctx,
      buildTx: () =>
        buildIncreasePositionTx(client, {
          accountId: d.accountObjectAddress,
          ticker: d.ticker,
          collateralType,
          positionId: d.positionId,
          collateralAmount: row.e2ePtb.increaseCollateral,
          size: row.e2ePtb.increaseSize,
          acceptablePrice: ap,
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
    });
    if (sim === undefined) return;
    assertSimulateSuccess(sim, 1);
  }, 180_000);

  it("simulates partial decrease on discovered row", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const row = lifecycleTickerRow(d.ticker);
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const dec = posSize(d.position) / 10n;
    if (dec <= 0n) {
      ctx.skip("Position size too small for partial decrease probe");
      return;
    }
    const ap = closeOrDecreaseAcceptablePrice(posIsLong(d.position), row);
    const sim = await runBuiltTradingTx({
      client,
      mode: "simulate",
      simulateSender: d.ownerAddress,
      oracleTransientCtx: ctx,
      buildTx: () =>
        buildDecreasePositionTx(client, {
          accountId: d.accountObjectAddress,
          ticker: d.ticker,
          collateralType,
          positionId: d.positionId,
          size: dec,
          acceptablePrice: ap,
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
    });
    if (sim === undefined) return;
    assertDiscoveredTradingSim(ctx, sim);
  }, 180_000);

  it("simulates deposit collateral (+1 USDC unit)", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const sim = await runBuiltTradingTx({
      client,
      mode: "simulate",
      simulateSender: d.ownerAddress,
      oracleTransientCtx: ctx,
      buildTx: () =>
        buildDepositCollateralTx(client, {
          accountId: d.accountObjectAddress,
          ticker: d.ticker,
          collateralType,
          positionId: d.positionId,
          collateralAmount: 1_000_000n,
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
    });
    if (sim === undefined) return;
    assertSimulateSuccess(sim, 1);
  }, 180_000);

  it("simulates tiny withdraw collateral", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const withdrawAmt = (posCollateralAmount(d.position) * 25n) / 10_000n || 1n;
    const sim = await runBuiltTradingTx({
      client,
      mode: "simulate",
      simulateSender: d.ownerAddress,
      oracleTransientCtx: ctx,
      buildTx: () =>
        buildWithdrawCollateralTx(client, {
          accountId: d.accountObjectAddress,
          ticker: d.ticker,
          collateralType,
          positionId: d.positionId,
          amount: withdrawAmt,
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
    });
    if (sim === undefined) return;
    assertSimulateSuccess(sim, 1);
  }, 180_000);

  it("simulates close with wide acceptable price", async (ctx) => {
    const d = discovered;
    if (!d) {
      ctx.skip("No eligible discovered position");
      return;
    }
    const row = lifecycleTickerRow(d.ticker);
    const collateralType = client.getPoolTokenType(d.collateralPoolTicker);
    const ap = closeOrDecreaseAcceptablePrice(posIsLong(d.position), row);
    const sim = await runBuiltTradingTx({
      client,
      mode: "simulate",
      simulateSender: d.ownerAddress,
      oracleTransientCtx: ctx,
      buildTx: () =>
        buildClosePositionTx(client, {
          accountId: d.accountObjectAddress,
          ticker: d.ticker,
          collateralType,
          positionId: d.positionId,
          acceptablePrice: ap,
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
    });
    if (sim === undefined) return;
    assertDiscoveredTradingSim(ctx, sim);
  }, 180_000);
});
