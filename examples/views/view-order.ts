/**
 * `getOrder({ ticker, orderId, orderTypeTag, triggerPrice, basePriceUsd })`
 * — single order from one of the four books (limit-buy/sell, stop-buy/sell).
 * Frontend uses this for the "Order detail" modal.
 *
 *   WATERX_ORDER_ID=12 WATERX_ORDER_TYPE_TAG=0 \
 *   WATERX_TRIGGER_PRICE=0 WATERX_BASE_PRICE_USD=80000 \
 *     pnpm exec tsx examples/views/view-order.ts
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { ORDER_LIMIT_BUY } from "../../src/perp/constants.ts";
import { getOrder } from "../../src/perp/fetch.ts";
import { rawPrice } from "../../src/utils/math.ts";

run(async () => {
  const client = await buildClient();
  const orderId = BigInt(requireEnv("WATERX_ORDER_ID"));
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const orderTypeTag = Number(process.env.WATERX_ORDER_TYPE_TAG ?? ORDER_LIMIT_BUY);
  const triggerPrice = BigInt(process.env.WATERX_TRIGGER_PRICE ?? "0");
  const basePriceUsd = rawPrice(Number(process.env.WATERX_BASE_PRICE_USD ?? "0"));

  const order = await getOrder(client, {
    ticker,
    orderId,
    orderTypeTag,
    triggerPrice,
    basePriceUsd,
  });
  dump(`getOrder(${ticker}, ${orderId}) →`, order);
});
