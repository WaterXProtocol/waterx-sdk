/**
 * `getPosition({ ticker, positionId, basePriceUsd, collateralPriceUsd })`
 * — single position with live PnL / est-liquidation price. Frontend
 * uses this for the "Position detail" sidebar / modal.
 *
 *   WATERX_POSITION_ID=3 WATERX_BASE_PRICE_USD=80000 \
 *     pnpm exec tsx examples/views/view-position.ts
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { rawPrice } from "../../src/constants.ts";
import { getPosition } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const positionId = BigInt(requireEnv("WATERX_POSITION_ID"));
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const basePriceUsd = rawPrice(Number(process.env.WATERX_BASE_PRICE_USD ?? "0"));
  const collateralPriceUsd = rawPrice(Number(process.env.WATERX_COLLATERAL_PRICE_USD ?? "1"));

  const pos = await getPosition(client, {
    ticker,
    positionId,
    basePriceUsd,
    collateralPriceUsd,
  });
  dump(`getPosition(${ticker}, ${positionId}) →`, pos);
});
