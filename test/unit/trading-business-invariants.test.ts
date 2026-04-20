/** PTB arg order vs `trading::execute` (base PriceResult before collateral). */
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { WaterXClient } from "../../src/client";
import { TESTNET_TYPES } from "../../src/constants";
import { cancelOrder, placeOrder } from "../../src/user/order";
import {
  closePosition,
  depositCollateral,
  liquidate,
  matchOrders,
  openPosition,
  withdrawCollateral,
} from "../../src/user/trading";
import {
  assertCancelOrderRequestShape,
  assertMatchOrdersPriceWiring,
  assertOpenPositionTypesAndMarket,
  assertPlaceOrderExecutePriceWiring,
  assertPlaceOrderRequestShape,
  assertTradingExecutePriceWiring,
} from "../helpers/trading-ptb-assertions";

const client = WaterXClient.testnet();

const accountId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const receivingCoins = [
  {
    objectId: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    version: "1",
    digest: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
  },
];

function bucketFloats(tx: Transaction, a: bigint, b: bigint) {
  const pkg = client.config.bucketFrameworkPackageId!;
  const [x] = tx.moveCall({
    target: `${pkg}::float::from_scaled_val`,
    arguments: [tx.pure.u128(a)],
  });
  const [y] = tx.moveCall({
    target: `${pkg}::float::from_scaled_val`,
    arguments: [tx.pure.u128(b)],
  });
  return { base: x!, collateral: y! };
}

describe("trading PTB vs Move contract (price / market wiring)", () => {
  it("openPosition: execute receives base PriceResult then collateral PriceResult", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 60_000_000_000n, 1_000_000n);
    openPosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 100_000_000n,
      isLong: true,
      size: 5000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "open_position_request");
    assertOpenPositionTypesAndMarket(tx, {
      expectedMarket: client.config.markets.BTC.marketId,
      collateralType: TESTNET_TYPES.USDC,
      baseType: TESTNET_TYPES.BTC_USD,
      lpType: TESTNET_TYPES.WLP,
    });
  });

  it("openPosition ETH: market + base type match ETH config", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 2000n, 1n);
    openPosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.ETH_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.ETH.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 50_000_000n,
      isLong: false,
      size: 3000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "open_position_request");
    assertOpenPositionTypesAndMarket(tx, {
      expectedMarket: client.config.markets.ETH.marketId,
      collateralType: TESTNET_TYPES.USDC,
      baseType: TESTNET_TYPES.ETH_USD,
      lpType: TESTNET_TYPES.WLP,
    });
  });

  it("closePosition: same execute price-arg order as open", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 1n, 2n);
    closePosition(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 0,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "close_position_request");
  });

  it("depositCollateral: execute still wires base then collateral", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 3n, 4n);
    depositCollateral(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 1,
      receivingCoins,
      collateralAmount: 1_000_000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "deposit_collateral_request");
  });

  it("withdrawCollateral: execute wires base then collateral", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 5n, 6n);
    withdrawCollateral(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 2,
      amount: 500_000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "withdraw_collateral_request");
  });

  it("liquidate: execute wires base then collateral", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 7n, 8n);
    liquidate(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      positionId: 3,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "liquidate_request");
  });

  it("matchOrders: base PriceResult then collateral on-chain", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 9n, 10n);
    matchOrders(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      orderTypeTag: 0,
      triggerPrice: 65_000n,
      maxFills: 3n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertMatchOrdersPriceWiring(tx);
  });

  it("regression: swapping base/collateral PriceResult changes execute NestedResult indices", () => {
    const txWrong = new Transaction();
    const { base, collateral } = bucketFloats(txWrong, 100n, 200n);
    openPosition(client, txWrong, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 1n,
      isLong: true,
      size: 5000n,
      basePriceResult: collateral,
      collateralPriceResult: base,
    });
    expect(() => assertTradingExecutePriceWiring(txWrong, "open_position_request")).toThrow();
  });

  it("placeOrder: execute receives base PriceResult then collateral (trigger float precedes request)", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 60_000_000_000n, 1_000_000n);
    placeOrder(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.BTC_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.BTC.marketId,
      accountId: accountId,
      receivingCoins,
      collateralAmount: 100_000_000n,
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: 5000n,
      triggerPrice: 65_000_000_000_000n,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertPlaceOrderExecutePriceWiring(tx);
    assertPlaceOrderRequestShape(tx, {
      expectedMarket: client.config.markets.BTC.marketId,
      collateralType: TESTNET_TYPES.USDC,
      baseType: TESTNET_TYPES.BTC_USD,
      lpType: TESTNET_TYPES.WLP,
    });
  });

  it("cancelOrder: same execute price-arg order as open", () => {
    const tx = new Transaction();
    const { base, collateral } = bucketFloats(tx, 1n, 2n);
    cancelOrder(client, tx, {
      collateralTokenType: TESTNET_TYPES.USDC,
      baseTokenType: TESTNET_TYPES.ETH_USD,
      lpTokenType: TESTNET_TYPES.WLP,
      market: client.config.markets.ETH.marketId,
      accountId: accountId,
      orderId: 3,
      triggerPrice: 3_500n,
      orderTypeTag: 1,
      basePriceResult: base,
      collateralPriceResult: collateral,
    });
    assertTradingExecutePriceWiring(tx, "cancel_order_request");
    assertCancelOrderRequestShape(tx, {
      expectedMarket: client.config.markets.ETH.marketId,
      collateralType: TESTNET_TYPES.USDC,
      baseType: TESTNET_TYPES.ETH_USD,
      lpType: TESTNET_TYPES.WLP,
    });
  });
});
