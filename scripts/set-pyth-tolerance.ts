/**
 * Loosen pyth_rule per-ticker timestamp tolerance (seconds) for every feed.
 *
 * feed() drops a Pyth price when |onchain_time - pyth_publish_time| > tolerance.
 * Needs the waterx_oracle::ListingCap (must be owned by the active address).
 *
 *   TOLERANCE_SEC=300 pnpm exec tsx scripts/set-pyth-tolerance.ts          # sim only
 *   TOLERANCE_SEC=300 EXECUTE=1 pnpm exec tsx scripts/set-pyth-tolerance.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { PerpClient } from "../src/client.ts";
import { setToleranceSec } from "../src/generated/waterx_pyth_rule/pyth_rule.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");
const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");

function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address");
  const active = m[1]!.toLowerCase();
  for (const enc of JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[]) {
    const raw = fromBase64(enc);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === active)
      return { keypair: kp, address: kp.toSuiAddress() };
  }
  throw new Error(`no key matches ${active}`);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const { keypair, address } = loadActiveKeypair();
  const toleranceSec = BigInt(process.env.TOLERANCE_SEC ?? "300");
  const doExecute = process.env.EXECUTE === "1";

  const client = await PerpClient.create("TESTNET", { cache: true });
  const pkg = client.config.packages.pyth_rule.published_at;
  const configId = client.config.packages.pyth_rule.config;
  const listingCap = client.config.packages.waterx_oracle.listing_cap;
  const allTickers = Object.keys(client.config.packages.pyth_rule.feeds);
  // TICKERS=USDCUSD,BTCUSD restricts the set; default = every feed.
  const filter = process.env.TICKERS?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const tickers = filter?.length ? filter : allTickers;
  const unknown = tickers.filter((t) => !allTickers.includes(t));
  if (unknown.length) throw new Error(`unknown ticker(s): ${unknown.join(", ")}`);

  console.log(`sender:        ${address}`);
  console.log(`pyth_rule cfg: ${configId}`);
  console.log(`listing_cap:   ${listingCap}`);
  console.log(`tolerance:     ${toleranceSec}s`);
  console.log(`tickers:       ${tickers.length} (${tickers.join(", ")})`);
  console.log(`mode:          ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const tx = new Transaction();
  for (const ticker of tickers) {
    setToleranceSec({
      package: pkg,
      arguments: {
        config: tx.object(configId),
        Cap: tx.object(listingCap),
        symbol: ticker,
        toleranceSec,
      },
    })(tx);
  }
  tx.setSender(address);

  console.log("\nsimulating…");
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    throw new Error(
      `simulate aborted: ${sim.FailedTransaction?.status?.error?.message ?? "(no msg)"}`,
    );
  }
  console.log("  ✓ simulate ok");

  if (!doExecute) {
    console.log("\nEXECUTE != 1 — stopping after simulate.");
    return;
  }

  console.log("\nexecuting…");
  const r = (await client.signAndExecuteTransaction({ signer: keypair, transaction: tx })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  if (r.Transaction?.status?.success !== true) {
    throw new Error(`execute failed: ${r.Transaction?.status?.error ?? ""} ${digest}`);
  }
  console.log(`  ✓ executed  digest=${digest}`);
  console.log(`  tx: https://suiscan.xyz/testnet/tx/${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
