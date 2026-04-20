/** E2E: tx-builders dry-run simulate coverage. */
import {
  buildCancelOrderTx,
  buildOpenPositionTx,
  buildPlaceOrderTx,
  buildReceiveCoinTx,
  buildTransferToAccountTx,
  getAccountBalance,
  getAccountCoins,
  getAccountsByOwner,
  getMarketSummary,
  TESTNET_TYPES,
} from "@waterx/perp-sdk";
import { describe, it } from "vitest";

import { INTEGRATION_REFERENCE_WALLET_ADDRESS } from "../helpers/integration-reference-wallet.ts";
import { resolveE2eOpenPosition } from "../helpers/resolve-e2e-open-position.ts";
import { pickE2eAccountIdForOwner } from "../helpers/resolve-e2e-reference-account.ts";
import {
  scratchSimulateOpenApproxOracle,
  scratchSimulateOpenExplicitSizeWithFee,
  scratchSimulateOpenResize,
  scratchSimulateOpenTableApproxPrice,
  scratchSimulateStatefulOps,
} from "../helpers/run-scratch-trading-scenario-simulate.ts";
import { scratchTradingScenarios } from "../helpers/scratch-trading-scenarios.ts";
import {
  assertSimulateSuccess,
  skipSimulateIfOracleTransient,
} from "../helpers/simulate-assertions.ts";
import { clientTxBuildersSimulate as client, rawPrice } from "../helpers/testnet.ts";

const OWNER = INTEGRATION_REFERENCE_WALLET_ADDRESS;
const scenarios = scratchTradingScenarios();
const ORDER_TRIGGER_PRICE_USD = 60_000n;
const ORDER_COLLATERAL = 10_000_000n;
const ORDER_SIZE = 2_000n;
const TRANSFER_TO_ACCOUNT_AMOUNT = 2_000_000n;
const RECEIVE_FROM_ACCOUNT_AMOUNT = 1_000_000n;

