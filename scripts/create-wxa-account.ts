/**
 * Create a wxa account on testnet under the local active sui CLI address
 * and print its new ID.
 *
 *   pnpm exec tsx scripts/create-wxa-account.ts [alias]
 *
 * Optional env:
 *   EXECUTE=1   actually broadcast (default: simulate only).
 */
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { createAccount } from "../src/user/account.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { loadActiveKeypair } from "./load-signer.ts";

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
