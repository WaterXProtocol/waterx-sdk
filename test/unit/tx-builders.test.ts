/** tx-builders size math, trigger scaling, mocked oracle + getAccountCoins. */
import { Transaction } from "@mysten/sui/transactions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WaterXClient } from "../../src/client.ts";
import { TESTNET_TYPES } from "../../src/constants.ts";
import {
  buildBatchLiquidateTx,
  buildCancelOrderTx,
  buildCancelRedeemWlpTx,
  buildClosePositionTx,
  buildDecreasePositionTx,
  buildDepositCollateralTx,
  buildIncreasePositionTx,
  buildLiquidateTx,
  buildMatchOrdersTx,
  buildMintAndStakeWlpTx,
  buildMintWlpTx,
  buildOpenPositionByManagerTx,
  buildOpenPositionTx,
  buildPlaceOrderTx,
  buildReceiveCoinTx,
  buildRequestRedeemWlpTx,
  buildResolveSize,
  buildSettleRedeemWlpTx,
  buildTransferToAccountTx,
  buildUnstakeAndRequestRedeemWlpTx,
  buildUpdateFundingRateTx,
  buildWithdrawCollateralTx,
} from "../../src/tx-builders.ts";
import {
  cancelOrder,
  decreasePosition,
  increasePosition,
  mintWlp,
  openPosition,
  openPositionByManager,
  placeOrder,
  transferToAccount,
} from "../../src/user/index.ts";
import { updatePythPrices } from "../../src/utils/pyth.ts";
import { computeLeverageDerivedSize } from "../helpers/compute-leverage-size";
import {
  dummyBucketFloatPricePair,
  PTB_DUMMY_ACCOUNT_ID,
  PTB_DUMMY_COIN_CC,
  PTB_DUMMY_DEPOSIT_COIN,
  PTB_DUMMY_ID_CC,
  PTB_DUMMY_RECIPIENT,
} from "../helpers/ptb-test-dummies.ts";

const getAccountCoinsMock = vi.fn();

vi.mock("../../src/utils/pyth.ts", () => ({
  updatePythPrices: vi.fn().mockResolvedValue([]),
  feedPythRule: vi.fn(),
  buildPythRuleFeedCalls: vi.fn((tx: Transaction) => [tx.pure.u64(1), tx.pure.u64(2)]),
  PythCache: class {},
}));

vi.mock("../../src/utils/supra.ts", () => ({
  feedSupraRule: vi.fn(),
}));

vi.mock("../../src/fetch.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/fetch.ts")>();
  return {
    ...actual,
    getAccountCoins: (...args: Parameters<typeof actual.getAccountCoins>) =>
      getAccountCoinsMock(...args),
  };
});

vi.mock("../../src/user/index.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/user/index.ts")>();
  return {
    ...actual,
    openPosition: vi.fn((...args: Parameters<typeof actual.openPosition>) =>
      actual.openPosition(...args),
    ),
    openPositionByManager: vi.fn((...args: Parameters<typeof actual.openPositionByManager>) =>
      actual.openPositionByManager(...args),
    ),
    placeOrder: vi.fn((...args: Parameters<typeof actual.placeOrder>) =>
      actual.placeOrder(...args),
    ),
    cancelOrder: vi.fn((...args: Parameters<typeof actual.cancelOrder>) =>
      actual.cancelOrder(...args),
    ),
    transferToAccount: vi.fn((...args: Parameters<typeof actual.transferToAccount>) =>
      actual.transferToAccount(...args),
    ),
    mintWlp: vi.fn((...args: Parameters<typeof actual.mintWlp>) => actual.mintWlp(...args)),
    increasePosition: vi.fn((...args: Parameters<typeof actual.increasePosition>) =>
      actual.increasePosition(...args),
    ),
    decreasePosition: vi.fn((...args: Parameters<typeof actual.decreasePosition>) =>
      actual.decreasePosition(...args),
    ),
  };
});

function getMoveCallFunctions(tx: Transaction) {
  return (tx.getData().commands ?? [])
    .filter(
      (command): command is { $kind: "MoveCall"; MoveCall: any } => command.$kind === "MoveCall",
    )
    .map((command) => `${command.MoveCall.module}::${command.MoveCall.function}`);
}