async function getFirstAccountId(ctx: { skip: (reason?: string) => void }): Promise<string | null> {
  const accounts = await getAccountsByOwner(client, OWNER);
  if (!accounts.length) {
    ctx.skip(`No WaterX UserAccount on testnet for ${OWNER}; run pnpm create-testnet-account.`);
    return null;
  }
  try {
    return pickE2eAccountIdForOwner(OWNER, accounts);
  } catch (e) {
    ctx.skip(e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function trySimulate(
  ctx: { skip: (reason?: string) => void },
  tx: import("@mysten/sui/transactions").Transaction,
  minCommands = 1,
) {
  tx.setSender(OWNER);
  const result = await client.simulate(tx);
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

describe("tx-builders PTB dry-run simulate (testnet, no keys)", () => {
  /**
   * Data-driven opens: {@link scratchTradingScenarios} = all enabled `LIFECYCLE_TEST_MARKETS` bases.
   */
  describe.each(scratchTradingScenarios())("$id", (scenario) => {
    const setSender = (tx: import("@mysten/sui/transactions").Transaction) => {
      tx.setSender(OWNER);
    };

    it("buildOpenPositionTx — approxPrice from oracle USD", async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;
      await scratchSimulateOpenApproxOracle(
        ctx,
        client,
        accountId,
        scenario,
        setSender,
        trySimulate,
      );
    }, 60_000);

    it("buildOpenPositionTx — explicit size + open fee formula", async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;
      await scratchSimulateOpenExplicitSizeWithFee(ctx, client, accountId, scenario, setSender);
    }, 60_000);

    it("buildOpenPositionTx — on-chain resize (leverage only)", async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;
      await scratchSimulateOpenResize(ctx, client, accountId, scenario, setSender, trySimulate);
    }, 60_000);
  });

  /**
   * Single case only (not per-base): `approxPrice` from {@link lifecycleRow} table — same idea as
   * `WATERX_INTEGRATION_APPROX_PRICE_CHAIN` on BTC. Avoids `it.skipIf` on five bases (looks like env gaps).
   */
  it("scratch-BTC — buildOpenPositionTx — table approxPrice (integration parity)", async (ctx) => {
    const scenario = scratchTradingScenarios().find((s) => s.base === "BTC");
    if (!scenario) {
      throw new Error("scratchTradingScenarios(): expected BTC row from LIFECYCLE_TEST_MARKETS");
    }
    const setSender = (tx: import("@mysten/sui/transactions").Transaction) => {
      tx.setSender(OWNER);
    };
    const accountId = await getFirstAccountId(ctx);
    if (!accountId) return;
    await scratchSimulateOpenTableApproxPrice(
      ctx,
      client,
      accountId,
      scenario,
      setSender,
      trySimulate,
    );
  }, 60_000);
});

describe("tx-builders stateful ops (simulate)", () => {
  /**
   * Per-base stateful dry-runs (chain must already have an open position for that market).
   */
  describe.each(scratchTradingScenarios())("$id — existing position", (scenario) => {
    it("increase / decrease / deposit / withdraw / close (sequential simulates)", async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;

      const resolved = await resolveE2eOpenPosition(client, accountId, scenario.base);
      const positionId = resolved?.positionId ?? null;
      if (positionId === null) {
        ctx.skip(
          `No open ${scenario.base} position for reference account; see e2e-fixed-positions / bootstrap.`,
        );
        return;
      }

      try {
        await scratchSimulateStatefulOps(
          ctx,
          client,
          accountId,
          scenario,
          Number(positionId),
          (tx) => tx.setSender(OWNER),
          trySimulate,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("err_position_flip_not_supported") || msg.includes("207")) {
          ctx.skip("position direction mismatch or size flip on shared testnet");
          return;
        }
        throw e;
      }
    }, 120_000);
  });

  it("buildPlaceOrderTx + buildCancelOrderTx (single PTB, BTC)", async (ctx) => {
    const accountId = await getFirstAccountId(ctx);
    if (!accountId) return;

    const usdcBalance = await getAccountBalance(client, accountId, TESTNET_TYPES.USDC);
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient account USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}`);
      return;
    }

    const market = client.getMarketEntry("BTC");
    const summary = await getMarketSummary(client, market.marketId, market.baseType);
    const orderId = Number(summary.nextOrderId);

    const { Transaction } = await import("@mysten/sui/transactions");
    const tx = new Transaction();
    tx.setSender(OWNER);
    tx.setGasBudget(300_000_000);

    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: ORDER_TRIGGER_PRICE_USD,

      tx,
    });
    await buildCancelOrderTx(client, {
      accountId,
      base: "BTC",
      orderId,
      triggerPrice: 0n,
      orderTypeTag: 255,

      tx,
    });
    try {
      await trySimulate(ctx, tx, 20);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("err_order_not_found") || msg.includes("300")) {
        ctx.skip("orderId prediction stale on shared testnet");
        return;
      }
      throw e;
    }
  }, 120_000);

  it("buildTransferToAccountTx (coinObjectId path) + buildReceiveCoinTx", async (ctx) => {
    const accountId = await getFirstAccountId(ctx);
    if (!accountId) return;

    const walletCoins = await client.listCoins({ owner: OWNER, coinType: TESTNET_TYPES.USDC });
    const walletUsdc = walletCoins.objects.find(
      (c) => BigInt(c.balance ?? "0") >= TRANSFER_TO_ACCOUNT_AMOUNT,
    );
    if (!walletUsdc) {
      ctx.skip(`No wallet USDC coin >= ${TRANSFER_TO_ACCOUNT_AMOUNT} for ${OWNER}`);
      return;
    }

    const depTx = buildTransferToAccountTx(client, {
      accountObjectAddress: accountId,
      coinObjectId: walletUsdc.objectId,
      coinType: TESTNET_TYPES.USDC,
    });
    await trySimulate(ctx, depTx, 1);

    const accountCoins = await getAccountCoins(client, accountId, TESTNET_TYPES.USDC);
    const hasEnough = accountCoins.some((c) => BigInt(c.balance) >= RECEIVE_FROM_ACCOUNT_AMOUNT);
    if (!hasEnough) {
      ctx.skip(`No account USDC coin >= ${RECEIVE_FROM_ACCOUNT_AMOUNT} for buildReceiveCoinTx`);
      return;
    }

    const recvTx = await buildReceiveCoinTx(client, {
      accountObjectAddress: accountId,
      collateral: "USDC",
      amount: RECEIVE_FROM_ACCOUNT_AMOUNT,
      recipient: OWNER,
    });
    await trySimulate(ctx, recvTx, 3);
  }, 120_000);
});

describe("open position with TP/SL (single PTB simulate)", () => {
  for (const scenario of scenarios) {
    const { base, row, simulateOpen } = scenario;

    it(`${base}: open + takeProfit + stopLoss in one PTB`, async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;

      const approxPrice = row.approxPrice;
      // TP: +20% for long, -20% for short
      const tpPrice = rawPrice(simulateOpen.isLong ? approxPrice * 1.2 : approxPrice * 0.8);
      // SL: -10% for long, +10% for short
      const slPrice = rawPrice(simulateOpen.isLong ? approxPrice * 0.9 : approxPrice * 1.1);

      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: simulateOpen.isLong,
        collateralAmount: simulateOpen.collateral,
        size: row.e2ePtb.openSize,
        takeProfit: { triggerPrice: tpPrice },
        stopLoss: { triggerPrice: slPrice },
      });
      // open(~19 cmds) + TP order(~19 cmds) + SL order(~19 cmds)
      await trySimulate(ctx, tx, 30);
    }, 120_000);

    it(`${base}: open + takeProfit only`, async (ctx) => {
      const accountId = await getFirstAccountId(ctx);
      if (!accountId) return;

      const tpPrice = rawPrice(simulateOpen.isLong ? row.approxPrice * 1.5 : row.approxPrice * 0.5);

      const tx = await buildOpenPositionTx(client, {
        accountId,
        base,
        isLong: simulateOpen.isLong,
        collateralAmount: simulateOpen.collateral,
        size: row.e2ePtb.openSize,
        takeProfit: { triggerPrice: tpPrice },
      });
      await trySimulate(ctx, tx, 20);
    }, 120_000);
  }
});
