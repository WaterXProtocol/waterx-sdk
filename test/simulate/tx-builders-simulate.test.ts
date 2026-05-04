/** E2E: tx-builders dry-run simulate (discovery sender + account). */
import {
  buildCancelOrderTx,
  buildOpenPositionTx,
  buildPlaceOrderTx,
  buildReceiveCoinTx,
  buildTransferToAccountTx,
  getAccountBalance,
  getAccountCoins,
  getMarketSummary,
} from "@waterx/perp-sdk";
import { beforeAll, describe, it } from "vitest";

import {
  discoverActivePositionFirstMatchingTiers,
  discoveryTiersForStatefulMatrixForBase,
  e2eSkipReasonNoOpenPositionMarketDiscovery,
} from "../helpers/e2e/discover-on-chain-position.ts";
import {
  clientTxBuildersSimulate,
  PROBE_MIN_ACCOUNT_USDC,
  rawPrice,
} from "../helpers/e2e/e2e-client.ts";
import {
  loadFundedProbe,
  requireFundedProbe,
  type FundedProbe,
} from "../helpers/e2e/e2e-funded-probe.ts";
import {
  assertSimulateSuccess,
  simulateWithTransientRetry,
  skipSimulateIfOracleTransient,
  skipSimulateIfStateDependent,
} from "../helpers/e2e/simulate-assertions.ts";
import {
  scratchSimulateOpenApproxOracle,
  scratchSimulateOpenExplicitSizeWithFee,
  scratchSimulateOpenResize,
  scratchSimulateOpenTableApproxPrice,
  scratchSimulateStatefulOps,
} from "../helpers/scratch/run-scratch-trading-scenario-simulate.ts";
import { scratchTradingScenarios } from "../helpers/scratch/scratch-trading-scenarios.ts";

const clientSim = clientTxBuildersSimulate;

let probe: FundedProbe | null = null;

beforeAll(async () => {
  probe = await loadFundedProbe(clientSim, PROBE_MIN_ACCOUNT_USDC);
}, 180_000);

const scenarios = scratchTradingScenarios(clientSim);
const ORDER_TRIGGER_PRICE_USD = 60_000n;
const ORDER_COLLATERAL = 10_000_000n;
const ORDER_SIZE = 2_000n;
const TRANSFER_TO_ACCOUNT_AMOUNT = 2_000_000n;
const RECEIVE_FROM_ACCOUNT_AMOUNT = 1_000_000n;

function requireProbe(ctx: { skip: (reason?: string) => void }): FundedProbe {
  return requireFundedProbe(ctx, probe, PROBE_MIN_ACCOUNT_USDC);
}

async function trySimulate(
  ctx: { skip: (reason?: string) => void },
  tx: import("@mysten/sui/transactions").Transaction,
  minCommands = 1,
) {
  const { owner } = requireProbe(ctx);
  tx.setSender(owner);
  const result = await simulateWithTransientRetry(() => clientSim.simulate(tx));
  if (skipSimulateIfOracleTransient(ctx, result)) return;
  assertSimulateSuccess(result, minCommands, { transaction: tx });
}

describe("tx-builders PTB dry-run simulate (discovery, no keys)", () => {
  describe.each(scratchTradingScenarios(clientSim))("$id", (scenario) => {
    const setSender = (tx: import("@mysten/sui/transactions").Transaction) => {
      const p = probe;
      if (p) tx.setSender(p.owner);
    };

    it("buildOpenPositionTx — approxPrice from oracle USD", async (ctx) => {
      const { accountId } = requireProbe(ctx);
      await scratchSimulateOpenApproxOracle(ctx, clientSim, accountId, scenario, setSender);
    }, 120_000);

    it("buildOpenPositionTx — explicit size + open fee formula", async (ctx) => {
      const { accountId } = requireProbe(ctx);
      await scratchSimulateOpenExplicitSizeWithFee(ctx, clientSim, accountId, scenario, setSender);
    }, 120_000);

    it("buildOpenPositionTx — on-chain resize (leverage only)", async (ctx) => {
      const { accountId } = requireProbe(ctx);
      await scratchSimulateOpenResize(ctx, clientSim, accountId, scenario, setSender);
    }, 120_000);
  });

  it("scratch-BTC — buildOpenPositionTx — table approxPrice (integration parity)", async (ctx) => {
    const scenario = scratchTradingScenarios(clientSim).find((s) => s.base === "BTC");
    if (!scenario) {
      throw new Error("scratchTradingScenarios(): expected BTC row from LIFECYCLE_TEST_MARKETS");
    }
    const setSender = (tx: import("@mysten/sui/transactions").Transaction) => {
      const p = probe;
      if (p) tx.setSender(p.owner);
    };
    const { accountId } = requireProbe(ctx);
    await scratchSimulateOpenTableApproxPrice(
      ctx,
      clientSim,
      accountId,
      scenario,
      setSender,
      trySimulate,
    );
  }, 120_000);
});

