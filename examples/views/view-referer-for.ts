/**
 * `getRefererFor(referee)` — returns the address of the referrer bound
 * to `referee`, or `undefined` if not referred. Frontend uses this on
 * profile / rewards pages.
 *
 *   WATERX_REFEREE=0x... pnpm exec tsx examples/views/view-referer-for.ts
 */
import { buildClient, requireEnv, run } from "../_shared.ts";
import { getRefererFor } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const referee = requireEnv("WATERX_REFEREE");
  const referer = await getRefererFor(client, referee);
  console.log(`  getRefererFor(${referee}) → ${referer ?? "(none)"}`);
});
