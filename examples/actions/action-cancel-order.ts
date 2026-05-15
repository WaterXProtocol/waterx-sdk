/**
 * `buildCancelOrderTx` — cancel an order by id. Pass `orderTypeTag:
 * ORDER_TAG_WILDCARD` (255) + `triggerPrice: 0n` to scan all 4 books by
 * orderId when you don't remember the side.
 *
 *   WATERX_ACCOUNT_ID=0x... WATERX_ORDER_ID=12 \
 *     pnpm exec tsx examples/actions/action-cancel-order.ts
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildCancelOrderTx, ORDER_TAG_WILDCARD } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdcType = client.getPoolTokenType("USDCUSD");

  const tx = await buildCancelOrderTx(client, {
    ticker: process.env.WATERX_TICKER ?? "BTCUSD",
    collateralType: usdcType,
    accountId,
    orderId: BigInt(requireEnv("WATERX_ORDER_ID")),
    triggerPrice: BigInt(process.env.WATERX_TRIGGER_PRICE ?? "0"),
    orderTypeTag: Number(process.env.WATERX_ORDER_TYPE_TAG ?? ORDER_TAG_WILDCARD),
  });

  await simThenMaybeExecute(client, tx, "cancelOrder", keypair);
});
