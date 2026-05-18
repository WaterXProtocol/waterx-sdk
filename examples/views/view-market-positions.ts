/**
 * `getMarketPositions({ ticker, basePriceUsd, cursor, pageSize })` —
 * paginated list of every position in a market. Frontend "Leaderboard /
 * Open interest by trader" or admin tooling uses this.
 *
 *   WATERX_BASE_PRICE_USD=80000 pnpm exec tsx examples/views/view-market-positions.ts
 *   WATERX_CURSOR=10 WATERX_PAGE_SIZE=50 ... examples/...
 */
import { buildClient, dump, run } from "../_shared.ts";
import { rawPrice } from "../../src/utils/math.ts";
import { getMarketPositions } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const basePriceUsd = rawPrice(Number(process.env.WATERX_BASE_PRICE_USD ?? "0"));
  const cursor = BigInt(process.env.WATERX_CURSOR ?? "0");
  const pageSize = BigInt(process.env.WATERX_PAGE_SIZE ?? "100");

  const { positions, nextCursor } = await getMarketPositions(client, {
    ticker,
    basePriceUsd,
    cursor,
    pageSize,
  });
  dump(`getMarketPositions(${ticker}) page → (${positions.length})`, positions);
  console.log(`  nextCursor: ${nextCursor ?? "(end of stream)"}`);
});
