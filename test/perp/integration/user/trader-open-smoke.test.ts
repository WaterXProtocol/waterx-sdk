/**
 * Smallest integration proof: keeper-funded open (`openPositionByKeeper`) on deploy tickers — no lifecycle chain.
 */
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { getAccountsByOwner } from "../../../../src/perp/fetch.ts";
import { openPositionByKeeper } from "../../../../src/perp/user/trading.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
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
  extractEvent,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

describe.skipIf(!isIntegrationTraderConfigured())("Integration: keeper open smoke (v3)", () => {
  it("single openPositionByKeeper when a lifecycle ticker has zero position", async (ctx) => {
    await clientInit;

    const tickers = activeLifecycleTickersForClient(client);
    if (!tickers.length) {
      ctx.skip("No lifecycle tickers configured on deployment");
      return;
    }

    const trader = loadIntegrationTraderKeypair();
    const owner = trader.getPublicKey().toSuiAddress();

    let accountId: string;
    try {
      ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
    } catch {
      const accounts = await getAccountsByOwner(client, owner);
      const envId = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
      const pick =
        envId &&
        accounts.some(
          (a) => a.replace(/^0x/i, "").toLowerCase() === envId.replace(/^0x/i, "").toLowerCase(),
        )
          ? envId
          : accounts[0];
      if (!pick) {
        ctx.skip("Could not resolve wxa account");
        return;
      }
      accountId = pick;
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
      ctx.skip("All lifecycle tickers already have an open position for this account");
      return;
    }

    void client.getMarket(picked);
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
      ctx.skip(`Need ${openCollateral} wallet USDC for keeper collateral; have ${totalBalance}`);
      return;
    }

    const raw = await execIntegrationOrSkipOracleTransient(ctx, () =>
      execBuiltTxWithCooldownRetries(
        async () => {
          const tx = new Transaction();
          await refreshOraclePricesForTradingEdge(tx, client, [picked]);
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
            ticker: picked,
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
        { cooldownTickers: [picked], gasBudget: integrationGasBudget("keeper") },
      ),
    );
    if (raw === undefined) return;

    assertSuccess(raw);
    const opened = extractEvent(raw, "PositionOpened");
    expect(opened).toBeDefined();
  }, 420_000);
});