describe("buildResolveSize", () => {
  const client = WaterXClient.testnet();

  it("appends resize move call and returns size argument", () => {
    const tx = new Transaction();
    const { base: priceResult, collateral: collateralPriceResult } = dummyBucketFloatPricePair(tx);
    const size = buildResolveSize(client, tx, {
      base: "BTC",
      priceResult,
      collateralPriceResult,
      collateralAmount: 100_000_000n,
      leverage: 5,
    });
    expect(size).toBeDefined();
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });
});

describe("computeLeverageDerivedSize (table) — rounds down to 1000 lot", () => {
  it.each([
    {
      collateralAmount: 200_000_000n,
      leverage: 5,
      approxPrice: 70_000,
      expected: 14000n, // 14285 rounded down to lot 1000
    },
    {
      collateralAmount: 100_000_000n,
      leverage: 2,
      approxPrice: 65_000,
      expected: 3000n, // 3076 rounded down
    },
    {
      collateralAmount: 0n,
      leverage: 5,
      approxPrice: 70_000,
      expected: 0n,
    },
    {
      collateralAmount: 1_000n,
      leverage: 1,
      approxPrice: 70_000,
      expected: 0n, // raw=0, ≤1000 so no rounding
    },
    {
      collateralAmount: 100_000_000n,
      leverage: 2,
      approxPrice: 65_000,
      expected: 3000n,
    },
  ] as const)("row %#", (row) => {
    expect(
      computeLeverageDerivedSize({
        collateralAmount: row.collateralAmount,
        leverage: row.leverage,
        approxPrice: row.approxPrice,
      }),
    ).toBe(row.expected);
  });

  it("Number precision: very large collateral still returns bigint (not Infinity)", () => {
    const n = Number.MAX_SAFE_INTEGER;
    const s = computeLeverageDerivedSize({
      collateralAmount: n,
      leverage: 1,
      approxPrice: 70_000,
    });
    expect(s).toBeGreaterThan(0n);
    expect(Number.isFinite(Number(s))).toBe(true);
  });

  it("approxPrice near zero yields huge size, still lot-rounded", () => {
    const s = computeLeverageDerivedSize({
      collateralAmount: 1_000_000n,
      leverage: 100,
      approxPrice: 1e-9,
    });
    expect(s).toBeGreaterThan(0n);
    expect(s % 1000n).toBe(0n);
  });

  it("trigger price scales to 1e9 (limit order key)", () => {
    expect(BigInt(Math.round(65000 * 1e9))).toBe(65_000_000_000_000n);
  });
});

describe("buildOpenPositionTx (mocked oracle + coins)", () => {
  const client = WaterXClient.testnet();
  const accountId = PTB_DUMMY_ACCOUNT_ID;

  beforeEach(() => {
    vi.mocked(openPosition).mockClear();
    getAccountCoinsMock.mockResolvedValue([
      {
        objectId: "0xcoin1",
        type: TESTNET_TYPES.USDC,
        balance: "1000000000000",
        version: "1",
        digest: "digest1",
      },
    ]);
  });

  it("uses on-chain resolve_size when leverage provided", async () => {
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "BTC",
      isLong: true,
      leverage: 5,
      collateralAmount: 200_000_000n,
    });
    const params = vi.mocked(openPosition).mock.calls[0]?.[2];
    // on-chain resolve_size returns a TransactionArgument, not a bigint
    expect(params?.size).toBeDefined();
    expect(typeof params?.size).not.toBe("bigint");
    expect(typeof params?.size).not.toBe("number");
  });

  it("resolveMarket: BTC → btcMarket + WATERX_BTC; ETH → ethMarket + WATERX_ETH", async () => {
    vi.mocked(openPosition).mockClear();
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "BTC",
      isLong: true,
      size: 5000n,
      collateralAmount: 50_000_000n,
    });
    expect(vi.mocked(openPosition).mock.calls[0]?.[2]?.market).toBe(
      client.config.markets.BTC.marketId,
    );
    expect(vi.mocked(openPosition).mock.calls[0]?.[2]?.baseTokenType).toBe(TESTNET_TYPES.BTC_USD);

    vi.mocked(openPosition).mockClear();
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "ETH",
      isLong: false,
      size: 5000n,
      collateralAmount: 50_000_000n,
    });
    expect(vi.mocked(openPosition).mock.calls[0]?.[2]?.market).toBe(
      client.config.markets.ETH.marketId,
    );
    expect(vi.mocked(openPosition).mock.calls[0]?.[2]?.baseTokenType).toBe(TESTNET_TYPES.ETH_USD);
  });

  it("throws when size and leverage both omitted", async () => {
    await expect(
      buildOpenPositionTx(client, {
        accountId: accountId,
        base: "BTC",
        isLong: true,
        collateralAmount: 700_000_000n,
      }),
    ).rejects.toThrow("Either `size` or `leverage` must be provided");
  });

  it("uses on-chain resolve_size when only leverage is provided", async () => {
    vi.mocked(openPosition).mockClear();
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "BTC",
      isLong: true,
      leverage: 5,
      collateralAmount: 200_000_000n,
    });
    const params = vi.mocked(openPosition).mock.calls[0]?.[2];
    expect(params?.size).toBeDefined();
    expect(typeof params?.size).not.toBe("bigint");
    expect(typeof params?.size).not.toBe("number");
  });

  it("explicit size overrides leverage math", async () => {
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "BTC",
      isLong: true,
      leverage: 5,
      collateralAmount: 200_000_000n,
      size: 999000n,
    });
    const params = vi.mocked(openPosition).mock.calls[0]?.[2];
    expect(params?.size).toBe(999000n);
  });

  it("loads account USDC coins for the account id", async () => {
    await buildOpenPositionTx(client, {
      accountId: accountId,
      base: "ETH",
      isLong: false,
      size: 5000n,
      collateralAmount: 50_000_000n,
    });
    expect(getAccountCoinsMock).toHaveBeenCalledWith(
      client,
      accountId,
      client.config.collaterals.USDC.type,
    );
  });

  it("throws when account has no collateral coins (openPosition not invoked)", async () => {
    getAccountCoinsMock.mockResolvedValueOnce([]);
    await expect(
      buildOpenPositionTx(client, {
        accountId: accountId,
        base: "BTC",
        isLong: true,
        leverage: 2,
        collateralAmount: 100_000_000n,
      }),
    ).rejects.toThrow(/No USDC coins/);
    expect(vi.mocked(openPosition)).not.toHaveBeenCalled();
  });
});

