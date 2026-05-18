/**
 * `getAccountPositions({ ticker, accountObjectAddress, basePriceUsd })` —
 * all positions an account holds in a given market. Frontend uses this
 * for the "My positions" table. Pass live `basePriceUsd` to get realized
 * PnL; pass 0n for cheaper read when you only need entry / size.
 *
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/views/view-account-positions.ts
 *   WATERX_TICKER=ETHUSD WATERX_BASE_PRICE_USD=3500 ... examples/...
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { rawPrice } from "../../src/utils/math.ts";
import { getAccountPositions } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const priceUsd = process.env.WATERX_BASE_PRICE_USD;
  const basePriceUsd = priceUsd ? rawPrice(Number(priceUsd)) : 0n;

  const positions = await getAccountPositions(client, {
    ticker,
    accountObjectAddress: accountId,
    basePriceUsd,
  });
  dump(`getAccountPositions(${ticker}) → (${positions.length})`, positions);
});
