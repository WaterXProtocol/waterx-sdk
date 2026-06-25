import { Transaction } from "@mysten/sui/transactions";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buildPlaceOrderTx,
  createAccount,
  getGlobalConfigData,
  getMarketData,
  getPoolData,
  liquidate,
} from "../../../src/perp/index.ts";
import { Client } from "../../../src/sdk.ts";
import {
  assertAsyncResultsEqual,
  assertTransactionsEqual,
} from "../../helpers/unified-dual-path.ts";
import {
  DUMMY_SENDER,
  e2eNetwork,
  client as legacyPerpClient,
  rawPrice,
  resolveE2eGrpcUrlOverride,
} from "../helpers/e2e/e2e-client.ts";
import {
  assertSimulateReached,
  skipHermesIfFeedUnavailable,
  skipIfTransientInfrastructureError,
} from "../helpers/e2e/simulate-assertions.ts";

const DUMMY_ACCOUNT = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe(`unified Client perp compat (${e2eNetwork})`, () => {
  let unified: Client;

  beforeAll(async () => {
    const grpcUrl = resolveE2eGrpcUrlOverride();
    unified = await Client.create({
      network: e2eNetwork === "mainnet" ? "MAINNET" : "TESTNET",
      cache: true,
      ...(grpcUrl ? { grpcUrl } : {}),
    });
    expect(unified.perp.config.network).toBe(legacyPerpClient.config.network);
  }, 120_000);

  it("Client.create wires the same perp deployment as PerpClient.create", () => {
    expect(unified.perp.config.packages.waterx_perp.published_at).toBe(
      legacyPerpClient.config.packages.waterx_perp.published_at,
    );
    expect(unified.perp.getMarket("BTCUSD").market).toBe(
      legacyPerpClient.getMarket("BTCUSD").market,
    );
  });

  it("getGlobalConfigData: facade vs legacy", async () => {
    await assertAsyncResultsEqual(
      getGlobalConfigData(legacyPerpClient),
      unified.perp.getGlobalConfigData(),
    );
  }, 60_000);

  it("getMarketData: facade vs legacy", async () => {
    await assertAsyncResultsEqual(
      getMarketData(legacyPerpClient, { ticker: "BTCUSD" }),
      unified.perp.getMarketData({ ticker: "BTCUSD" }),
    );
  }, 60_000);

  it("getPoolData: facade vs legacy", async () => {
    await assertAsyncResultsEqual(getPoolData(legacyPerpClient), unified.perp.getPoolData());
  }, 60_000);

  it("createAccount PTB: facade vs legacy + simulate", async () => {
    const alias = `unified-e2e-${Date.now()}`;
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    createAccount(legacyPerpClient, legacyTx, { alias });
    unified.account.createAccount(facadeTx, { alias });
    assertTransactionsEqual(legacyTx, facadeTx, "createAccount");
    facadeTx.setSender(DUMMY_SENDER);
    facadeTx.setGasBudget(50_000_000);
    const sim = await unified.perp.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 60_000);

  it("liquidate PTB: facade vs legacy + simulate", async () => {
    const collateralType = legacyPerpClient.getPoolTokenType("USDCUSD");
    const legacyTx = new Transaction();
    const facadeTx = new Transaction();
    liquidate(legacyPerpClient, legacyTx, {
      collateralType,
      ticker: "BTCUSD",
      positionId: 1n,
    });
    unified.perp.liquidate(facadeTx, {
      collateralType,
      ticker: "BTCUSD",
      positionId: 1n,
    });
    assertTransactionsEqual(legacyTx, facadeTx, "liquidate");
    facadeTx.setSender(DUMMY_ACCOUNT);
    const sim = await unified.perp.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 60_000);

  it("buildPlaceOrderTx: facade vs legacy PTB (no live Pyth) + simulate", async (ctx) => {
    const collateralType = legacyPerpClient.getPoolTokenType("USDCUSD");
    const params = {
      ticker: "BTCUSD",
      accountId: DUMMY_ACCOUNT,
      collateralType,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.0001),
        acceptablePrice: rawPrice(200_000),
        collateralAmount: 1_000_000n,
      },
      skipOraclePriceRefresh: true,
      useSponsor: false,
    };
    let legacyTx;
    let facadeTx;
    try {
      legacyTx = await buildPlaceOrderTx(legacyPerpClient, params);
      facadeTx = await unified.perp.buildPlaceOrderTx(params);
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    assertTransactionsEqual(legacyTx, facadeTx, "buildPlaceOrderTx");
    facadeTx.setSender(DUMMY_ACCOUNT);
    const sim = await unified.perp.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 120_000);

  it("buildPlaceOrderTx with oracle: facade path simulates on testnet", async (ctx) => {
    const collateralType = legacyPerpClient.getPoolTokenType("USDCUSD");
    const params = {
      ticker: "BTCUSD",
      accountId: DUMMY_ACCOUNT,
      collateralType,
      collateralTicker: "USDCUSD" as const,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.0001),
        acceptablePrice: rawPrice(200_000),
        collateralAmount: 1_000_000n,
      },
      skipOraclePriceRefresh: false,
      useSponsor: true,
    };
    let facadeTx;
    try {
      facadeTx = await unified.perp.buildPlaceOrderTx(params);
    } catch (e) {
      if (skipHermesIfFeedUnavailable(ctx, e)) return;
      if (skipIfTransientInfrastructureError(ctx, e)) return;
      throw e;
    }
    facadeTx.setSender(DUMMY_ACCOUNT);
    const sim = await unified.perp.simulate(facadeTx);
    assertSimulateReached(sim);
  }, 120_000);
});
