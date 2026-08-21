import { toHex } from "@mysten/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuleUpdateData, UpdateDataProvider } from "../../../src/oracle/index.ts";
import { OracleTickerUnservedError, parseSignedLeaves } from "../../../src/oracle/index.ts";
import { PerpClient } from "../../../src/perp/client.ts";
import {
  buildAddPreOrderTx,
  buildCancelOrderTx,
  buildCancelPreOrderTx,
  buildClaimRewardsToAccountTx,
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildExecuteWithdrawalTx,
  buildIncreasePositionTx,
  buildMintAndStakeWlpTx,
  buildMintWlpTx,
  buildPlaceOrderTx,
  buildRedeemVaaTx,
  buildRequestCreditWithdrawTx,
  buildUnstakeAndRequestRedeemWlpTx,
  buildUpdateOrderTx,
  buildWithdrawCollateralTx,
} from "../../../src/perp/tx-builders.ts";
import { placeOrderRequest } from "../../../src/perp/user/order.ts";
import { rawPrice } from "../../../src/utils/math.ts";
import {
  MOCK_CUSTODY_ASSET_TYPE,
  MOCK_TESTNET_CONFIG,
  MOCK_USDC_TYPE,
} from "../helpers/fixtures/mock-testnet-config.ts";
import { moveTargets } from "../helpers/fixtures/ptb-inspect.ts";
import { PTB_DUMMY_ACCOUNT_ID } from "../helpers/fixtures/ptb-test-dummies.ts";
import {
  mockQuoteCenterLeaves,
  quoteCenterLeavesBody,
} from "../helpers/fixtures/waterx-quote-center-mock.ts";
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

  it("buildMintWlpTx with skipOraclePriceRefresh emits no oracle leg for a pool token the source can't serve", async () => {
    // skipOraclePriceRefresh bypasses refreshOraclePrices entirely, so the
    // build succeeds and freshness is left to other traffic.
    const lazerClient = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    lazerClient.config.packages.pyth_lazer_rule!.feeds = {}; // serves nothing

    const tx = await buildMintWlpTx(lazerClient, {
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

  it("buildMintWlpTx WITHOUT skip FAILS CLOSED when the deposit ticker goes unpriced", async () => {
    // The companion to the skip test above, and the money-path invariant:
    // `refreshOraclePrices` skipping a ticker is fine for a broad refresh, but
    // `mint_wlp` VALUES the deposit at this ticker's price. Proceeding would
    // size the LP payout off whatever the Oracle already holds — which can
    // still be inside the on-chain freshness window, so it succeeds at a stale
    // price rather than failing. The build must refuse.
    const lazerClient = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    lazerClient.config.packages.pyth_lazer_rule!.feeds = {}; // serves nothing

    await expect(
      buildMintWlpTx(lazerClient, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        depositTokenType: MOCK_USDC_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        consolidateToUsd: false,
      }),
    ).rejects.toBeInstanceOf(OracleTickerUnservedError);
  });

  it("buildMintWlpTx proceeds on an unpriced deposit ticker only under allowUnrefreshedPrices", async () => {
    // The deliberate escape hatch: same setup, explicit opt-in, mint is built
    // with zero oracle legs against the price already on chain.
    const lazerClient = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    lazerClient.config.packages.pyth_lazer_rule!.feeds = {};

    const tx = await buildMintWlpTx(lazerClient, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      depositTokenType: MOCK_USDC_TYPE,
      depositTicker: "USDCUSD",
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      consolidateToUsd: false,
      allowUnrefreshedPrices: true,
    });

    const targets = moveTargets(tx);
    expect(targets).not.toContain("oracle::aggregate");
    expect(targets).toContain("lp_pool::mint_wlp");
  });

  it("buildMintWlpTx FAILS CLOSED when a NON-deposit pool asset goes unpriced", async () => {
    // `mint_wlp` takes `&WlpAum` and sizes the payout against the pool's whole
    // TVL, so a stale price on ANY pool asset mis-mints — not just the deposit
    // ticker. The on-chain guard cannot catch it: `update_token_value`
    // re-stamps `last_price_refresh_timestamp` off the price already on chain,
    // so `assert_prices_fresh` passes either way.
    //
    // SUIUSD is a second pool asset wired ONLY under lazer while the fed set is
    // waterx: fully wired (so getCollateralAssets keeps it and it reaches the
    // refresh) but unserved (so it lands in `skipped`).
    const c = createUnitTestClient({ oracleSource: "waterx_rule" });
    c.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI";
    c.config.packages.pyth_lazer_rule!.feeds.SUIUSD = 9;
    mockQuoteCenterLeaves(["USDCUSD"]);

    await expect(
      buildMintWlpTx(c, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        depositTokenType: MOCK_USDC_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        consolidateToUsd: false,
      }),
    ).rejects.toThrow(/SUIUSD/);
  });

  it("buildMintAndStakeWlpTx FAILS CLOSED on the same unserved pool asset", async () => {
    const c = createUnitTestClient({ oracleSource: "waterx_rule" });
    c.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI";
    c.config.packages.pyth_lazer_rule!.feeds.SUIUSD = 9;
    mockQuoteCenterLeaves(["USDCUSD"]);

    await expect(
      buildMintAndStakeWlpTx(c, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        depositTokenType: MOCK_USDC_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        consolidateToUsd: false,
      }),
    ).rejects.toBeInstanceOf(OracleTickerUnservedError);
  });

  it("buildMintWlpTx FAILS CLOSED on a pool asset with NO wired rule (never reaches `skipped`)", async () => {
    // The subtler hole: `getCollateralAssets` drops a pool token that no rule
    // wires, so it never enters the refresh and can never appear in
    // `summary.skipped`. Checking the summary alone would miss it entirely.
    const c = createUnitTestClient({ oracleSource: "waterx_rule" });
    c.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI"; // no feeds anywhere
    mockQuoteCenterLeaves(["USDCUSD"]);

    await expect(
      buildMintWlpTx(c, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        depositTokenType: MOCK_USDC_TYPE,
        depositTicker: "USDCUSD",
        depositAmount: 10_000_000n,
        minLpAmount: 0n,
        consolidateToUsd: false,
      }),
    ).rejects.toThrow(/no fully-wired oracle rule/);
  });

  it("buildUnstakeAndRequestRedeemWlpTx FAILS CLOSED on an unserved pool asset", async () => {
    // Redeem values the whole pool too, and this builder emits the same
    // freshness-restamping `update_token_value` calls.
    const c = createUnitTestClient({ oracleSource: "waterx_rule" });
    c.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI";
    c.config.packages.pyth_lazer_rule!.feeds.SUIUSD = 9;
    mockQuoteCenterLeaves(["USDCUSD"]);

    await expect(
      buildUnstakeAndRequestRedeemWlpTx(c, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
        redeemTokenType: MOCK_USDC_TYPE,
        withdrawalAmount: 1_000n,
        consolidateToUsd: false,
      }),
    ).rejects.toBeInstanceOf(OracleTickerUnservedError);
  });

  it("an unserved pool asset is escapable with allowUnrefreshedPrices", async () => {
    const c = createUnitTestClient({ oracleSource: "waterx_rule" });
    c.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI";
    c.config.packages.pyth_lazer_rule!.feeds.SUIUSD = 9;
    mockQuoteCenterLeaves(["USDCUSD"]);

    const tx = await buildMintWlpTx(c, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      depositTokenType: MOCK_USDC_TYPE,
      depositTicker: "USDCUSD",
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      consolidateToUsd: false,
      allowUnrefreshedPrices: true,
    });
    expect(moveTargets(tx)).toContain("lp_pool::mint_wlp");
  });

  it("buildPlaceOrderTx FAILS CLOSED when the traded ticker goes unpriced", async () => {
    // Same invariant on the trading path: `execute` prices the position at
    // this ticker, so a silently-unrefreshed BTCUSD is a mis-priced trade.
    const lazerClient = createUnitTestClient({ oracleSource: "pyth_lazer_rule" });
    lazerClient.config.packages.pyth_lazer_rule!.feeds = {};

    await expect(
      buildPlaceOrderTx(lazerClient, {
        ...common,
        main: baseOrder,
        skipOraclePriceRefresh: false,
        consolidateToUsd: false,
      }),
    ).rejects.toBeInstanceOf(OracleTickerUnservedError);
  });

  it("a pool token that goes unpriced does NOT fail an unrelated trade (only action-critical tickers do)", async () => {
    // The fail-closed check must stay scoped to the traded market + collateral.
    // A WLP pool token no source prices is the pool's own
    // `assert_prices_fresh` problem on chain — failing the build on it would
    // take down every unrelated trade in the deployment.
    //
    // SUIUSD is wired ONLY under lazer while the fed set is waterx, so it
    // reaches the refresh (getCollateralAssets keeps it — a rule IS
    // configured) and comes back skipped, while the traded BTCUSD and its
    // USDCUSD collateral are both served.
    const client2 = createUnitTestClient({ oracleSource: "waterx_rule" });
    client2.config.packages.wlp!.pool_tokens.SUIUSD = "0x2::sui::SUI";
    client2.config.packages.pyth_lazer_rule!.feeds.SUIUSD = 9;
    mockQuoteCenterLeaves(["BTCUSD", "USDCUSD"]);

    const tx = await buildPlaceOrderTx(client2, {
      ...common,
      main: baseOrder,
      skipOraclePriceRefresh: false,
      consolidateToUsd: false,
    });
    expect(moveTargets(tx)).toContain("oracle::aggregate");
  });

  it("buildPlaceOrderTx with oracle refresh", async () => {
    // The refresh covers the order's ticker AND every WLP pool token.
    mockQuoteCenterLeaves(["BTCUSD", "USDCUSD"]);

    const tx = await buildPlaceOrderTx(client, {
      ...common,
      main: baseOrder,
      skipOraclePriceRefresh: false,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(8);
  });

  it("buildMintWlpTx with oracle refresh", async () => {
    mockQuoteCenterLeaves(["USDCUSD"]);

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

  it("buildMintWlpTx consults updateDataProvider and skips the live quote-center fetch on a hit", async () => {
    // No live-fetch mock installed on globalThis.fetch — if the provider hit
    // were bypassed, WaterxRule.fetchUpdateData would call the real (unmocked)
    // fetch and the test would fail loudly instead of silently passing.
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // The cache holds a payload that actually covers USDCUSD, so
    // refreshOraclePrices' narrowUpdateData step serves it instead of
    // live-fetching.
    const cachedData: RuleUpdateData = {
      kind: "waterx_rule",
      payload: { leaves: parseSignedLeaves(quoteCenterLeavesBody(["USDCUSD"])) },
    };
    const provider: UpdateDataProvider = { get: vi.fn(async () => cachedData) };

    const tx = await buildMintWlpTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      depositTokenType: MOCK_USDC_TYPE,
      depositTicker: "USDCUSD",
      depositAmount: 10_000_000n,
      minLpAmount: 0n,
      consolidateToUsd: false,
      updateDataProvider: provider,
    });

    expect(provider.get).toHaveBeenCalledWith("waterx_rule", ["USDCUSD"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(tx.getData().commands?.length).toBeGreaterThan(5);
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
    ).toThrow(/evmDestinationChain must be an integer in \[0, 65535\] \(u16\)/);
  });

  it("buildRequestCreditWithdrawTx throws when withdrawal_queue is not configured", () => {
    const cfg = structuredClone(MOCK_TESTNET_CONFIG);
    delete cfg.packages.withdrawal_queue;
    const noQueue = new PerpClient("TESTNET", cfg, {
      oracleSource: "waterx_rule",
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

  it("buildClaimRewardsToAccountTx throws when no rewarders are configured", () => {
    expect(() =>
      buildClaimRewardsToAccountTx(client, {
        accountId: PTB_DUMMY_ACCOUNT_ID,
      }),
    ).toThrow(/no rewarders configured for stakeAlias=WLP/);
  });

  it("buildClaimRewardsToAccountTx chains claimReward for each rewarder type", () => {
    const rewardType =
      "0x896e53015216c5034825c056bcde37a694263601df2534ae5c91b8a3d9150c78::sui::SUI";
    const tx = buildClaimRewardsToAccountTx(client, {
      accountId: PTB_DUMMY_ACCOUNT_ID,
      rewarderTypes: [rewardType],
    });
    expect(tx.getData().commands?.length).toBeGreaterThanOrEqual(1);
  });
});
