/**
 * Integration: full new-trader onboarding chain.
 *
 *   1. bootstrap wxa account
 *   2. mint USD (CREDIT) from MOCK_USDC via native_custody
 *   3. deposit USDC → mint WLP (LP-pool deposit)
 *   4. stake 1 WLP into the WLP staking pool
 *   5. place a market BUY on BTCUSD with TP/SL pre-orders
 *   6. place a far-from-market limit BUY (parks in the limit book)
 *   7. keeper matchOrders on the BUY book — fills the market form, leaves the limit
 *   8. teardown: cancel the resting limit so the testnet book stays clean
 *
 * Runs as a single `it()` per user request, so every step contributes
 * to the on-chain audit trail of one onboarding flow.
 */
import { Transaction } from "@mysten/sui/transactions";
import { stake } from "@waterx/perp-sdk";
import { beforeAll, describe, expect, it } from "vitest";

import { ORDER_TAG_WILDCARD } from "../../../../src/constants.ts";
import { getAccountBalance, positionExists } from "../../../../src/fetch.ts";
import { buildCancelOrderTx, buildPlaceOrderTx } from "../../../../src/tx-builders.ts";
import { rawPrice } from "../../../../src/utils/math.ts";
import { ensureIntegrationMinCreditBalance } from "../../helpers/integration/ensure-credit-balance.ts";
import { buildMatchOrdersAfterRefreshTx } from "../../helpers/trading/run-trading-scenario.ts";
import { ensureUserAccountForIntegration } from "../helpers/account-bootstrap.ts";
import { ensureIntegrationMinWlpBalance } from "../helpers/ensure-wxa-balances.ts";
import { positionIdFromOpened } from "../helpers/scratch-lifecycle.ts";
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

const TICKER = "BTCUSD";
const COLLATERAL_TICKER = "USDCUSD";

// Tiny on purpose: keeps gas low and respects the testnet pool's min collateral.
const MARKET_ORDER_SIZE = rawPrice(0.0001);
const MARKET_ORDER_COLLATERAL = 5_000_000n;
const LIMIT_ORDER_SIZE = rawPrice(0.0001);
const LIMIT_ORDER_COLLATERAL = 5_000_000n;
const ACCEPTABLE_USD_CAP = 200_000; // slippage cap above any realistic BTC price
const LIMIT_TRIGGER_USD = 20_000; // far below market — limit parks, will not fill
const TP_USD = 200_000;
const SL_USD = 5_000;

