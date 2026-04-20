/**
 * Dump SDK query / simulate return values to ./query-output/ (and print paths).
 *
 * Usage:
 *   pnpm query-output
 *   pnpm query-output -- --help
 *   pnpm query-output -- position BTC 3
 *   pnpm query-output -- accounts 0x<owner_sui_address>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BaseAsset } from "../src/constants.ts";
import {
  getAccountBalance,
  getAccountCoins,
  getAccountDelegates,
  getAccountObjectId,
  getAccountsByOwner,
  getMarketCooldownMs,
  getMarketSummary,
  getPoolSummary,
  getPosition,
  getTokenPoolSummary,
  positionExists,
  selectCoinsForAmount,
  TESTNET_COLLATERALS,
  TESTNET_MARKETS,
  TESTNET_OBJECTS,
  WaterXClient,
} from "../src/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../query-output");

const client = WaterXClient.testnet();

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

function write(name: string, data: unknown) {
  const file = path.join(OUT_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(data, replacer, 2) + "\n", "utf8");
  console.log(file);
}

function parseArgv(): string[] {
  const a = process.argv.slice(2);
  return a[0] === "--" ? a.slice(1) : a;
}

function printHelp() {
  console.log(`query-output — write JSON snapshots under ${OUT_DIR}/

Commands:
  (no args)           Default bundle (markets, pool, sample position btc-0, admin accounts)
  --help, -h          This message
  position <BASE> <n>  positionExists + getPosition for testnet market (e.g. BTC 3)
  accounts <address>  getAccountsByOwner (WaterX UserAccount rows for owner)

Examples:
  pnpm query-output -- position BTC 0
  pnpm query-output -- accounts 0x...\n`);
}

function isBaseAsset(s: string): s is BaseAsset {
  return Object.prototype.hasOwnProperty.call(TESTNET_MARKETS, s);
}

async function runPositionDump(baseKey: string, positionIdStr: string) {
  const upper = baseKey.toUpperCase();
  if (!isBaseAsset(upper)) {
    throw new Error(
      `Unknown base "${baseKey}". Use one of: ${Object.keys(TESTNET_MARKETS).join(", ")}`,
    );
  }
  const entry = TESTNET_MARKETS[upper];
  const pid = BigInt(positionIdStr);
  const exists = await positionExists(client, entry.marketId, pid, entry.baseType);
  write(`positionExists-${upper.toLowerCase()}-${positionIdStr}`, { exists });
  if (exists) {
    write(
      `getPosition-${upper.toLowerCase()}-${positionIdStr}`,
      await getPosition(client, entry.marketId, pid, entry.baseType),
    );
  }
}

async function runAccountsDump(owner: string) {
  const rows = await getAccountsByOwner(client, owner);
  const tag = owner.replace(/^0x/i, "").slice(0, 16);
  write(`getAccountsByOwner-${tag}`, rows);
}

async function runDefaultQueries() {
  for (const [base, market] of Object.entries(TESTNET_MARKETS)) {
    const key = base.toLowerCase();
    write(
      `getMarketSummary-${key}`,
      await getMarketSummary(client, market.marketId, market.baseType),
    );
    write(`getMarketCooldownMs-${key}`, await getMarketCooldownMs(client, market.marketId));
  }
  const pool = await getPoolSummary(client);
  write("getWlpTotalSupply", { supply: pool.totalLpSupply.toString() });
  write("getWlpTvlUsd", { tvlUsd: pool.tvlUsd.toString() });
  write("getPoolSummary", pool);
  write("getTokenPoolSummary-0", await getTokenPoolSummary(client, 0));

  const adminAccounts = await getAccountsByOwner(client, TESTNET_OBJECTS.ADMIN_CAP);
  write("getAccountsByOwner-admin", adminAccounts);
  if (adminAccounts.length > 0) {
    const accountId = adminAccounts[0]!.accountId;
    const owner = adminAccounts[0]!.ownerAddress;
    const usdcType = TESTNET_COLLATERALS.USDC.type;
    write("getAccountObjectId-admin-0", await getAccountObjectId(client, owner, accountId));
    write("getAccountDelegates-admin-0", await getAccountDelegates(client, owner, accountId));
    write("getAccountCoins-admin-0-usdc", await getAccountCoins(client, accountId, usdcType));
    write("getAccountBalance-admin-0-usdc", {
      balance: (await getAccountBalance(client, accountId, usdcType)).toString(),
    });
    write(
      "selectCoinsForAmount-admin-0-usdc-0",
      await selectCoinsForAmount(client, accountId, usdcType, 0n),
    );
  }

  const exists0 = await positionExists(
    client,
    TESTNET_MARKETS.BTC.marketId,
    0n,
    TESTNET_MARKETS.BTC.baseType,
  );
  write("positionExists-btc-0", { exists: exists0 });
  if (exists0) {
    write(
      "getPosition-btc-0",
      await getPosition(client, TESTNET_MARKETS.BTC.marketId, 0n, TESTNET_MARKETS.BTC.baseType),
    );
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const argv = parseArgv();

  if (argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }

  if (argv[0] === "position") {
    const base = argv[1];
    const id = argv[2];
    if (!base || id === undefined) {
      printHelp();
      process.exitCode = 1;
      return;
    }
    await runPositionDump(base, id);
    console.log(`\nWrote JSON under ${OUT_DIR}/`);
    return;
  }

  if (argv[0] === "accounts") {
    const owner = argv[1];
    if (!owner) {
      printHelp();
      process.exitCode = 1;
      return;
    }
    await runAccountsDump(owner);
    console.log(`\nWrote JSON under ${OUT_DIR}/`);
    return;
  }

  if (argv.length > 0) {
    console.error(`Unknown arguments: ${argv.join(" ")}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  await runDefaultQueries();
  console.log(`\nWrote JSON under ${OUT_DIR}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
