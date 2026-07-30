/**
 * `getPosition({ ticker, positionId, basePriceUsd, collateralPriceUsd })`
 * — single position with live PnL / est-liquidation price. Frontend
 * uses this for the "Position detail" sidebar / modal.
 *
 *   WATERX_POSITION_ID=3 WATERX_BASE_PRICE_USD=80000 \
 *     pnpm exec tsx examples/views/view-position.ts
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { getPosition, parseWholeDollarU64 } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const positionId = BigInt(requireEnv("WATERX_POSITION_ID"));
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  // whole-dollar u64 — the view applies float::from; do NOT pass 1e9-scaled rawPrice().
  // parseWholeDollarU64 throws on fractional input instead of silently rounding.
  const basePriceUsd = parseWholeDollarU64(process.env.WATERX_BASE_PRICE_USD ?? "0");
  const collateralPriceUsd = parseWholeDollarU64(process.env.WATERX_COLLATERAL_PRICE_USD ?? "1");

  const pos = await getPosition(client, {
    ticker,
    positionId,
    basePriceUsd,
    collateralPriceUsd,
  });
  dump(`getPosition(${ticker}, ${positionId}) →`, pos);
});
