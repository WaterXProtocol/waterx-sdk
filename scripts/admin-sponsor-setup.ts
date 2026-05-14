/**
 * Admin one-shot for the pyth_sponsor_rule flow:
 *
 *   1. For every market: `remove_request_rule<LP, PythRule>` (if present)
 *      then `add_request_rule<LP, PythSponsorRule>`.
 *   2. Supply SUI into the shared PythSponsor pool so it can pay
 *      Pyth update fees (~2 MIST per update, this script supplies 0.1 SUI
 *      by default — override with `SPONSOR_SUI_MIST=...`).
 *
 * Env:
 *   TICKERS=BTCUSD,ETHUSD,...   only act on these markets (default: all)
 *   SPONSOR_SUI_MIST=100000000   amount of SUI MIST to supply (default 1e8 = 0.1 SUI)
 *   SKIP_CHECKLIST=1             only fund the sponsor pool
 *   SKIP_SUPPLY=1                only swap the checklists
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { supply as sponsorSupply } from "../src/generated/pyth_sponsor_rule/pyth_sponsor_rule.ts";
import { addRequestRule, removeRequestRule } from "../src/generated/waterx_perp/trading.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address from client.yaml");
  const activeAddress = m[1]!.toLowerCase();
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === activeAddress) {
      return { keypair: kp, address: kp.toSuiAddress() };
    }
  }
  throw new Error(`no ED25519 key in keystore matches active address ${activeAddress}`);
}

async function main(): Promise<void> {
  const { keypair, address } = loadActiveKeypair();
  console.log(`Sender: ${address}`);
  const client = await WaterXClient.create("TESTNET", { cache: true });

  const perpPkg = client.config.packages.waterx_perp.published_at;
  const perpAdminCap = client.config.packages.waterx_perp.admin_cap;
  const marketRegistry = client.config.packages.waterx_perp.market_registry_wlp;
  const sponsorPkgEntry = client.config.packages.pyth_sponsor_rule;
  if (!sponsorPkgEntry?.published_at || !sponsorPkgEntry.pyth_sponsor) {
    throw new Error("pyth_sponsor_rule.{published_at,pyth_sponsor} missing from config");
  }
  const sponsorPkg = sponsorPkgEntry.published_at;
  const sponsorObj = sponsorPkgEntry.pyth_sponsor;
  const pythRuleType = `${client.config.packages.pyth_rule.original_id}::pyth_rule::PythRule`;
  const sponsorWitnessType = `${sponsorPkgEntry.original_id}::pyth_sponsor_rule::PythSponsorRule`;
  const lpType = client.wlpType();

  const tickers = (
    process.env.TICKERS ?? Object.keys(client.config.packages.waterx_perp.markets).join(",")
  ).split(",");

  const tx = new Transaction();
  const capArg = tx.object(perpAdminCap) as unknown as TransactionArgument;
  const regArg = tx.object(marketRegistry) as unknown as TransactionArgument;

  if (process.env.SKIP_CHECKLIST !== "1") {
    console.log(`Plan (checklist swap on ${tickers.length} markets):`);
    for (const t of tickers) {
      removeRequestRule({
        package: perpPkg,
        arguments: {
          marketRegistry: regArg as unknown as string,
          cap: capArg as unknown as string,
          ticker: t,
        },
        typeArguments: [lpType, pythRuleType],
      })(tx);
      addRequestRule({
        package: perpPkg,
        arguments: {
          marketRegistry: regArg as unknown as string,
          cap: capArg as unknown as string,
          ticker: t,
        },
        typeArguments: [lpType, sponsorWitnessType],
      })(tx);
      console.log(`  + ${t}: -PythRule  +PythSponsorRule`);
    }
  }

  if (process.env.SKIP_SUPPLY !== "1") {
    const supplyMist = BigInt(process.env.SPONSOR_SUI_MIST ?? "100000000"); // 0.1 SUI
    console.log(`Plan: supply ${supplyMist} MIST SUI into PythSponsor (${sponsorObj})`);
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(supplyMist)]);
    sponsorSupply({
      package: sponsorPkg,
      arguments: {
        self: tx.object(sponsorObj),
        coin: coin as unknown as string,
      },
    })(tx);
  }

  tx.setSender(address);
  const sim = (await client.simulate(tx)) as unknown as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    console.error(
      `\nSimulate aborted: ${sim.FailedTransaction?.status?.error?.message ?? "(unknown)"}`,
    );
    process.exit(2);
  }
  console.log("\nSimulate ok. Executing...");

  const result = (await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = result.Transaction?.digest;
  const ok = result.Transaction?.status?.success === true;
  console.log(
    `${ok ? "✓" : "✗"} ${digest ?? "(no digest)"} ${ok ? "" : (result.Transaction?.status?.error ?? "")}`,
  );
  if (digest)
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
