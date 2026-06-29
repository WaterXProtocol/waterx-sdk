/**
 * `getPoolData()` — WLP pool aggregate: total LP supply, AUM (TVL USD),
 * number of tokens. Frontend uses it for the "TVL / WLP price" tile.
 *
 *   pnpm exec tsx examples/views/view-pool-data.ts
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getPoolData } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const pool = await getPoolData(client);
  dump("getPoolData() →", pool);
});
