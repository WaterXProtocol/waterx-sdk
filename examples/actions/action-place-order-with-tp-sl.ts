/**
 * Place a main order **bundled with reduce-only TP/SL legs**. Pre-orders
 * must be opposite side of the main, reduce-only, no collateral, no
 * linked position — `place_order_request` validates this. They activate
 * when the main fills via `match_orders`.
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/actions/action-place-order-with-tp-sl.ts
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
  const size = BigInt(process.env.WATERX_SIZE ?? rawPrice(0.0001).toString());

  const tx = await buildPlaceOrderTx(client, {
    ticker: "BTCUSD",
    collateralType: usdcType,
    accountId,
    main: {
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size,
      triggerPrice: undefined, // market BUY
      acceptablePrice: rawPrice(200000),
      collateralAmount: 5_000_000n,
    },
    preOrders: [
      // Take-profit: limit SELL above entry
      {
        isLong: false,
        isStopOrder: false,
        reduceOnly: true,
        size,
        triggerPrice: rawPrice(Number(process.env.WATERX_TP_USD ?? "90000")),
        acceptablePrice: undefined,
        collateralAmount: 0n,
      },
      // Stop-loss: stop SELL below entry
      {
        isLong: false,
        isStopOrder: true,
        reduceOnly: true,
        size,
        triggerPrice: rawPrice(Number(process.env.WATERX_SL_USD ?? "70000")),
        acceptablePrice: undefined,
        collateralAmount: 0n,
      },
    ],
  });

  await simThenMaybeExecute(client, tx, "placeOrder w/ TP+SL", keypair);
});
