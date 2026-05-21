/**
 * Maintains **persistent** per-market slots + minimal WLP balance on the integration wxa account.
 * Opens only when no position exists on that ticker (keeper path).
 */
import { Transaction } from "@mysten/sui/transactions";
import { beforeAll, describe, expect, it } from "vitest";

import { getAccountBalance } from "../../../src/fetch.ts";
import { buildMintWlpTx } from "../../../src/tx-builders.ts";
import { openPositionByKeeper } from "../../../src/user/trading.ts";
import { lifecycleTickerRow } from "../../helpers/e2e/lifecycle-test-markets.ts";
import { refreshOraclePricesForTradingEdge } from "../../helpers/trading/run-trading-scenario.ts";
import {
  buildDepositUsdcFromWalletTx,
  ensureUserAccountForIntegration,
  selectWalletCoinsCoveringAmount,
} from "../helpers/account-bootstrap.ts";
import {
  activeE2ePersistentPerpTickers,
  E2E_PERSISTENT_WLP,
  e2ePersistentPerpRow,
  e2ePersistentPerpTickersForClient,
} from "../helpers/e2e-persistent-state.ts";
import {
  assertMarketTickerTradeableSnapshot,
  fetchIntegrationMarketSummaries,
  keeperOpenAcceptablePrice,
  type IntegrationMarketSnapshotMap,
} from "../helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execBuiltTxWithCooldownRetries,
  execIntegrationOrSkipOracleTransient,
  execTx,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: e2e persistent state (per-ticker slots + WLP)",
  () => {
    let configuredTickers: string[] = [];
    let marketAtStart: IntegrationMarketSnapshotMap;

    beforeAll(async () => {
      await clientInit;
      configuredTickers = e2ePersistentPerpTickersForClient(
        client.config.packages.waterx_perp.markets ?? {},
      );
      marketAtStart = await fetchIntegrationMarketSummaries(client, configuredTickers);
    }, 180_000);

    describe.each(activeE2ePersistentPerpTickers())("%s perp slot", (ticker: string) => {
      it("keeper opens one small position when this market has none for the account", async (ctx) => {
        if (!configuredTickers.includes(ticker)) {
          ctx.skip(`Ticker ${ticker} missing from deployment`);
          return;
        }
        const trader = loadIntegrationTraderKeypair();
        const owner = trader.getPublicKey().toSuiAddress();
        const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

        const snap = marketAtStart[ticker];
        assertMarketTickerTradeableSnapshot(snap, ticker);

        const openRows = await listAccountPositionsInMarket(client, accountId, ticker);
        if (openRows.length > 0) {
          expect(openRows.length).toBeGreaterThan(0);
          return;
        }

        const row = e2ePersistentPerpRow(ticker);
        const rowHint = lifecycleTickerRow(ticker);
        const usdcType = client.getPoolTokenType("USDCUSD");

        // Keeper open draws collateral from the **wallet** `Coin<USDC>` (see open-smoke) — wxa
        // stored USDC is not required for this path.
        const { coins, totalBalance } = await selectWalletCoinsCoveringAmount(
          client,
          owner,
          usdcType,
          row.openCollateral,
        );
        if (totalBalance < row.openCollateral) {
          ctx.skip(
            `Wallet USDC insufficient for keeper open (${row.openCollateral}); have ${totalBalance}`,
          );
          return;
        }

        const result = await execIntegrationOrSkipOracleTransient(ctx, () =>
          execBuiltTxWithCooldownRetries(
            async () => {
              const tx = new Transaction();
              await refreshOraclePricesForTradingEdge(tx, client, [ticker]);
              const primary = tx.object(coins[0]!.objectId);
              if (coins.length > 1) {
                tx.mergeCoins(
                  primary,
                  coins.slice(1).map((c) => tx.object(c.objectId)),
                );
              }
              const collArg =
                totalBalance === row.openCollateral
                  ? primary
                  : tx.splitCoins(primary, [row.openCollateral])[0]!;
              if (totalBalance > row.openCollateral) {
                tx.transferObjects([primary], owner);
              }
              openPositionByKeeper(client, tx, {
                ticker,
                accountObjectAddress: accountId,
                collateralType: usdcType,
                collateralCoin: collArg,
                isLong: row.isLong,
                size: row.openSize,
                acceptablePrice: keeperOpenAcceptablePrice(row.isLong, rowHint),
              });
              return tx;
            },
            trader,
            { cooldownTickers: [ticker], gasBudget: 280_000_000 },
          ),
        );
        if (result === undefined) return;
        assertSuccess(result);

        const after = await listAccountPositionsInMarket(client, accountId, ticker);
        expect(after.length).toBeGreaterThan(0);
      }, 400_000);
    });

    it("mints WLP into the wxa account when WLP balance is below minimum", async (ctx) => {
      const trader = loadIntegrationTraderKeypair();
      const owner = trader.getPublicKey().toSuiAddress();
      const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

      const wlpType = client.wlpType();
      const usdcType = client.getPoolTokenType("USDCUSD");
      const { minBalanceRaw, mintPullUsdc } = E2E_PERSISTENT_WLP;

      const wlpBal = await getAccountBalance(client, accountId, wlpType);
      if (wlpBal >= minBalanceRaw) {
        expect(wlpBal).toBeGreaterThanOrEqual(minBalanceRaw);
        return;
      }

      let usdcFree = await getAccountBalance(client, accountId, usdcType);
      const needFree = mintPullUsdc + 5_000_000n;
      if (usdcFree < needFree) {
        const need = needFree - usdcFree;
        const depTx = await buildDepositUsdcFromWalletTx(client, owner, accountId, need);
        const depResult = await execTx(depTx, trader, { gasBudget: 80_000_000 });
        assertSuccess(depResult);
        usdcFree = await getAccountBalance(client, accountId, usdcType);
      }
      expect(usdcFree).toBeGreaterThanOrEqual(mintPullUsdc);

      const mintResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execBuiltTxWithCooldownRetries(
          () =>
            buildMintWlpTx(client, {
              accountId,
              depositTokenType: usdcType,
              depositTicker: "USDCUSD",
              depositAmount: mintPullUsdc,
              minLpAmount: 1n,
              skipOraclePriceRefresh: false,
            }),
          trader,
          { gasBudget: 280_000_000 },
        ),
      );
      if (mintResult === undefined) return;
      assertSuccess(mintResult);

      const after = await getAccountBalance(client, accountId, wlpType);
      expect(after).toBeGreaterThanOrEqual(minBalanceRaw);
    }, 400_000);
  },
);
