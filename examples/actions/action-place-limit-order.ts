/**
 * Place a **limit** order — `triggerPrice` is the price the order
 * activates at. Limit orders ignore `acceptablePrice` (slippage cap
 * only applies to market form). Use `isStopOrder: true` for stops.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_TRIGGER_USD=60000 \
 *     pnpm exec tsx examples/actions/action-place-limit-order.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildPlaceOrderTx, rawPrice } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.getPoolTokenType("USDCUSD");

  const tx = await buildPlaceOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    main: {
      isLong: process.env.WATERX_IS_LONG !== "0",
      isStopOrder: process.env.WATERX_IS_STOP === "1",
      reduceOnly: false,
      size: BigInt(process.env.WATERX_SIZE ?? rawPrice(0.0001).toString()),
      triggerPrice: rawPrice(Number(process.env.WATERX_TRIGGER_USD ?? "60000")),
      acceptablePrice: undefined,
      collateralAmount: BigInt(process.env.WATERX_COLLATERAL ?? "5000000"),
    },
    preOrders: [],
  });

  await simThenMaybeExecute(client, tx, "placeOrder limit", keypair);
});
