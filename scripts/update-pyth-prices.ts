/**
 * Continuously update Pyth PriceInfoObjects for all configured assets every 30 seconds.
 * Fetches latest VAAs from Hermes and submits on-chain update transactions.
 *
 * Requires WATERX_PYTH_UPDATER_PRIVATE_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) env var.
 *
 * Usage:
 *   WATERX_PYTH_UPDATER_PRIVATE_KEY=suiprivkey1... npx tsx scripts/update-pyth-prices.ts
 *   WATERX_PYTH_UPDATER_PRIVATE_KEY=suiprivkey1... npx tsx scripts/update-pyth-prices.ts --interval 10
 *   npx tsx scripts/update-pyth-prices.ts --once   # single update, no loop
 */
import "dotenv/config";

import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { PYTH_TESTNET_FEED_IDS, TESTNET_MARKETS } from "../src/constants.ts";
import { updatePythPrices } from "../src/utils/pyth.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INTERVAL_FLAG = "--interval";
const ONCE_FLAG = "--once";

const args = process.argv.slice(2);
const once = args.includes(ONCE_FLAG);
const intervalIdx = args.indexOf(INTERVAL_FLAG);
const intervalSec = intervalIdx >= 0 ? Number(args[intervalIdx + 1]) : 30;

if (!once && (isNaN(intervalSec) || intervalSec < 1)) {
  console.error("Invalid --interval value. Usage: --interval <seconds>");
  process.exit(1);
}

const secret =
  process.env.WATERX_PYTH_UPDATER_PRIVATE_KEY ?? process.env.WATERX_INTEGRATION_PRIVATE_KEY;
if (!secret) {
  console.error("Set WATERX_PYTH_UPDATER_PRIVATE_KEY or WATERX_INTEGRATION_PRIVATE_KEY env var.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const keypair = Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(secret).secretKey);
const sender = keypair.getPublicKey().toSuiAddress();
const client = WaterXClient.testnet();
const pythConfig = client.config.pythConfig!;

// Collect all unique Pyth feed IDs across markets + collaterals
const allFeedKeys = new Set<string>();
for (const m of Object.values(TESTNET_MARKETS)) allFeedKeys.add(m.feedKey);

const feedIds = [...allFeedKeys].map((key) => {
  const id = PYTH_TESTNET_FEED_IDS[key];
  if (!id) throw new Error(`No Pyth testnet feed ID for ${key}`);
  return id;
});

console.log(`Pyth price updater`);
console.log(`  sender:   ${sender}`);
console.log(`  feeds:    ${[...allFeedKeys].join(", ")} (${feedIds.length} feeds)`);
if (!once) console.log(`  interval: ${intervalSec}s`);

// ---------------------------------------------------------------------------
// Update loop
// ---------------------------------------------------------------------------

async function doUpdate(): Promise<boolean> {
  const tx = new Transaction();
  tx.setSender(sender);
  tx.setGasBudget(1_000_000_000);

  try {
    const priceInfoIds = await updatePythPrices(tx, client.grpcClient, pythConfig, feedIds);
    console.log(
      `[${new Date().toISOString()}] Hermes OK — ${priceInfoIds.length} PriceInfoObjects updated`,
    );
  } catch (e) {
    const ts = new Date().toISOString();
    // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
    console.error("[%s] Hermes fetch failed:", ts, e instanceof Error ? e.message : e);
    return false;
  }

  try {
    const raw: unknown = await client.grpcClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
    });
    // gRPC result: { $kind: "Transaction"|"FailedTransaction", Transaction: { digest, status: { success } } }
    const r = raw as {
      $kind?: string;
      Transaction?: Record<string, unknown>;
      FailedTransaction?: Record<string, unknown>;
    };
    const inner = r.Transaction ?? r.FailedTransaction;
    const digest = inner?.digest ?? "";
    const success = (inner?.status as { success?: boolean } | undefined)?.success === true;
    const status = success ? "success" : "failure";
    console.log("[%s] tx %s: %s", new Date().toISOString(), status, digest);
    return success;
  } catch (e) {
    const ts = new Date().toISOString();
    // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
    console.error("[%s] tx execution failed:", ts, e instanceof Error ? e.message : e);
    return false;
  }
}

async function main() {
  if (once) {
    const ok = await doUpdate();
    process.exit(ok ? 0 : 1);
  }

  // Loop
  while (true) {
    await doUpdate();
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
