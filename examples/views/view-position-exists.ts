/**
 * `positionExists({ ticker, positionId })` — cheap boolean check. Useful
 * before issuing a close/decrease request to avoid `EPositionNotFound`.
 *
 *   WATERX_POSITION_ID=3 pnpm exec tsx examples/views/view-position-exists.ts
 */
import { buildClient, requireEnv, run } from "../_shared.ts";
import { positionExists } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const positionId = BigInt(requireEnv("WATERX_POSITION_ID"));
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  const exists = await positionExists(client, { ticker, positionId });
  console.log(`  positionExists(${ticker}, ${positionId}) → ${exists}`);
});
