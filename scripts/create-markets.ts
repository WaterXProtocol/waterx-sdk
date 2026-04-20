/**
 * Create all markets for the WaterX Perp protocol (v2).
 * Requires AdminCap + ListingCap on the deployer.
 *
 * NOTE: For a full setup (PriceAggregator + PythRule weight + Pyth identifier
 *       + Market), prefer `scripts/setup-markets.sh`, which does everything in
 *       one PTB per market. This script only creates markets and assumes
 *       aggregators & Pyth identifiers already exist.
 *
 * Usage: ADMIN_SECRET_KEY=<base64> npx tsx scripts/create-markets.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import {
  TESTNET_OBJECTS,
  TESTNET_PACKAGE_IDS,
  TESTNET_TYPES,
  type BaseAsset,
} from "../src/constants.ts";
import { MARKET_DEFINITIONS, type MarketParams } from "./market-params.ts";

const ADMIN_CAP = TESTNET_OBJECTS.ADMIN_CAP;
const PKG = TESTNET_PACKAGE_IDS.WATERX_PERP;
const WLP_TYPE = TESTNET_TYPES.WLP;

const BASE_TYPES: Record<BaseAsset, string> = {
  BTC: TESTNET_TYPES.BTC_USD,
  ETH: TESTNET_TYPES.ETH_USD,
  SOL: TESTNET_TYPES.SOL_USD,
  SUI: TESTNET_TYPES.SUI_USD,
  DEEP: TESTNET_TYPES.DEEP_USD,
  WAL: TESTNET_TYPES.WAL_USD,
  AAPLX: TESTNET_TYPES.AAPLX_USD,
  GOOGLX: TESTNET_TYPES.GOOGLX_USD,
  METAX: TESTNET_TYPES.METAX_USD,
  NVDAX: TESTNET_TYPES.NVDAX_USD,
  QQQX: TESTNET_TYPES.QQQX_USD,
  SPYX: TESTNET_TYPES.SPYX_USD,
  TSLAX: TESTNET_TYPES.TSLAX_USD,
};

function addCreateMarket(tx: Transaction, baseType: string, params: MarketParams) {
  // v2 signature: create_market<BASE, LP>(
  //   cap, max_leverage_bps, min_coll_value, trading_fee_bps, maintenance_margin_bps,
  //   max_long_oi: u128, max_short_oi: u128, cooldown_ms, basic_funding_rate_bps,
  //   funding_interval_ms, clock, ctx
  // ): Market<BASE, LP>
  const [market] = tx.moveCall({
    target: `${PKG}::trading::create_market`,
    typeArguments: [baseType, WLP_TYPE],
    arguments: [
      tx.object(ADMIN_CAP),
      tx.pure.u64(params.maxLeverageBps),
      tx.pure.u64(params.minCollValue),
      tx.pure.u64(params.tradingFeeBps),
      tx.pure.u64(params.maintenanceMarginBps),
      tx.pure.u128(params.maxLongOi),
      tx.pure.u128(params.maxShortOi),
      tx.pure.u64(params.cooldownMs),
      tx.pure.u64(params.basicFundingRateBps),
      tx.pure.u64(params.fundingIntervalMs),
      tx.object("0x6"),
    ],
  });
  tx.moveCall({
    target: `0x2::transfer::public_share_object`,
    typeArguments: [`${PKG}::trading::Market<${baseType}, ${WLP_TYPE}>`],
    arguments: [market],
  });
  return market;
}

async function main() {
  const secretKey = process.env.ADMIN_SECRET_KEY;
  if (!secretKey) {
    console.log("Usage: ADMIN_SECRET_KEY=<base64> npx tsx scripts/create-markets.ts");
    console.log("\nDry run — building transaction for all markets:\n");

    const tx = new Transaction();
    for (const [asset, params] of Object.entries(MARKET_DEFINITIONS)) {
      const baseType = BASE_TYPES[asset as BaseAsset];
      if (!baseType) continue;
      addCreateMarket(tx, baseType, params);
      console.log(`  + ${asset} market (${params.maxLeverageBps / 10000}x max leverage)`);
    }
    console.log(`\n${Object.keys(MARKET_DEFINITIONS).length} markets in transaction.`);
    console.log("Set ADMIN_SECRET_KEY to execute.");
    return;
  }

  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const client = WaterXClient.testnet();

  const tx = new Transaction();
  tx.setGasBudget(500_000_000);

  for (const [asset, params] of Object.entries(MARKET_DEFINITIONS)) {
    const baseType = BASE_TYPES[asset as BaseAsset];
    if (!baseType) continue;
    addCreateMarket(tx, baseType, params);
    console.log(`+ Creating ${asset} market`);
  }

  console.log("\nExecuting...");
  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  });
  const digest =
    result.$kind === "Transaction" ? result.Transaction.digest : result.FailedTransaction!.digest;
  console.log("Digest:", digest);
  console.log("\nShare the created Market objects and update TESTNET_MARKETS in constants.ts.");
}

main().catch(console.error);
