/**
 * `getGlobalConfigData()` — protocol-wide config: pause flags, fee
 * shares, keeper allowlist version, etc. Frontend uses it for global
 * banners / disabled-state UI.
 *
 *   pnpm exec tsx examples/views/view-global-config.ts
 */
import { buildClient, dump, run } from "../_shared.ts";
import { getGlobalConfigData } from "../../src/perp/fetch.ts";

run(async () => {
  const client = await buildClient();
  const cfg = await getGlobalConfigData(client);
  dump("getGlobalConfigData() →", cfg);
});
