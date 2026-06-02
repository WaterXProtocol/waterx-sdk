import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import {
  buildAddPreOrderTx,
  buildCancelOrderTx,
  buildCancelPreOrderTx,
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildExecuteWithdrawalTx,
  buildIncreasePositionTx,
  buildMintWlpTx,
  buildPlaceOrderTx,
  buildRedeemVaaTx,
  buildRequestCreditWithdrawTx,
  buildUpdateOrderTx,
  buildWithdrawCollateralTx,
  openPythSponsorFund,
  reimbursePythSponsor,
} from "../../src/tx-builders.ts";
import { placeOrderRequest } from "../../src/user/order.ts";
import { rawPrice } from "../../src/utils/math.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
  MOCK_USDC_TYPE,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import { createUnitTestClient } from "../helpers/test-client.ts";

const baseOrder = {
  isLong: true,
  isStopOrder: false,
  reduceOnly: false,
  size: rawPrice(0.001),
  acceptablePrice: rawPrice(100_000),
  collateralAmount: 10_000_000n,
};

const common = {
  ticker: "BTCUSD",
  accountId: PTB_DUMMY_ACCOUNT_ID,
  collateralType: MOCK_USDC_TYPE,
  skipOraclePriceRefresh: true,
  useSponsor: false,
  // Offline unit-test client has no working gRPC — skip the async sweep.
  consolidateToUsd: false,
} as const;