describe.skipIf(!isIntegrationTraderConfigured())(
  "Integration: full onboarding (mint USD → WLP → stake → trade → keeper)",
  () => {
    beforeAll(async () => {
      await clientInit;
    }, 180_000);

    it("end-to-end onboarding chain", async (ctx) => {
      // ---- pre-flight: market + pool must be deployed on this network ----
      if (!client.config.packages.waterx_perp.markets[TICKER]) {
        ctx.skip(`${TICKER} market not deployed`);
        return;
      }
      if (!client.config.packages.waterx_staking?.pools?.WLP) {
        ctx.skip("WLP staking pool not deployed");
        return;
      }

      const trader = loadIntegrationTraderKeypair();
      const owner = trader.getPublicKey().toSuiAddress();

      // ---- step 1: bootstrap wxa account ----
      const { accountId } = await ensureUserAccountForIntegration(client, trader, execTx);

      // ---- step 2: mint USD (CREDIT) from MOCK_USDC ----
      const creditBefore = await getAccountBalance(client, accountId, client.creditType());
      const creditAfter = await ensureIntegrationMinCreditBalance({
        client,
        trader,
        owner,
        accountId,
        minCredit: creditBefore + 1_000_000n,
        execTx,
        assertSuccess,
      });
      expect(creditAfter).toBeGreaterThanOrEqual(creditBefore + 1_000n);

      // ---- step 3: deposit USDC + mint WLP (LP-pool deposit) ----
      // helper deposits USDC into wxa first if needed, then calls buildMintWlpTx.
      const wlpType = client.wlpType();
      const wlpBefore = await getAccountBalance(client, accountId, wlpType);
      const wlpAfter = await ensureIntegrationMinWlpBalance({
        client,
        trader,
        owner,
        accountId,
        minWlp: wlpBefore + 2n,
        execTx,
        execBuiltTxWithCooldownRetries,
        assertSuccess,
      });
      if (wlpAfter < wlpBefore + 2n) {
        ctx.skip(`Need ≥${wlpBefore + 2n} WLP after mint; have ${wlpAfter}`);
        return;
      }

      // ---- step 4: stake 1 WLP ----
      const stakeResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execTx(
          (() => {
            const tx = new Transaction();
            stake(client, tx, {
              accountId,
              stakeAlias: "WLP",
              stakeType: wlpType,
              stakeAmount: 1n,
              rewarderTypes: [],
            });
            return tx;
          })(),
          trader,
          { gasBudget: integrationGasBudget("staking") },
        ),
      );
      if (stakeResult === undefined) return;
      assertSuccess(stakeResult);

      // ---- step 5: place market BUY w/ TP+SL pre-orders ----
      const collateralType = client.getPoolTokenType(COLLATERAL_TICKER);
      const acceptablePrice = rawPrice(ACCEPTABLE_USD_CAP);

      const marketResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execBuiltTxWithCooldownRetries(
          () =>
            buildPlaceOrderTx(client, {
              ticker: TICKER,
              accountId,
              collateralType,
              collateralTicker: COLLATERAL_TICKER,
              main: {
                isLong: true,
                isStopOrder: false,
                reduceOnly: false,
                size: MARKET_ORDER_SIZE,
                triggerPrice: undefined, // market form: parks at tick 0
                acceptablePrice,
                collateralAmount: MARKET_ORDER_COLLATERAL,
              },
              preOrders: [
                {
                  isLong: false,
                  isStopOrder: false,
                  reduceOnly: true,
                  size: MARKET_ORDER_SIZE,
                  triggerPrice: rawPrice(TP_USD),
                  acceptablePrice: undefined,
                  collateralAmount: 0n,
                },
                {
                  isLong: false,
                  isStopOrder: true,
                  reduceOnly: true,
                  size: MARKET_ORDER_SIZE,
                  triggerPrice: rawPrice(SL_USD),
                  acceptablePrice: undefined,
                  collateralAmount: 0n,
                },
              ],
              skipOraclePriceRefresh: false,
              useSponsor: true,
            }),
          trader,
          { cooldownTickers: [TICKER], gasBudget: integrationGasBudget("lifecycle") },
        ),
      );
      if (marketResult === undefined) return;
      assertSuccess(marketResult);
      expect(extractEvent(marketResult, "OrderCreated")).toBeDefined();

      // ---- step 6: place a limit BUY far below market (parks, will not fill) ----
      const limitResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execBuiltTxWithCooldownRetries(
          () =>
            buildPlaceOrderTx(client, {
              ticker: TICKER,
              accountId,
              collateralType,
              collateralTicker: COLLATERAL_TICKER,
              main: {
                isLong: true,
                isStopOrder: false,
                reduceOnly: false,
                size: LIMIT_ORDER_SIZE,
                triggerPrice: rawPrice(LIMIT_TRIGGER_USD),
                acceptablePrice,
                collateralAmount: LIMIT_ORDER_COLLATERAL,
              },
              preOrders: [],
              skipOraclePriceRefresh: false,
              useSponsor: true,
            }),
          trader,
          { cooldownTickers: [TICKER], gasBudget: integrationGasBudget("lifecycle") },
        ),
      );
      if (limitResult === undefined) return;
      assertSuccess(limitResult);
      const limitOrderCreated = extractEvent(limitResult, "OrderCreated") as
        | { order_id?: string | number | bigint }
        | undefined;
      expect(limitOrderCreated).toBeDefined();
      const limitOrderId =
        limitOrderCreated && limitOrderCreated.order_id != null
          ? BigInt(limitOrderCreated.order_id as string | number)
          : undefined;

      // ---- step 7: keeper matches the BUY book — fills the market form ----
      const matchResult = await execIntegrationOrSkipOracleTransient(ctx, () =>
        execBuiltTxWithCooldownRetries(
          () => buildMatchOrdersAfterRefreshTx(client, { ticker: TICKER, isLong: true }),
          trader,
          { cooldownTickers: [TICKER], gasBudget: integrationGasBudget("keeper") },
        ),
      );
      if (matchResult === undefined) return;
      assertSuccess(matchResult);
      const openedEvent =
        extractEvent(matchResult, "PositionOpened") ?? extractEvent(marketResult, "PositionOpened");
      expect(openedEvent).toBeDefined();
      const positionId = BigInt(positionIdFromOpened(openedEvent));
      expect(await positionExists(client, { ticker: TICKER, positionId })).toBe(true);

      // ---- step 8: teardown — cancel the resting limit order (best-effort) ----
      if (limitOrderId !== undefined) {
        try {
          const cancelResult = await execBuiltTxWithCooldownRetries(
            () =>
              buildCancelOrderTx(client, {
                ticker: TICKER,
                accountId,
                collateralType,
                collateralTicker: COLLATERAL_TICKER,
                orderId: limitOrderId,
                orderTypeTag: ORDER_TAG_WILDCARD,
                triggerPrice: 0n,
                useSponsor: true,
              }),
            trader,
            { cooldownTickers: [TICKER], gasBudget: integrationGasBudget("lifecycle") },
          );
          if (cancelResult.effects?.status?.status !== "success") {
            console.warn(
              `[onboarding teardown] cancel limit ${limitOrderId} non-success:`,
              cancelResult.effects?.status?.error,
            );
          }
        } catch (e) {
          console.warn(`[onboarding teardown] cancel limit ${limitOrderId} threw:`, e);
        }
      }
    }, 900_000);
  },
);
