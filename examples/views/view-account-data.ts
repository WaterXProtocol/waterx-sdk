/**
 * `getAccountData(accountId)` — returns the wxa account's perp data slot
 * if it exists. Returns `undefined` when the account has never opened a
 * position/order (the slot auto-installs on first add_position/add_order).
 *
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/views/view-account-data.ts
 */
import { buildClient, dump, requireEnv, run } from "../_shared.ts";
import { getAccountData } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const data = await getAccountData(client, accountId);
  if (!data) {
    console.log(`  getAccountData(${accountId}) → (no perp data slot yet)`);
    return;
  }
  dump(`getAccountData(${accountId}) →`, data);
});
