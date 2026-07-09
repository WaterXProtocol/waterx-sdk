/**
 * Closes **one** perp position — opt-in destructive test.
 * Prefer `WATERX_INTEGRATION_CLOSE_BASE=BTCUSD` + optional `WATERX_INTEGRATION_POSITION_ID`.
 * Skipped unless `WATERX_INTEGRATION_CLOSE_ONE_POSITION=1`.
 */
import { describe, expect, it } from "vitest";

import { getAccountsByOwner, positionExists } from "../../../../src/perp/fetch.ts";
import { buildClosePositionTx } from "../../../../src/perp/tx-builders.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import {
  activeLifecycleTickersForClient,
  canonicalLifecycleTicker,
  lifecycleTickerRow,
} from "../../helpers/e2e/lifecycle-test-markets.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import { tickerRowApproxAcceptableUsdHint } from "../helpers/integration-market-snapshot.ts";
import { listAccountPositionsInMarket } from "../helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  clientInit,
  execBuiltTxWithCooldownRetries,
  execTx,
  extractEvent,
  integrationGasBudget,
  isIntegrationTraderConfigured,
  loadIntegrationTraderKeypair,
} from "../setup.ts";

async function resolvePositionToClose(
  ctx: { skip: (reason?: string) => void },
  accountId: string,
): Promise<{ ticker: string; positionId: bigint } | null> {
  const scanOrder = activeLifecycleTickersForClient(client);
  const closeBaseEnv = canonicalLifecycleTicker(
    process.env.WATERX_INTEGRATION_CLOSE_BASE?.trim() ?? "",
  );
  const genericPin = process.env.WATERX_INTEGRATION_POSITION_ID?.trim();
  const legacyBtcPin = process.env.WATERX_INTEGRATION_BTC_POSITION_ID?.trim();

  if (closeBaseEnv && scanOrder.includes(closeBaseEnv)) {
    const ticker = closeBaseEnv;
    if (genericPin) {
      const pid = BigInt(genericPin);
      const ex = await positionExists(client, { ticker, positionId: pid });
      if (!ex) {
        ctx.skip(`Pinned position ${genericPin} missing on ${ticker}`);
        return null;
      }
      return { ticker, positionId: pid };
    }
    const rows = await listAccountPositionsInMarket(client, accountId, ticker);
    rows.sort((a, b) => (a.positionId > b.positionId ? -1 : 1));
    const top = rows[0];
    if (!top) {
      ctx.skip(`No open ${ticker} position — set WATERX_INTEGRATION_POSITION_ID if needed`);
      return null;
    }
    return { ticker, positionId: top.positionId };
  }

  if (legacyBtcPin) {
    const ticker = "BTCUSD";
    const pid = BigInt(legacyBtcPin);
    const ex = await positionExists(client, { ticker, positionId: pid });
    if (!ex) {
      ctx.skip(`Legacy pinned BTC position ${legacyBtcPin} missing`);
      return null;
    }
    return { ticker, positionId: pid };
  }

  for (const ticker of scanOrder) {
    const rows = await listAccountPositionsInMarket(client, accountId, ticker);
    rows.sort((a, b) => (a.positionId > b.positionId ? -1 : 1));
    const top = rows[0];
    if (top) return { ticker, positionId: top.positionId };
  }

  ctx.skip(
    "No open lifecycle positions found. Set WATERX_INTEGRATION_CLOSE_BASE (+ optional POSITION_ID).",
  );
  return null;
}

const integrationCloseOneEnabled =
  isIntegrationTraderConfigured() &&
  process.env.WATERX_INTEGRATION_CLOSE_ONE_POSITION?.trim() === "1";

describe.skipIf(!integrationCloseOneEnabled)(
  "Integration: close one open perp position (opt-in destructive)",
  () => {
    it("closes a single position (pinned or newest across lifecycle tickers)", async (ctx) => {
      await clientInit();

      const trader = loadIntegrationTraderKeypair();

      let accountId: string;
      try {
        ({ accountId } = await ensureUserAccountForIntegration(client, trader, execTx));
      } catch (e) {
        const owner = trader.getPublicKey().toSuiAddress();
        const accounts = await getAccountsByOwner(client, owner);
        const envId = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
        const pick =
          envId &&
          accounts.some(
            (a) => a.replace(/^0x/i, "").toLowerCase() === envId.replace(/^0x/i, "").toLowerCase(),
          )
            ? envId
            : accounts[0];
        if (!pick) throw e instanceof Error ? e : new Error(String(e));
        accountId = pick;
      }

      const resolved = await resolvePositionToClose(ctx, accountId);
      if (!resolved) return;

      const collateralType = client.getPoolTokenType("USDCUSD");
      const ap = rawPrice(
        Number(tickerRowApproxAcceptableUsdHint(lifecycleTickerRow(resolved.ticker))),
      );

      const result = await execBuiltTxWithCooldownRetries(
        () =>
          buildClosePositionTx(client, {
            accountId,
            ticker: resolved.ticker,
            collateralType,
            positionId: resolved.positionId,
            acceptablePrice: ap,
            collateralTicker: "USDCUSD",
            skipOraclePriceRefresh: false,
            useSponsor: true,
          }),
        trader,
        { cooldownTickers: [resolved.ticker], gasBudget: integrationGasBudget("lifecycle") },
      );

      assertSuccess(result);
      expect(extractEvent(result, "PositionClosed")).toBeDefined();
    }, 420_000);
  },
);
