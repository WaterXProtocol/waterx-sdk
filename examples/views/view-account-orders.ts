/**
 * `getAccountOrders({ ticker, accountObjectAddress })` — all open orders
 * (limit/stop/market-parked + reduce-only TP/SL legs). Frontend uses
 * this for the "Open orders" table.
 *
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/views/view-account-orders.ts
 *   WATERX_TICKER=ETHUSD ... examples/...
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { getAccountOrders } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";

  const orders = await getAccountOrders(client, {
    ticker,
    accountObjectAddress: accountId,
  });
  dump(`getAccountOrders(${ticker}) → (${orders.length})`, orders);
});