describe("tx-builders stateful ops (simulate)", () => {
  describe.each(scratchTradingScenarios(clientSim))("$id — existing position", (scenario) => {
    it("increase / decrease / deposit / withdraw / close (sequential simulates)", async (ctx) => {
      const hit = await discoverActivePositionFirstMatchingTiers(
        clientSim,
        scenario.base,
        discoveryTiersForStatefulMatrixForBase(scenario.base),
      );
      if (!hit) {
        ctx.skip(e2eSkipReasonNoOpenPositionMarketDiscovery(scenario.base));
        return;
      }

      const localTrySimulate = async (
        simulateCtx: { skip: (reason?: string) => void },
        tx: import("@mysten/sui/transactions").Transaction,
        minCommands: number,
      ) => {
        tx.setSender(hit.ownerAddress);
        const result = await simulateWithTransientRetry(() => clientSim.simulate(tx));
        if (skipSimulateIfOracleTransient(simulateCtx, result)) return;
        // Pre-check known shared-chain state-dependent aborts (104/202/207/208)
        // and skip quietly — this avoids the dump+stderr brief that
        // `assertSimulateSuccess` would emit before throwing.
        if (skipSimulateIfStateDependent(simulateCtx, result, "stateful ops")) return;
        assertSimulateSuccess(result, minCommands, { transaction: tx });
      };

      await scratchSimulateStatefulOps(
        ctx,
        clientSim,
        hit.accountObjectAddress,
        scenario,
        Number(hit.positionId),
        (tx) => tx.setSender(hit.ownerAddress),
        localTrySimulate,
        {
          currentSize: hit.position.size,
          currentCollateralAmount: hit.position.collateralAmount,
          collateral: hit.collateral,
        },
      );
    }, 120_000);
  });

  it("buildPlaceOrderTx + buildCancelOrderTx (single PTB, BTC)", async (ctx) => {
    const { accountId, owner } = requireProbe(ctx);

    const usdcType = clientSim.config.collaterals.USDC.type;
    const usdcBalance = await getAccountBalance(clientSim, accountId, usdcType);
    if (usdcBalance < ORDER_COLLATERAL) {
      ctx.skip(`Insufficient account USDC: have ${usdcBalance}, need ${ORDER_COLLATERAL}`);
      return;
    }

    const market = clientSim.getMarketEntry("BTC");
    const summary = await getMarketSummary(clientSim, market.marketId, market.baseType);
    const orderId = Number(summary.nextOrderId);

    const { Transaction } = await import("@mysten/sui/transactions");
    const tx = new Transaction();
    tx.setSender(owner);
    tx.setGasBudget(300_000_000);

    await buildPlaceOrderTx(clientSim, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralAmount: ORDER_COLLATERAL,
      size: ORDER_SIZE,
      triggerPrice: ORDER_TRIGGER_PRICE_USD,

      tx,
    });
    await buildCancelOrderTx(clientSim, {
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
        ctx.skip("orderId prediction stale on shared chain");
        return;
      }
      throw e;
    }
  }, 120_000);

  it("buildTransferToAccountTx (coinObjectId path) + buildReceiveCoinTx", async (ctx) => {
    const { accountId, owner } = requireProbe(ctx);
    const usdcType = clientSim.config.collaterals.USDC.type;

    const walletCoins = await clientSim.listCoins({ owner, coinType: usdcType });
    const walletUsdc = walletCoins.objects.find(
      (c) => BigInt(c.balance ?? "0") >= TRANSFER_TO_ACCOUNT_AMOUNT,
    );
    if (!walletUsdc) {
      ctx.skip(`No wallet USDC coin >= ${TRANSFER_TO_ACCOUNT_AMOUNT} for discovery owner`);
      return;
    }

    const depTx = buildTransferToAccountTx(clientSim, {
      accountObjectAddress: accountId,
      coinObjectId: walletUsdc.objectId,
      coinType: usdcType,
    });
    await trySimulate(ctx, depTx, 1);

    const accountCoins = await getAccountCoins(clientSim, accountId, usdcType);
    const hasEnough = accountCoins.some((c) => BigInt(c.balance) >= RECEIVE_FROM_ACCOUNT_AMOUNT);
    if (!hasEnough) {
      ctx.skip(`No account USDC coin >= ${RECEIVE_FROM_ACCOUNT_AMOUNT} for buildReceiveCoinTx`);
      return;
    }

    const recvTx = await buildReceiveCoinTx(clientSim, {
      accountObjectAddress: accountId,
      collateral: "USDC",
      amount: RECEIVE_FROM_ACCOUNT_AMOUNT,
      recipient: owner,
    });
    await trySimulate(ctx, recvTx, 3);
  }, 120_000);
});

describe("open position with TP/SL (single PTB simulate)", () => {
  for (const scenario of scenarios) {
    const { base, row, simulateOpen } = scenario;

    it(`${base}: open + takeProfit + stopLoss in one PTB`, async (ctx) => {
      const { accountId } = requireProbe(ctx);

      const approxPrice = row.approxPrice;
      const tpPrice = rawPrice(simulateOpen.isLong ? approxPrice * 1.2 : approxPrice * 0.8);
      const slPrice = rawPrice(simulateOpen.isLong ? approxPrice * 0.9 : approxPrice * 1.1);

      const tx = await buildOpenPositionTx(clientSim, {
        accountId,
        base,
        isLong: simulateOpen.isLong,
        collateralAmount: simulateOpen.collateral,
        size: row.e2ePtb.openSize,
        takeProfit: { triggerPrice: tpPrice },
        stopLoss: { triggerPrice: slPrice },
      });
      await trySimulate(ctx, tx, 30);
    }, 120_000);

    it(`${base}: open + takeProfit only`, async (ctx) => {
      const { accountId } = requireProbe(ctx);

      const tpPrice = rawPrice(simulateOpen.isLong ? row.approxPrice * 1.5 : row.approxPrice * 0.5);

      const tx = await buildOpenPositionTx(clientSim, {
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
