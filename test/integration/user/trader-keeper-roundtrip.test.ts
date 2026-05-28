/**
 * Integration: keeper open → cooldown → closePositionByKeeper on a dedicated ticker slot.
 * Self-contained roundtrip (does not rely on external positions left open for e2e).
 */
import { Transaction } from "@mysten/sui/transactions";
import { closePositionByKeeper, openPositionByKeeper, updateFundingRate } from "@waterx/sdk";
import { describe, expect, it } from "vitest";

import { getMarketData } from "../../../src/fetch.ts";
import { rawPrice } from "../../../src/utils/math.ts";
import {
  activeLifecycleTickersForClient,
  lifecycleTickerRow,
} from "../../helpers/e2e/lifecycle-test-markets.ts";
import { refreshOraclePricesForTradingEdge } from "../../helpers/trading/run-trading-scenario.ts";
import {
  ensureUserAccountForIntegration,
  selectWalletCoinsCoveringAmount,
} from "../helpers/account-bootstrap.ts";
import { tickerRowApproxAcceptableUsdHint } from "../helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipOracleTransient,
  execTx,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
  sleep,
} from "../setup.ts";

describe.skipIf(!isIntegrationTraderConfigured())("Integration: keeper roundtrip + funding", () => {
  it("updateFundingRate executes on BTCUSD", async (ctx) => {
    await clientInit;
    const trader = loadIntegrationTraderKeypair();
    const ticker = activeLifecycleTickersForClient(client)[0];
    if (!ticker) {
      ctx.skip("No lifecycle tickers on deployment");
      return;
    }

    const result = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execTx(
        (() => {
          const tx = new Transaction();
          updateFundingRate(client, tx, { ticker });
          return tx;
        })(),
        trader,
        { gasBudget: integrationGasBudget("keeper") },
      ),
    );
    if (result === undefined) return;
    assertSuccess(result);
  }, 180_000);

  it("openPositionByKeeper then closePositionByKeeper on an empty ticker slot", async (ctx) => {
    await clientInit;

    const trader = loadIntegrationTraderKeypair();
    const owner = trader.getPublicKey().toSuiAddress();
    const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

    const tickers = activeLifecycleTickersForClient(client);
    if (!tickers.length) {
      ctx.skip("No lifecycle tickers configured on deployment");
      return;
    }

    let picked: string | undefined;
    for (const ticker of tickers) {
      const rows = await listAccountPositionsInMarket(client, accountId, ticker);
      if (rows.length === 0) {
        picked = ticker;
        break;
      }
    }
    if (!picked) {
      ctx.skip(
        "All lifecycle tickers already have a position — run persistent-state or close-one first",
      );
      return;
    }

    const rowHint = lifecycleTickerRow(picked);
    const usdcType = client.getPoolTokenType("USDCUSD");
    const openCollateral = 8_000_000n;
    const openSize = rowHint.e2ePtb.openSize;

    const { coins, totalBalance } = await selectWalletCoinsCoveringAmount(
      client,
      owner,
      usdcType,
      openCollateral,
    );
    if (totalBalance < openCollateral) {
      ctx.skip(`Need ${openCollateral} wallet USDC for keeper open; have ${totalBalance}`);
      return;
    }

    const openRaw = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execBuiltTxWithCooldownRetries(
        async () => {
          const tx = new Transaction();
          await refreshOraclePricesForTradingEdge(tx, client, [picked!]);
          const primary = tx.object(coins[0]!.objectId);
          if (coins.length > 1) {
            tx.mergeCoins(
              primary,
              coins.slice(1).map((c) => tx.object(c.objectId)),
            );
          }
          const collArg =
            totalBalance === openCollateral
              ? primary
              : tx.splitCoins(primary, [openCollateral])[0]!;
          if (totalBalance > openCollateral) {
            tx.transferObjects([primary], owner);
          }
          openPositionByKeeper(client, tx, {
            ticker: picked!,
            accountObjectAddress: accountId,
            collateralType: usdcType,
            collateralCoin: collArg,
            isLong: true,
            size: openSize,
            acceptablePrice: rawPrice(Number(tickerRowApproxAcceptableUsdHint(rowHint))),
          });
          return tx;
        },
        trader,
        { cooldownTickers: [picked!], gasBudget: integrationGasBudget("keeper") },
      ),
    );
    if (openRaw === undefined) return;
    assertSuccess(openRaw);

    const opened = await listAccountPositionsInMarket(client, accountId, picked);
    expect(opened.length).toBeGreaterThan(0);
    const positionId = opened[0]!.positionId;
    if (positionId === 0n) {
      ctx.skip("Could not read position_id after keeper open");
      return;
    }

    let cooldownMs = 3500;
    try {
      const md = await getMarketData(client, { ticker: picked });
      cooldownMs = Math.max(cooldownMs, Number(md.cooldown_ms) + 500);
    } catch {
      /* default */
    }
    await sleep(cooldownMs);

    const closeRaw = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execBuiltTxWithCooldownRetries(
        async () => {
          const tx = new Transaction();
          await refreshOraclePricesForTradingEdge(tx, client, [picked!]);
          closePositionByKeeper(client, tx, {
            ticker: picked!,
            collateralType: usdcType,
            positionId,
            acceptablePrice: rawPrice(1),
          });
          return tx;
        },
        trader,
        { cooldownTickers: [picked!], gasBudget: integrationGasBudget("keeper") },
      ),
    );
    if (closeRaw === undefined) return;
    assertSuccess(closeRaw);

    const after = await listAccountPositionsInMarket(client, accountId, picked);
    expect(after.length).toBe(0);
  }, 600_000);
});
