/**
 * Remote-config smoke: exercises the full async path
 * `PerpClient.create("TESTNET")` against a remote waterx-config.
 *
 *   WATERX_CONFIG_URL=https://staging-v2.waterx-config.pages.dev tsx scripts/smoke-remote.ts
 *
 * The config base is read from `WATERX_CONFIG_URL` (there is no default) — set it
 * in the environment or in a repo `.env` file.
 */
import { waterxQuoteCenterEndpoint } from "../src/oracle/index.ts";
import { PerpClient } from "../src/perp/client.ts";
import { loadRepoEnvFiles, waterxConfigUrlForNetwork } from "./load-repo-env.ts";

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const configUrl = waterxConfigUrlForNetwork("TESTNET");
  if (!configUrl) {
    throw new Error(
      "smoke-remote: set WATERX_CONFIG_URL to a waterx-config CDN base " +
        "(e.g. https://staging-v2.waterx-config.pages.dev)",
    );
  }
  const t0 = Date.now();
  console.log(`fetching config: ${configUrl}`);
  const client = await PerpClient.create("TESTNET", {
    waterxConfigUrl: configUrl,
    cache: true,
  });
  const dt = Date.now() - t0;
  console.log(`-> loaded in ${dt}ms`);

  console.log("\n=== Resolved config ===");
  const row = (label: string, value: unknown): void =>
    console.log(`  ${label.padEnd(34)}${String(value)}`);
  row("network", `${client.config.network} / ${client.config.chain_id}`);
  row("packages.waterx_perp.published_at", client.config.packages.waterx_perp.published_at);
  row("objects.perp.global_config", client.config.objects.perp.global_config);
  row("objects.perp.market_registry_wlp", client.config.objects.perp.market_registry_wlp);
  row("objects.account.registry", client.config.objects.account.registry);
  row("objects.oracle.oracle", client.config.objects.oracle.oracle);
  row("objects.wlp.pool", client.config.objects.wlp.pool);
  row("objects.wlp.aum", client.config.objects.wlp.aum);
  row("objects.referral.table", client.config.objects.referral.table);
  row("quote-center (WATERX_INFRA)", waterxQuoteCenterEndpoint("TESTNET"));
  row("objects.perp.markets", Object.keys(client.config.objects.perp.markets).join(", "));

  console.log("\n=== Cache hit check (2nd create) ===");
  const t1 = Date.now();
  const client2 = await PerpClient.create("TESTNET", {
    waterxConfigUrl: configUrl,
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
  console.log(`  getPoolTokenType("USD")    ${client.getPoolTokenType("USD")}`);
  console.log(`  wlpType()                  ${client.wlpType()}`);

  console.log("\n=== One simulate (sanity) ===");
  const { Transaction } = await import("@mysten/sui/transactions");
  const { createAccount } = await import("../src/account/account.ts");
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
