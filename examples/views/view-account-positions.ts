/**
 * `getAccountPositions({ ticker, accountObjectAddress, basePriceUsd })` —
 * all positions an account holds in a given market. Frontend uses this
 * for the "My positions" table. Pass a live whole-dollar `basePriceUsd` to
 * base PnL; 0n zero-bases the PnL fields when you only need entry / size.
 *
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/views/view-account-positions.ts
 *   WATERX_TICKER=ETHUSD WATERX_BASE_PRICE_USD=3500 ... examples/...
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { getAccountPositions, parseWholeDollarU64 } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const priceUsd = process.env.WATERX_BASE_PRICE_USD;
  // whole-dollar u64 — the view applies float::from; do NOT pass 1e9-scaled rawPrice().
  // parseWholeDollarU64 throws on fractional input instead of silently rounding.
  const basePriceUsd = priceUsd ? parseWholeDollarU64(priceUsd) : 0n;

  const positions = await getAccountPositions(client, {
    ticker,
    accountObjectAddress: accountId,
    basePriceUsd,
  });
  dump(`getAccountPositions(${ticker}) → (${positions.length})`, positions);
});