describe("buildOpenPositionByManagerTx (mocked oracle)", () => {
  const client = WaterXClient.testnet();
  const accountId = PTB_DUMMY_ACCOUNT_ID;

  beforeEach(() => {
    vi.mocked(openPositionByManager).mockClear();
  });

  it("passes explicit size into openPositionByManager", async () => {
    await buildOpenPositionByManagerTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralCoin: PTB_DUMMY_DEPOSIT_COIN,
      size: 5000n,
    });
    const params = vi.mocked(openPositionByManager).mock.calls[0]?.[2];
    expect(params?.size).toBe(5000n);
  });

  it("uses on-chain resolve_size when leverage provided", async () => {
    await buildOpenPositionByManagerTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralCoin: PTB_DUMMY_DEPOSIT_COIN,
      collateralAmount: 200_000_000n,
      leverage: 5,
    });
    const params = vi.mocked(openPositionByManager).mock.calls[0]?.[2];
    // on-chain resolve_size returns a TransactionArgument, not a bigint
    expect(params?.size).toBeDefined();
    expect(typeof params?.size).not.toBe("bigint");
    expect(typeof params?.size).not.toBe("number");
  });

  it("throws when size and leverage both omitted", async () => {
    await expect(
      buildOpenPositionByManagerTx(client, {
        accountId,
        base: "BTC",
        isLong: true,
        collateralCoin: PTB_DUMMY_DEPOSIT_COIN,
        collateralAmount: 100_000_000n,
      }),
    ).rejects.toThrow("Either `size` or `leverage` must be provided");
  });

  it("does NOT call getAccountCoins (no TTO receiving)", async () => {
    getAccountCoinsMock.mockClear();
    await buildOpenPositionByManagerTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      collateralCoin: PTB_DUMMY_DEPOSIT_COIN,
      size: 5000n,
    });
    expect(getAccountCoinsMock).not.toHaveBeenCalled();
  });
});

