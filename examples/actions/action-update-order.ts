/**
 * `buildUpdateOrderTx` — change `size` and/or `trigger_price` of an
 * existing order without cancelling it. The `currentTriggerPrice` tells
 * the contract where to find the order today.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_ORDER_ID=12 \
 *   WATERX_CURRENT_TRIGGER_USD=60000 WATERX_NEW_TRIGGER_USD=62000 \
 *     pnpm exec tsx examples/actions/action-update-order.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildUpdateOrderTx, ORDER_LIMIT_BUY, rawPrice } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.getPoolTokenType("USDCUSD");

  const tx = await buildUpdateOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    orderId: BigInt(requireEnv("WATERX_ORDER_ID")),
    currentTriggerPrice: rawPrice(Number(requireEnv("WATERX_CURRENT_TRIGGER_USD"))),
    newTriggerPrice: rawPrice(Number(requireEnv("WATERX_NEW_TRIGGER_USD"))),
    newSize: BigInt(process.env.WATERX_NEW_SIZE ?? rawPrice(0.0001).toString()),
    orderTypeTag: Number(process.env.WATERX_ORDER_TYPE_TAG ?? ORDER_LIMIT_BUY),
  });

  await simThenMaybeExecute(client, tx, "updateOrder", keypair);
});
