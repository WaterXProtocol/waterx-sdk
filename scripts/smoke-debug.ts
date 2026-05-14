/**
 * Dump raw simulate output for a read query to inspect the response shape.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import type { WaterXConfig } from "../src/config.ts";
import { isValidReferralCode } from "../src/generated/bucket_v2_referral/referral_table.ts";

const CONFIG_PATH = resolve(import.meta.dirname, "..", "..", "waterx-config", "testnet.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as WaterXConfig;
const client = new WaterXClient("TESTNET", config);

const tx = new Transaction();
isValidReferralCode({
  package: client.config.packages.bucket_referral!.published_at,
  arguments: { code: "smoke" },
})(tx);
tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000abc");

const sim = await client.simulate(tx);
console.log(
  JSON.stringify(sim, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(0, 4000),
);