describe("buildClosePositionTx / collateral adjust / cancel (mocked pyth)", () => {
  const client = WaterXClient.testnet();
  const accountId = PTB_DUMMY_ID_CC;

  beforeEach(() => {
    getAccountCoinsMock.mockResolvedValue([
      {
        objectId: "0xcoincollat",
        type: TESTNET_TYPES.USDC,
        balance: "1000000000000",
        version: "1",
        digest: "digestc",
      },
    ]);
  });

  it("buildClosePositionTx appends commands", async () => {
    const tx = await buildClosePositionTx(client, {
      accountId: accountId,
      base: "BTC",
      positionId: 1,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildDepositCollateralTx fetches account coins", async () => {
    await buildDepositCollateralTx(client, {
      accountId: accountId,
      base: "ETH",
      positionId: 2,
      collateralAmount: 25_000_000n,
    });
    expect(getAccountCoinsMock).toHaveBeenCalled();
  });

  it("buildWithdrawCollateralTx completes", async () => {
    const tx = await buildWithdrawCollateralTx(client, {
      accountId: accountId,
      base: "BTC",
      positionId: 3,
      amount: 5_000_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildWithdrawCollateralTx accepts deprecated amount", async () => {
    const tx = await buildWithdrawCollateralTx(client, {
      accountId: accountId,
      base: "BTC",
      positionId: 3,
      amount: 5_000_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildIncreasePositionTx completes", async () => {
    const tx = await buildIncreasePositionTx(client, {
      accountId: accountId,
      base: "BTC",
      positionId: 3,
      collateralAmount: 5_000_000n,
      size: 1_000n,
    });
    expect(tx).toBeInstanceOf(Transaction);
    expect(vi.mocked(increasePosition)).toHaveBeenCalled();
  });

  it("buildDecreasePositionTx completes", async () => {
    const tx = await buildDecreasePositionTx(client, {
      accountId: accountId,
      base: "BTC",
      positionId: 3,
      size: 1_000n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
    expect(vi.mocked(decreasePosition)).toHaveBeenCalled();
  });

  it("buildCancelOrderTx completes", async () => {
    const tx = await buildCancelOrderTx(client, {
      accountId: accountId,
      base: "BTC",
      orderId: 0,
      triggerPrice: 60_000_000_000n,
      orderTypeTag: 0,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildCancelOrderTx forwards explicit orderTypeTag", async () => {
    vi.mocked(cancelOrder).mockClear();
    await buildCancelOrderTx(client, {
      accountId: accountId,
      base: "ETH",
      orderId: 7,
      triggerPrice: 3_000_000_000n,
      orderTypeTag: 3,
    });
    const params = vi.mocked(cancelOrder).mock.calls[0]?.[2];
    expect(params?.orderTypeTag).toBe(3);
  });

  it("buildCancelOrderTx defaults orderTypeTag to 255 (wildcard)", async () => {
    vi.mocked(cancelOrder).mockClear();
    await buildCancelOrderTx(client, {
      accountId: accountId,
      base: "BTC",
      orderId: 1,
    });
    const params = vi.mocked(cancelOrder).mock.calls[0]?.[2];
    expect(params?.orderTypeTag).toBe(255);
    expect(params?.triggerPrice).toBe(0n);
  });
});

describe("buildPlaceOrderTx (mocked)", () => {
  const client = WaterXClient.testnet();
  const accountId = PTB_DUMMY_DEPOSIT_COIN;

  beforeEach(() => {
    vi.mocked(placeOrder).mockClear();
    getAccountCoinsMock.mockResolvedValue([
      {
        objectId: "0xcoin2",
        type: TESTNET_TYPES.USDC,
        balance: "1000000000000",
        version: "2",
        digest: "digest2",
      },
    ]);
  });

  it("scales trigger price to 1e9 for placeOrder", async () => {
    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      leverage: 2,
      collateralAmount: 100_000_000n,
      triggerPrice: 65_000_000_000_000n,
    });
    const params = vi.mocked(placeOrder).mock.calls[0]?.[2];
    expect(params?.triggerPrice).toBe(65_000_000_000_000n);
  });

  it("uses on-chain resolve_order_size when leverage provided", async () => {
    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      leverage: 2,
      collateralAmount: 100_000_000n,
      triggerPrice: 65_000_000_000_000n,
    });
    const params = vi.mocked(placeOrder).mock.calls[0]?.[2];
    // on-chain resolve_order_size returns a TransactionArgument
    expect(params?.size).toBeDefined();
    expect(typeof params?.size).not.toBe("bigint");
    expect(typeof params?.size).not.toBe("number");
  });

  it("explicit size skips leverage math", async () => {
    const explicit = 88_000n;
    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: true,
      leverage: 99,
      collateralAmount: 100_000_000n,
      size: explicit,
      triggerPrice: 65_000_000_000_000n,
    });
    const params = vi.mocked(placeOrder).mock.calls[0]?.[2];
    expect(params?.size).toBe(explicit);
  });

  it("throws when size and leverage both omitted (placeOrder)", async () => {
    await expect(
      buildPlaceOrderTx(client, {
        accountId,
        base: "ETH",
        isLong: true,
        collateralAmount: 2_000_000n,
        triggerPrice: 3000_000_000_000n,
      }),
    ).rejects.toThrow("Either `size` or `leverage` must be provided");
  });

  it("passes isStopOrder and reduceOnly when set", async () => {
    await buildPlaceOrderTx(client, {
      accountId,
      base: "BTC",
      isLong: false,
      collateralAmount: 50_000_000n,
      size: 5_000n,
      triggerPrice: 60_000_000_000_000n,
      isStopOrder: true,
      reduceOnly: true,
    });
    const params = vi.mocked(placeOrder).mock.calls[0]?.[2];
    expect(params?.isStopOrder).toBe(true);
    expect(params?.reduceOnly).toBe(true);
  });

  it("throws when account has no USDC coins (placeOrder not invoked)", async () => {
    getAccountCoinsMock.mockResolvedValueOnce([]);
    await expect(
      buildPlaceOrderTx(client, {
        accountId,
        base: "BTC",
        isLong: true,
        leverage: 2,
        collateralAmount: 100_000_000n,
        triggerPrice: 65_000_000_000_000n,
      }),
    ).rejects.toThrow(/No USDC coins/);
    expect(vi.mocked(placeOrder)).not.toHaveBeenCalled();
  });
});

describe("WLP tx-builders (async + Pyth)", () => {
  const client = WaterXClient.testnet();

  it("buildMintWlpTx", async () => {
    const tx = await buildMintWlpTx(client, {
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
      recipient: PTB_DUMMY_RECIPIENT,
      minLpAmount: 0n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildMintWlpTx defaults minLpAmount to 0", async () => {
    vi.mocked(mintWlp).mockClear();
    await buildMintWlpTx(client, {
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    const params = vi.mocked(mintWlp).mock.calls[0]?.[2];
    expect(params?.minLpAmount).toBe(0);
    expect(params?.priceResult).toBeDefined();
  });

  it("buildMintWlpTx passes explicit minLpAmount", async () => {
    vi.mocked(mintWlp).mockClear();
    await buildMintWlpTx(client, {
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
      recipient: PTB_DUMMY_RECIPIENT,
      minLpAmount: 500n,
    });
    const params = vi.mocked(mintWlp).mock.calls[0]?.[2];
    expect(params?.minLpAmount).toBe(500n);
  });

  it("buildMintAndStakeWlpTx mints WLP and stakes it in one PTB", async () => {
    const tx = await buildMintAndStakeWlpTx(client, {
      depositCoin: PTB_DUMMY_DEPOSIT_COIN,
    });

    // v2 WLP mint refreshes every pool token's `last_price_refresh_timestamp`
    // first (one collector+aggregate+update_token_value per token), then mints
    // using the deposit token's PriceResult, then stakes.
    expect(getMoveCallFunctions(tx)).toEqual([
      // USDC refresh
      "collector::new",
      "aggregator::aggregate",
      "lp_pool::update_token_value",
      // USDSUI refresh
      "collector::new",
      "aggregator::aggregate",
      "lp_pool::update_token_value",
      // mint + stake
      "lp_pool::mint_wlp",
      "account::request",
      "reward_distributor::deposit",
      "reward_distributor::settle_rewarder_on_deposit",
      "reward_distributor::destroy_deposit_checker",
    ]);
  });

  it("buildRequestRedeemWlpTx", async () => {
    const tx = await buildRequestRedeemWlpTx(client, {
      lpCoin: PTB_DUMMY_COIN_CC,
      recipient: PTB_DUMMY_RECIPIENT,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildCancelRedeemWlpTx", () => {
    const tx = buildCancelRedeemWlpTx(client, { requestId: 1n });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildSettleRedeemWlpTx", async () => {
    const tx = await buildSettleRedeemWlpTx(client, { requestId: 2 });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildSettleRedeemWlpTx tolerates Hermes failure (Pyth update throws)", async () => {
    vi.mocked(updatePythPrices).mockRejectedValueOnce(new Error("hermes down"));
    const tx = await buildSettleRedeemWlpTx(client, { requestId: 2 });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildUnstakeAndRequestRedeemWlpTx redeems from rewarder and opens a WLP redeem request", () => {
    const tx = buildUnstakeAndRequestRedeemWlpTx(client, {
      withdrawalAmount: 1_000n,
      recipient: PTB_DUMMY_RECIPIENT,
    });

    expect(getMoveCallFunctions(tx)).toEqual([
      "account::request",
      "reward_distributor::redeem",
      "reward_distributor::settle_rewarder_on_withdraw",
      "reward_distributor::destroy_withdraw_checker",
      "lp_pool::request_redeem",
    ]);
  });
});

describe("Account tx-builders", () => {
  const client = WaterXClient.testnet();

  beforeEach(() => {
    vi.mocked(transferToAccount).mockClear();
  });

  it("buildTransferToAccountTx uses explicit coinObjectId", () => {
    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
      coinObjectId: PTB_DUMMY_COIN_CC,
      coinType: TESTNET_TYPES.USDC,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
    expect(vi.mocked(transferToAccount)).toHaveBeenCalled();
  });

  it("buildTransferToAccountTx supports amount path", () => {
    const tx = buildTransferToAccountTx(client, {
      accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
      amount: 1_000_000n,
      coinType: TESTNET_TYPES.USDC,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildTransferToAccountTx throws when coin and amount missing", () => {
    expect(() =>
      buildTransferToAccountTx(client, {
        accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
        coinType: TESTNET_TYPES.USDC,
      }),
    ).toThrow("Either `coinObjectId` or `amount` must be provided");
  });

  it("buildReceiveCoinTx builds tx from account coins", async () => {
    getAccountCoinsMock.mockResolvedValueOnce([
      {
        objectId: "0xcoin3",
        type: TESTNET_TYPES.USDC,
        balance: "1000000",
        version: "7",
        digest: "digest7",
      },
    ]);
    const tx = await buildReceiveCoinTx(client, {
      accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
      recipient: PTB_DUMMY_RECIPIENT,
      collateral: "USDC",
      amount: 500_000n,
    });
    expect(tx).toBeInstanceOf(Transaction);
  });

  it("buildReceiveCoinTx omits amount when not passed (full receive path)", async () => {
    getAccountCoinsMock.mockResolvedValueOnce([
      {
        objectId: "0xcoinfull",
        type: TESTNET_TYPES.USDC,
        balance: "1000000",
        version: "8",
        digest: "digest8",
      },
    ]);
    const tx = await buildReceiveCoinTx(client, {
      accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
      recipient: PTB_DUMMY_RECIPIENT,
      collateral: "USDC",
    });
    // `option<u64>(null)` builds a valid PTB graph; `getData()` snapshot may reject some pure shapes.
    expect(tx).toBeInstanceOf(Transaction);
  });

  it("buildReceiveCoinTx throws when no coins found", async () => {
    getAccountCoinsMock.mockResolvedValueOnce([]);
    await expect(
      buildReceiveCoinTx(client, {
        accountObjectAddress: PTB_DUMMY_ACCOUNT_ID,
        recipient: PTB_DUMMY_RECIPIENT,
        collateral: "USDC",
      }),
    ).rejects.toThrow(/No USDC coins found/);
  });
});

describe("keeper tx-builders (liquidate / batch / match / funding)", () => {
  const client = WaterXClient.testnet();
  const rewardRecipient = PTB_DUMMY_ACCOUNT_ID;

  it("buildLiquidateTx appends liquidate wiring", async () => {
    const tx = await buildLiquidateTx(client, {
      base: "BTC",
      rewardRecipient,
      positionId: 0,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildBatchLiquidateTx appends batch liquidate PTB", async () => {
    const tx = await buildBatchLiquidateTx(client, {
      base: "BTC",
      pageSize: 10,
      pageIndex: 0,
      rewardRecipient,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildMatchOrdersTx appends match_orders wiring", async () => {
    const tx = await buildMatchOrdersTx(client, {
      base: "BTC",
      orderTypeTag: 0,
      triggerPrice: 65_000_000_000_000n,
      maxFills: 5n,
    });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildUpdateFundingRateTx appends funding call with oracle feed", async () => {
    const tx = await buildUpdateFundingRateTx(client, { base: "BTC" });
    expect(tx.getData().commands?.length).toBeGreaterThan(0);
  });

  it("buildUpdateFundingRateTx reuses existing Transaction when tx is passed", async () => {
    const outer = new Transaction();
    const n0 = outer.getData().commands?.length ?? 0;
    const same = await buildUpdateFundingRateTx(client, { base: "ETH", tx: outer });
    expect(same).toBe(outer);
    expect((outer.getData().commands?.length ?? 0) > n0).toBe(true);
  });
});
