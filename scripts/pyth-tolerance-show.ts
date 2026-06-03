/** Read pyth_rule Config tolerance map + ListingCap owner. */
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { makeSmokeClient } from "./make-smoke-client.ts";

async function rpc(network: string, method: string, params: unknown[]): Promise<any> {
  const url =
    network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : "https://fullnode.testnet.sui.io:443";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return (await res.json()).result;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const client = await makeSmokeClient();
  const configId = client.config.packages.pyth_rule.config;
  const listingCap = client.config.packages.waterx_oracle.listing_cap;

  console.log(`pyth_rule.config: ${configId}`);
  console.log(`oracle.listing_cap: ${listingCap}`);
  console.log(
    `feeds (tickers): ${Object.keys(client.config.packages.pyth_rule.feeds).join(", ")}\n`,
  );

  const cfg = await rpc(client.network.toLowerCase(), "sui_getObject", [
    configId,
    { showContent: true },
  ]);
  const fields = cfg?.data?.content?.fields;
  const tolMap = fields?.tolerance_sec_map?.fields?.contents ?? [];
  console.log("=== tolerance_sec_map (default fallback = 5s) ===");
  if (!tolMap.length) console.log("  (empty — every ticker uses DEFAULT_TOLERANCE_SEC = 5)");
  for (const e of tolMap) {
    console.log(`  ${e.fields.key} -> ${e.fields.value}s`);
  }

  const capObj = await rpc(client.network.toLowerCase(), "sui_getObject", [
    listingCap,
    { showOwner: true },
  ]);
  console.log(`\nListingCap owner: ${JSON.stringify(capObj?.data?.owner)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