describe("tx-builders (v3)", () => {
  const client = createUnitTestClient();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("buildPlaceOrderTx composes request + execute", async () => {
    const tx = await buildPlaceOrderTx(client, { ...common, main: baseOrder });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("buildPlaceOrderTx defaults useSponsor to true when omitted", async () => {
    const withoutSponsor = await buildPlaceOrderTx(client, {
      ticker: common.ticker,
      accountId: common.accountId,
      collateralType: common.collateralType,
      main: baseOrder,
      skipOraclePriceRefresh: true,
      useSponsor: false,
      consolidateToUsd: false,
    });
    const defaultSponsor = await buildPlaceOrderTx(client, {
      ticker: common.ticker,
      accountId: common.accountId,
      collateralType: common.collateralType,
      main: baseOrder,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    expect(defaultSponsor.getData().commands!.length).toBeGreaterThan(
      withoutSponsor.getData().commands!.length,
    );
  });

  it("buildClosePositionTx / increase / decrease / collateral adjust", async () => {
    const close = await buildClosePositionTx(client, {
      ...common,
      positionId: 1n,
      acceptablePrice: rawPrice(90_000),
    });
    expect(close.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const inc = await buildIncreasePositionTx(client, {
      ...common,
      positionId: 1n,
      collateralAmount: 1_000_000n,
      size: rawPrice(0.001),
      acceptablePrice: rawPrice(100_000),
    });
    expect(inc.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const dec = await buildDecreasePositionTx(client, {
      ...common,
      positionId: 1n,
      size: rawPrice(0.0005),
      acceptablePrice: rawPrice(95_000),
    });
    expect(dec.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const dep = await buildDepositCollateralTx(client, {
      ...common,
      positionId: 1n,
      collateralAmount: 1_000_000n,
    });
    expect(dep.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const wit = await buildWithdrawCollateralTx(client, {
      ...common,
      positionId: 1n,
      amount: 500_000n,
    });
    expect(wit.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("buildCancelOrderTx / buildUpdateOrderTx / pre-order builders", async () => {
    const cancel = await buildCancelOrderTx(client, {
      ...common,
      orderTypeTag: 255,
      orderId: 1n,
      triggerPrice: 0n,
    });
    expect(cancel.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const update = await buildUpdateOrderTx(client, {
      ...common,
      orderTypeTag: 0,
      orderId: 1n,
      currentTriggerPrice: rawPrice(95_000),
      newSize: rawPrice(0.002),
      newTriggerPrice: rawPrice(96_000),
    });
    expect(update.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const cancelPre = await buildCancelPreOrderTx(client, {
      ...common,
      mainOrderId: 1n,
      preOrderId: 2n,
    });
    expect(cancelPre.getData().commands?.length).toBeGreaterThanOrEqual(2);

    const addPre = await buildAddPreOrderTx(client, {
      ...common,
      mainOrderId: 1n,
      preOrder: {
        isLong: false,
        isStopOrder: true,
        reduceOnly: true,
        size: rawPrice(0.001),
        triggerPrice: rawPrice(110_000),
        collateralAmount: 0n,
      },
    });
    expect(addPre.getData().commands?.length).toBeGreaterThanOrEqual(2);
  });

  it("buildMintWlpTx without oracle refresh", async () => {
    const tx = await buildMintWlpTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      depositTokenType: MOCK_USDC_TYPE,
      depositTicker: "USDCUSD",
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      skipOraclePriceRefresh: true,
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("buildPlaceOrderTx with oracle refresh and sponsor reimburse", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    attachPythGrpcMocks(client);
    const tx = await buildPlaceOrderTx(client, {
      ...common,
      main: baseOrder,
      skipOraclePriceRefresh: false,
      useSponsor: true,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(8);
  });

  it("buildMintWlpTx with oracle refresh", async () => {
    const { attachPythGrpcMocks, mockAccumulatorUpdate } =
      await import("../helpers/fixtures/pyth-mock-grpc.ts");
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ binary: { data: [toHex(mockAccumulatorUpdate())] } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;

    attachPythGrpcMocks(client);
    const tx = await buildMintWlpTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      depositTokenType: MOCK_USDC_TYPE,
      depositTicker: "USDCUSD",
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      consolidateToUsd: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(5);
  });

  it("openPythSponsorFund + reimbursePythSponsor", () => {
    const tx = new Transaction();
    const { fund, packageId } = openPythSponsorFund(tx, client);
    const req = placeOrderRequest(client, tx, { ...common, main: baseOrder });
    reimbursePythSponsor(tx, client, fund, req, MOCK_USDC_TYPE);
    expect(packageId).toBeTruthy();
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(3);
  });

  it("reuses passed Transaction via tx opt", async () => {
    const tx = new Transaction();
    const out = await buildPlaceOrderTx(client, { ...common, main: baseOrder, tx });
    expect(out).toBe(tx);
  });

  it("buildRedeemVaaTx chains redeem_vaa + consume_deposit_direct", () => {
    const tx = buildRedeemVaaTx(client, { vaaBytes: new Uint8Array([0x01, 0x02]) });
    expect(tx.getData().commands?.length).toBe(2);
  });

  it("buildRequestCreditWithdrawTx — wormhole and native routes", () => {
    const wormhole = buildRequestCreditWithdrawTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      amount: 1_000n,
      recipient: PTB_DUMMY_ACCOUNT_ID,
      route: {
        kind: "wormhole",
        evmDestinationChain: 10002,
        evmRecipient: "0x1111111111111111111111111111111111111111",
        evmToken: "0x2222222222222222222222222222222222222222",
      },
    });
    expect(wormhole.getData().commands?.length).toBe(4);

    const native = buildRequestCreditWithdrawTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      amount: 500n,
      recipient: PTB_DUMMY_ACCOUNT_ID,
      route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
    });
    expect(native.getData().commands?.length).toBe(4);
  });

  it("buildExecuteWithdrawalTx — wormhole (default zero fee) and native", () => {
    const wormhole = buildExecuteWithdrawalTx(client, {
      key: 1n,
      route: { kind: "wormhole" },
    });
    expect(wormhole.getData().commands?.length).toBeGreaterThanOrEqual(1);

    const native = buildExecuteWithdrawalTx(client, {
      key: 2n,
      route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
    });
    expect(native.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });

  it("buildRequestCreditWithdrawTx rejects invalid wormhole chain id", () => {
    expect(() =>
      buildRequestCreditWithdrawTx(client, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        amount: 1n,
        recipient: PTB_DUMMY_ACCOUNT_ID,
        route: {
          kind: "wormhole",
          evmDestinationChain: 99_999,
          evmRecipient: "0x1111111111111111111111111111111111111111",
          evmToken: "0x2222222222222222222222222222222222222222",
        },
      }),
    ).toThrow(/u16 \(0\.\.65535\)/);
  });

  it("buildRequestCreditWithdrawTx throws when withdrawal_queue is not configured", () => {
    const cfg = structuredClone(MOCK_TESTNET_CONFIG);
    delete cfg.packages.withdrawal_queue;
    const noQueue = new WaterXClient("TESTNET", cfg, {
      grpcUrl: "https://fullnode.test.invalid:443",
    });
    expect(() =>
      buildRequestCreditWithdrawTx(noQueue, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        amount: 1n,
        recipient: PTB_DUMMY_ACCOUNT_ID,
        route: { kind: "native", assetType: MOCK_CUSTODY_ASSET_TYPE },
      }),
    ).toThrow(/withdrawal_queue not configured/);
  });
});
