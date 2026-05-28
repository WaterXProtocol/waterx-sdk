/**
 * Place a **market** order — `triggerPrice: undefined` parks at tick 0
 * in the limit book and a keeper fills via `match_orders` at the live
 * oracle. `acceptablePrice` caps slippage.
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/actions/action-place-market-order.ts
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
  const usdcType = client.creditType();

  const tx = await buildPlaceOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    main: {
      isLong: process.env.WATERX_IS_LONG !== "0",
      isStopOrder: false,
      reduceOnly: false,
      size: BigInt(process.env.WATERX_SIZE ?? rawPrice(0.0001).toString()),
      triggerPrice: undefined, // market form
      acceptablePrice: rawPrice(Number(process.env.WATERX_ACCEPTABLE_USD ?? "200000")),
      collateralAmount: BigInt(process.env.WATERX_COLLATERAL ?? "5000000"),
    },
    preOrders: [],
  });

  await simThenMaybeExecute(client, tx, "placeOrder market", keypair);
});
