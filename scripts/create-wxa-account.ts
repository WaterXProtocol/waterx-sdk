/**
 * Create a wxa account on testnet under the local active sui CLI address
 * and print its new ID.
 *
 *   pnpm exec tsx scripts/create-wxa-account.ts [alias]
 *
 * Optional env:
 *   EXECUTE=1   actually broadcast (default: simulate only).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { createAccount } from "../src/user/account.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

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
  loadRepoEnvFiles();
  const { keypair, address } = loadActiveKeypair();
  const alias = process.argv[2] ?? "sdk-smoke";
  const doExecute = process.env.EXECUTE === "1";

  const client = await WaterXClient.create("TESTNET", { cache: true });

  console.log(`sender:   ${address}`);
  console.log(`alias:    ${alias}`);
  console.log(`registry: ${client.config.packages.waterx_account.account_registry}`);
  console.log(`mode:     ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const tx = new Transaction();
  createAccount(client, tx, { alias });
  tx.setSender(address);

  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    const msg = sim.FailedTransaction?.status?.error?.message ?? "(no msg)";
    throw new Error(`simulate aborted: ${msg}`);
  }
  console.log("  ✓ simulate ok");

  if (!doExecute) {
    console.log("\nEXECUTE != 1 — stopping after simulate.");
    return;
  }

  const r = (await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  const success = r.Transaction?.status?.success === true;
  if (!success) {
    throw new Error(`execute failed: ${r.Transaction?.status?.error ?? "(no error)"} ${digest}`);
  }
  console.log(`  ✓ executed  digest=${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});

  const detail = (await client.grpcClient.getTransaction({
    digest,
    include: { events: true } as never,
  })) as {
    Transaction?: { events?: { eventType?: string; json?: { account_object_address?: string } }[] };
  };
  const evs = detail.Transaction?.events ?? [];
  const acctEvt = evs.find((e) => (e.eventType ?? "").includes("AccountCreated"));
  const newId = acctEvt?.json?.account_object_address;
  if (!newId) {
    throw new Error(`no AccountCreated event in tx ${digest}`);
  }
  console.log(`\nWATERX_SMOKE_ACCOUNT_ID=${newId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
