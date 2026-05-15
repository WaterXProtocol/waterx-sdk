/**
 * `getMarketOrders({ ticker, basePriceUsd, cursor, pageSize })` —
 * paginated stream of every order resting in a market's books. Frontend
 * order-book widget / depth chart can use this.
 *
 *   pnpm exec tsx examples/views/view-market-orders.ts
 *   WATERX_CURSOR=10 WATERX_PAGE_SIZE=50 ... examples/...
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getMarketOrders } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const cursor = BigInt(process.env.WATERX_CURSOR ?? "0");
  const pageSize = BigInt(process.env.WATERX_PAGE_SIZE ?? "100");

  const { orders, nextCursor } = await getMarketOrders(client, { ticker, cursor, pageSize });
  dump(`getMarketOrders(${ticker}) page → (${orders.length})`, orders);
  console.log(`  nextCursor: ${nextCursor ?? "(end of stream)"}`);
});
