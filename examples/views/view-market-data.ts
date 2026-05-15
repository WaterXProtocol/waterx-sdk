/**
 * `getMarketData(ticker)` — full per-market struct (OI, fees, leverage cap,
 * funding state, tick size, next ids). Frontend uses this to render the
 * market header / config row.
 *
 *   pnpm exec tsx examples/views/view-market-data.ts
 *   WATERX_TICKER=ETHUSD pnpm exec tsx examples/views/view-market-data.ts
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getMarketData } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const market = await getMarketData(client, { ticker });
  dump(`getMarketData(${ticker}) →`, market);
});
