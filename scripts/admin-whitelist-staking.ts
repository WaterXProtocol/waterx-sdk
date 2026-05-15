/**
 * One-time admin: whitelist `waterx_staking::witness::WaterXStaking` on
 * the AccountRegistry. Lets every wxa account `take`/`put` through the
 * staking witness, unblocking `stake` / `unstake` / `claimReward`.
 *
 * Requires the AccountRegistry AdminCap (`waterx_account.admin_cap`) to
 * be owned by the local Sui CLI's active address.
 *
 *   pnpm exec tsx scripts/admin-whitelist-staking.ts                  # sim only
 *   WATERX_EXECUTE=1 pnpm exec tsx scripts/admin-whitelist-staking.ts # actually run
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { whitelistProtocol } from "../src/generated/waterx_account/account.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

function loadActiveKeypair(): Ed25519Keypair {
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address from client.yaml");
  const a = m[1]!.toLowerCase();
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const enc of keystore) {
    const raw = fromBase64(enc);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === a) return kp;
  }
  throw new Error(`no ED25519 key for ${a}`);
}

async function main(): Promise<void> {
  const client = await WaterXClient.create("TESTNET", { cache: true });
  const keypair = loadActiveKeypair();

  const stakingOrig = client.config.packages.waterx_staking?.original_id;
  if (!stakingOrig) throw new Error("waterx_staking.original_id not set in config");
  const witnessType = `${stakingOrig}::witness::WaterXStaking`;
  console.log(`Sender:    ${keypair.toSuiAddress()}`);
  console.log(`Witness:   ${witnessType}`);
  console.log(`Registry:  ${client.config.packages.waterx_account.account_registry}`);
  console.log(`AdminCap:  ${client.config.packages.waterx_account.admin_cap}`);

  const tx = new Transaction();
  whitelistProtocol({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      _: tx.object(client.config.packages.waterx_account.admin_cap),
    },
    typeArguments: [witnessType],
  })(tx);

  tx.setSender(keypair.toSuiAddress());
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    console.error(`\nsim aborted: ${sim.FailedTransaction?.status?.error?.message}`);
    process.exit(2);
  }
  console.log("\nsim ok.");

  if (process.env.WATERX_EXECUTE !== "1") {
    console.log("(set WATERX_EXECUTE=1 to actually run)");
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
  console.log(
    `${success ? "✓" : "✗"} digest=${digest} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
  );
  if (digest)
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
