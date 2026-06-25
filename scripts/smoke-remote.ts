/**
 * Remote-config smoke: exercises the full async path
 * `PerpClient.create("TESTNET")` against the public waterx-config repo.
 *
 *   tsx scripts/smoke-remote.ts
 *
 * Hits https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json
 * by default; pass `WATERX_CONFIG_URL` to override.
 */
import { PerpClient } from "../src/client.ts";
import { defaultConfigUrl } from "../src/config.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

const overrideUrl = process.env.WATERX_CONFIG_URL;

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const t0 = Date.now();
  console.log(`fetching config: ${overrideUrl ?? defaultConfigUrl("TESTNET")}`);
  const client = await PerpClient.create("TESTNET", {
    configUrl: overrideUrl,
    cache: true,
  });
  const dt = Date.now() - t0;
  console.log(`-> loaded in ${dt}ms`);

  console.log("\n=== Resolved config ===");
  console.log(`  network               ${client.config.network} / ${client.config.chain_id}`);
  console.log(`  packages.waterx_perp  ${client.config.packages.waterx_perp.published_at}`);
  console.log(`  global_config         ${client.config.packages.waterx_perp.global_config}`);
  console.log(`  market_registry_wlp   ${client.config.packages.waterx_perp.market_registry_wlp}`);
  console.log(`  wxa account_registry  ${client.config.packages.waterx_account.account_registry}`);
  console.log(`  oracle                ${client.config.packages.waterx_oracle.oracle}`);
  console.log(`  wlp_pool              ${client.config.packages.wlp.wlp_pool}`);
  console.log(`  wlp_aum               ${client.config.packages.wlp.wlp_aum ?? "(missing)"}`);
  console.log(
    `  referral_table        ${client.config.packages.waterx_referral?.referral_table ?? "(missing)"}`,
  );
  console.log(`  pyth state            ${client.pyth.state_id}`);
  console.log(`  pyth hermes           ${client.pyth.hermes_endpoint}`);
  console.log(
    `  markets               ${Object.keys(client.config.packages.waterx_perp.markets).join(", ")}`,
  );

  console.log("\n=== Cache hit check (2nd create) ===");
  const t1 = Date.now();
  const client2 = await PerpClient.create("TESTNET", {
    configUrl: overrideUrl,
    cache: true,
  });
  const dt2 = Date.now() - t1;
  console.log(`  2nd create: ${dt2}ms ${dt2 < dt / 2 ? "(cached)" : ""}`);
  if (client2.config !== client.config) {
    console.warn("  warning: 2nd create did not return the cached config object");
  }

  console.log("\n=== Lookup helpers ===");
  console.log(`  getMarket("BTCUSD")        ${JSON.stringify(client.getMarket("BTCUSD"))}`);
  console.log(`  getAggregator("BTCUSD")    ${client.getAggregator("BTCUSD")}`);
  console.log(`  getPythFeed("BTCUSD")      ${JSON.stringify(client.getPythFeed("BTCUSD"))}`);
  console.log(`  getPoolTokenType("USD")    ${client.getPoolTokenType("USD")}`);
  console.log(`  wlpType()                  ${client.wlpType()}`);

  console.log("\n=== One simulate (sanity) ===");
  const { Transaction } = await import("@mysten/sui/transactions");
  const { createAccount } = await import("../src/user/account.ts");
  const tx = new Transaction();
  createAccount(client, tx, { alias: "remote-smoke" });
  tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000abc");
  const sim = (await client.simulate(tx)) as unknown as { $kind?: string };
  console.log(`  createAccount sim          ${sim.$kind ?? "(unknown)"}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
