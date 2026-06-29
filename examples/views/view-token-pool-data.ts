/**
 * `getTokenPoolData(tokenIndex)` — per-token entry inside the WLP pool:
 * liquidity, reserved, value USD, target weight, mint/burn fee bps,
 * borrow rate, last refresh timestamp. Frontend uses it to render the
 * "Pool composition" table.
 *
 *   pnpm exec tsx examples/views/view-token-pool-data.ts
 *   WATERX_TOKEN_INDEX=1 pnpm exec tsx examples/views/view-token-pool-data.ts
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getTokenPoolData } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const tokenIndex = BigInt(process.env.WATERX_TOKEN_INDEX ?? "0");
  const t = await getTokenPoolData(client, { tokenIndex });
  dump(`getTokenPoolData(${tokenIndex}) →`, t);
});
