/**
 * Create a WaterX UserAccount on testnet for the integration wallet (same key sources as
 * `pnpm test:integration`). Requires testnet SUI for gas.
 *
 * Usage:
 *   pnpm create-testnet-account
 *   pnpm create-testnet-account --force          # create another even if one exists
 *   pnpm create-testnet-account -- MyLabel       # custom name (default: "integration")
 */
import { Transaction } from "@mysten/sui/transactions";

import { getAccountsByOwner } from "../src/index.ts";
import { createAccount } from "../src/user/account.ts";
import { normalizeIntegrationTxResult } from "../test/helpers/e2e/integration-tx-result.ts";
import { client, loadIntegrationTraderKeypair } from "../test/integration/setup.ts";

function parseArgs(argv: string[]): { force: boolean; name: string } {
  const rest = argv.filter((a) => a !== "--force");
  const force = argv.includes("--force");
  const nameArg = rest.find((a) => !a.startsWith("--"));
  return { force, name: nameArg ?? "integration" };
}

function accountIdFromEvents(events: Array<{ type: string; parsedJson: unknown }>): string {
  const ev = events.find((e) => e.type.includes("AccountCreated"));
  const j = ev?.parsedJson as Record<string, unknown> | null | undefined;
  const id = j?.account_id ?? j?.accountId;
  if (typeof id !== "string") {
    throw new Error(
      "Could not read account_id from AccountCreated event. Events: " +
        JSON.stringify(events.map((e) => e.type)),
    );
  }
  return id;
}

async function main() {
  const { force, name } = parseArgs(process.argv.slice(2));

  let signer;
  try {
    signer = loadIntegrationTraderKeypair();
  } catch (e) {
    console.error(
      "Load a key first: WATERX_INTEGRATION_PRIVATE_KEY, or WATERX_INTEGRATION_KEYSTORE_PATH, " +
        "or `.integration-trader.keystore`, or ~/.sui/sui_config/sui.keystore.\n",
    );
    throw e;
  }

  const owner = signer.getPublicKey().toSuiAddress();

  const existing = await getAccountsByOwner(client, owner);
  if (existing.length > 0 && !force) {
    console.log(`Found ${existing.length} UserAccount(s) for ${owner}:\n`);
    for (const row of existing) {
      console.log(`  ${row.accountId}  (${row.name})`);
    }
    console.log("\nAdd to .env (first account):");
    console.log(`WATERX_INTEGRATION_ACCOUNT_ID=${existing[0]!.accountId}`);
    console.log("\nTo create another account, run with --force (max 20 per address).");
    return;
  }

  const tx = new Transaction();
  createAccount(client, tx, name);
  tx.setSender(owner);
  tx.setGasBudget(50_000_000);

  const raw = await client.grpcClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, events: true, objectTypes: true },
  });
  const result = normalizeIntegrationTxResult(raw);
  await client.grpcClient.waitForTransaction({ digest: result.digest, timeout: 60_000 });

  if (result.effects?.status?.status !== "success") {
    throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
  }

  const accountId = accountIdFromEvents(result.events);
  console.log(`Created UserAccount "${name}" for ${owner}`);
  console.log(`\nWATERX_INTEGRATION_ACCOUNT_ID=${accountId}`);
  console.log(
    "\nNext: send testnet USDC to this address (wallet), then deposit into the UserAccount " +
      "with depositToAccount (TTO transfer to accountId). Faucet / mint flows depend on your setup.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
