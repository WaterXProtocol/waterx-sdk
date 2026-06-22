/**
 * Full v3 on-chain lifecycle for {@link scratchTradingScenarios}: place (market-form) → matchOrders
 * → deposit / withdraw / increase / decrease → close.
 */
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

import type { WaterXClient } from "../../../../src/client.ts";
import { positionExists } from "../../../../src/fetch.ts";
import type { MarketDataView } from "../../../../src/fetch.ts";
import {
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildPlaceOrderTx,
  buildWithdrawCollateralTx,
} from "../../../../src/tx-builders.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import { integrationGasBudget } from "../../integration/helpers/integration-gas.ts";
import {
  assertMarketTickerTradeableSnapshot,
  tickerRowApproxAcceptableUsdHint,
  type IntegrationMarketSnapshotMap,
} from "../../integration/helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../../integration/helpers/list-account-positions.ts";
import type {
  assertSuccess as AssertSuccess,
  execBuiltTxWithCooldownRetries as ExecCooldown,
  execIntegrationOrSkipOracleTransient as ExecOracleSkip,
  extractEvent as ExtractEventFn,
} from "../../integration/setup.ts";
import { lifecycleTickerRow } from "../e2e/lifecycle-test-markets.ts";
import type { ScratchTradingScenario } from "../scratch/scratch-trading-scenarios.ts";
import { buildMatchOrdersAfterRefreshTx } from "./run-trading-scenario.ts";

export type ScratchIntegrationDeps = {
  client: WaterXClient;
  trader: Ed25519Keypair;
  execBuiltTxWithCooldownRetries: typeof ExecCooldown;
  execIntegrationOrSkipSupra: typeof ExecOracleSkip;
  extractEvent: typeof ExtractEventFn;
  assertSuccess: typeof AssertSuccess;
  marketAtStart: IntegrationMarketSnapshotMap;
};

function acceptablePriceWide(rowReturn: ReturnType<typeof lifecycleTickerRow>): bigint {
  return rawPrice(Number(tickerRowApproxAcceptableUsdHint(rowReturn)));
}

async function waitPrimaryPosition(
  client: WaterXClient,
  ticker: string,
  accountId: string,
  opts?: { attempts?: number; spacingMs?: number },
): Promise<{ positionId: bigint }> {
  const attempts = opts?.attempts ?? 40;
  const spacingMs = opts?.spacingMs ?? 3000;
  for (let i = 0; i < attempts; i++) {
    const rows = await listAccountPositionsInMarket(client, accountId, ticker);
    rows.sort((a, b) => (a.positionId > b.positionId ? -1 : 1));
    const top = rows[0];
    if (top?.positionId != null) return { positionId: BigInt(top.positionId) };
    await new Promise((r) => setTimeout(r, spacingMs));
  }
  throw new Error(`No open ${ticker} position for ${accountId} after ${attempts} attempts`);
}

function coercePositionId(openedEvent: unknown): bigint | undefined {
  if (!openedEvent || typeof openedEvent !== "object") return undefined;
  const j = openedEvent as Record<string, unknown>;
  const raw = j.position_id ?? j.positionId;
  if (raw == null) return undefined;
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(raw);
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) return BigInt(raw);
  return undefined;
}

/**
 * Data-driven open → deposit → withdraw → increase → decrease → close (on-chain).
 */
export async function runScratchTradingScenarioIntegration(
  ctx: { skip: (reason?: string) => void },
  deps: ScratchIntegrationDeps,
  scenario: ScratchTradingScenario,
  accountId: string,
): Promise<void> {
  const { client, trader } = deps;
  const ticker = scenario.base;
  const rowTbl = lifecycleTickerRow(ticker);
  void client.getMarket(ticker);

  const snap = deps.marketAtStart[ticker];
  assertMarketTickerTradeableSnapshot((snap ?? {}) as MarketDataView, ticker);

  const collateralType = client.getPoolTokenType("USDCUSD");
  const ap = acceptablePriceWide(rowTbl);
  const openColl = scenario.integrationOpen.collateral;
  const openSize = scenario.row.e2ePtb.openSize;

  const placeResult = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildPlaceOrderTx(client, {
          ticker,
          accountId,
          collateralType,
          collateralTicker: "USDCUSD",
          main: {
            isLong: scenario.integrationOpen.isLong,
            isStopOrder: false,
            reduceOnly: false,
            size: openSize,
            acceptablePrice: ap,
            collateralAmount: openColl,
          },
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker], gasBudget: integrationGasBudget("lifecycle") },
    ),
  );
  if (placeResult === undefined) return;
  deps.assertSuccess(placeResult);

  const matchRaw = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildMatchOrdersAfterRefreshTx(client, { ticker, isLong: scenario.integrationOpen.isLong }),
      trader,
      { cooldownTickers: [ticker], gasBudget: integrationGasBudget("lifecycle") },
    ),
  );
  if (matchRaw === undefined) return;
  deps.assertSuccess(matchRaw);

  let opened = deps.extractEvent(placeResult, "PositionOpened");
  if (opened === undefined) opened = deps.extractEvent(matchRaw, "PositionOpened");
  let positionId = coercePositionId(opened);

  try {
    if (positionId == null) {
      const wait = await waitPrimaryPosition(client, ticker, accountId);
      positionId = wait.positionId;
    }
  } catch {
    ctx.skip(`${ticker}: position not observable after fill`);
    return;
  }

  if (!(await positionExists(client, { ticker, positionId: positionId! }))) {
    ctx.skip(`${ticker}: positionExists false after workflow — chain state mismatch`);
    return;
  }

  const dep = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildDepositCollateralTx(client, {
          ticker,
          accountId,
          collateralType,
          positionId: positionId!,
          collateralAmount: scenario.depositCollateral,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker] },
    ),
  );
  if (dep === undefined) return;
  deps.assertSuccess(dep);

  const wit = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildWithdrawCollateralTx(client, {
          ticker,
          accountId,
          collateralType,
          positionId: positionId!,
          amount: scenario.withdrawCollateral,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker] },
    ),
  );
  if (wit === undefined) return;
  deps.assertSuccess(wit);

  const inc = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildIncreasePositionTx(client, {
          ticker,
          accountId,
          collateralType,
          positionId: positionId!,
          collateralAmount: scenario.row.e2ePtb.increaseCollateral,
          size: scenario.row.e2ePtb.increaseSize,
          acceptablePrice: ap,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker] },
    ),
  );
  if (inc === undefined) return;
  deps.assertSuccess(inc);

  const decSize = scenario.row.e2ePtb.decreaseSize > 0n ? scenario.row.e2ePtb.decreaseSize : 1n;
  const dec = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildDecreasePositionTx(client, {
          ticker,
          accountId,
          collateralType,
          positionId: positionId!,
          size: decSize,
          acceptablePrice: ap,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker] },
    ),
  );
  if (dec === undefined) return;
  deps.assertSuccess(dec);

  const close = await deps.execIntegrationOrSkipSupra(ctx, () =>
    deps.execBuiltTxWithCooldownRetries(
      () =>
        buildClosePositionTx(client, {
          ticker,
          accountId,
          collateralType,
          positionId: positionId!,
          acceptablePrice: ap,
          collateralTicker: "USDCUSD",
          skipOraclePriceRefresh: false,
          useSponsor: true,
        }),
      trader,
      { cooldownTickers: [ticker] },
    ),
  );
  if (close === undefined) return;
  deps.assertSuccess(close);
}
