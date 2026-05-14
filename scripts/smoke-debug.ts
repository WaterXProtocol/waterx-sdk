/**
 * Dump raw simulate output for one case to inspect the response shape.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import type { WaterXConfig } from "../src/config.ts";
import { rawPrice } from "../src/constants.ts";
import { closePositionRequest, executeTrading } from "../src/index.ts";
import { refreshOraclePrices } from "../src/utils/pyth.ts";

const CONFIG_PATH = resolve(import.meta.dirname, "..", "..", "waterx-config", "testnet.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as WaterXConfig;
const client = new WaterXClient("TESTNET", config);

const tx = new Transaction();
await refreshOraclePrices(tx, client, ["BTCUSD", "USDCUSD"]);
const req = closePositionRequest(client, tx, {
  ticker: "BTCUSD",
  collateralType: client.getPoolTokenType("USDCUSD"),
  accountId: "0x0000000000000000000000000000000000000000000000000000000000000001",
  positionId: 1n,
  acceptablePrice: rawPrice(60000),
});
executeTrading(client, tx, {
  ticker: "BTCUSD",
  collateralType: client.getPoolTokenType("USDCUSD"),
  request: req,
});

tx.setSender("0x0000000000000000000000000000000000000000000000000000000000000abc");
const sim = await client.simulate(tx);
console.log(
  JSON.stringify(sim, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(0, 4000),
);
