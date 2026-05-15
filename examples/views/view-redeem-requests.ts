/**
 * `getRedeemRequests({ cursor, pageSize })` — paginated list of pending
 * WLP redeem requests. Useful for keepers running `settle_redeem` and
 * for the user-side "Pending redemptions" view.
 *
 *   pnpm exec tsx examples/views/view-redeem-requests.ts
 *   WATERX_CURSOR=10 WATERX_PAGE_SIZE=50 ... examples/...
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getRedeemRequests } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const cursor = BigInt(process.env.WATERX_CURSOR ?? "0");
  const pageSize = BigInt(process.env.WATERX_PAGE_SIZE ?? "100");

  const { requests, nextCursor } = await getRedeemRequests(client, { cursor, pageSize });
  dump(`getRedeemRequests page → (${requests.length})`, requests);
  console.log(`  nextCursor: ${nextCursor ?? "(end of stream)"}`);
});
