/**
 * Add keeper addresses to GlobalConfig.
 * Keepers can: match orders, update funding rates, liquidate.
 *
 * Usage: npx tsx scripts/setup-keepers.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { TESTNET_OBJECTS, TESTNET_PACKAGE_IDS } from "../src/constants.ts";

const ADMIN_CAP = TESTNET_OBJECTS.ADMIN_CAP;
const GLOBAL_CONFIG = TESTNET_OBJECTS.GLOBAL_CONFIG;
const PKG = TESTNET_PACKAGE_IDS.WATERX_PERP;

/** Add keeper addresses here. */
const KEEPER_ADDRESSES: string[] = [
  // "0x...",
];

async function main() {
  if (!KEEPER_ADDRESSES.length) {
    console.log("No keeper addresses configured. Edit KEEPER_ADDRESSES in this file.");
    return;
  }

  const secretKey = process.env.ADMIN_SECRET_KEY;
  if (!secretKey) {
    console.log("Usage: ADMIN_SECRET_KEY=<base64> npx tsx scripts/setup-keepers.ts");
    console.log(`\nWould add ${KEEPER_ADDRESSES.length} keeper(s):`);
    KEEPER_ADDRESSES.forEach((a) => console.log(`  ${a}`));
    return;
  }

  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const client = WaterXClient.testnet();

  const tx = new Transaction();
  tx.setGasBudget(100_000_000);

  for (const keeper of KEEPER_ADDRESSES) {
    tx.moveCall({
      target: `${PKG}::global_config::add_keeper`,
      arguments: [tx.object(ADMIN_CAP), tx.object(GLOBAL_CONFIG), tx.pure.address(keeper)],
    });
    console.log(`+ Adding keeper: ${keeper}`);
  }

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  });
  const digest =
    result.$kind === "Transaction" ? result.Transaction.digest : result.FailedTransaction!.digest;
  console.log("Digest:", digest);
}

main().catch(console.error);
