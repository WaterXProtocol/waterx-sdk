/**
 * Create the 200K-tier batch markets for the WaterX Perp protocol (v2):
 *   HYPE, XRP, BNB, ZEC, MSTRX, COINX, HOODX, CRCLX, NFLXX,
 *   XAUT, XAG, WTI, BRENT, EURUSD, USDJPY.
 *
 * For each market, the PTB performs:
 *   1. aggregator::new<BASE>                                 → PriceAggregator<BASE>
 *   2. aggregator::set_rule_weight<BASE, PythRule>(weight=1)
 *   3. transfer::public_share_object(aggregator)
 *   4. pyth_rule::set_identifier<BASE>(feed_bytes)
 *   5. trading::create_market<BASE, WLP>(..params, clock)    → Market<BASE, WLP>
 *   6. transfer::public_share_object(market)
 *
 * All 15 markets are bundled into ONE PTB (atomic — either every market is
 * created or none are). Params come from `MARKETS_200K_DEFINITIONS`
 * (`scripts/market-params.ts`, sourced from `scripts/markets-200k-0.csv`).
 *
 * Base-token witness types live in a NEW `market_symbol` package
 * (`MARKET_SYMBOL_PKG` below). Most witnesses are `<SYM>_USD` (e.g. `HYPE_USD`);
 * the FX pairs split (`EUR_USD`, `USD_JPY`) — see `SYMBOL_TO_TYPE_NAME`.
 *
 * Requires AdminCap (waterx_perp) + ListingCap (bucket_v2_oracle) on the
 * sender. Sender is read from `sui client active-address` (override with
 * `SUI_SENDER=0x…`); the script does NOT sign — it only builds the PTBs and
 * prints unsigned tx bytes (base64) so they can be signed via the Sui CLI:
 *
 *   sui keytool sign --address <sender> --data <bytes>
 *   sui client execute-signed-tx --tx-bytes <bytes> --signatures <sig>
 *
 * Usage: npx tsx scripts/create-markets.ts
 *        npx tsx scripts/create-markets.ts > markets.b64
 */

import { execSync } from "node:child_process";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";

import { MAINNET_OBJECTS, MAINNET_PACKAGE_IDS, MAINNET_TYPES } from "../src/constants.ts";
import {
  MARKETS_200K_DEFINITIONS,
  type BatchMarketEntry,
  type MarketParams,
} from "./market-params.ts";

const ADMIN_CAP = MAINNET_OBJECTS.ADMIN_CAP;
const LISTING_CAP = MAINNET_OBJECTS.ORACLE_LISTING_CAP;
const PYTH_RULE_CONFIG = MAINNET_OBJECTS.PYTH_RULE_CONFIG;

const PERP_PKG = MAINNET_PACKAGE_IDS.WATERX_PERP;
const ORACLE_PKG = MAINNET_PACKAGE_IDS.BUCKET_ORACLE;
const PYTH_RULE_PKG = MAINNET_PACKAGE_IDS.PYTH_RULE;
// PythRule witness lives in the pyth_rule pkg's original-id (v1 — original-id
// == published-at on mainnet, same as testnet).
const PYTH_WITNESS = `${PYTH_RULE_PKG}::pyth_rule::PythRule`;

const WLP_TYPE = MAINNET_TYPES.WLP;

/** market_symbol package for the 200K-tier batch. */
const MARKET_SYMBOL_PKG = "0xe006e86055ba0bb937793f372d03d0815c7ee0683fc88d5790d069c7dbee7d61";

/**
 * CSV symbol → on-chain `market_symbol::<NAME>` witness name.
 * Most are `<SYM>_USD`; FX pairs are split (EUR_USD, USD_JPY).
 */
const SYMBOL_TO_TYPE_NAME: Record<string, string> = {
  HYPE: "HYPE_USD",
  XRP: "XRP_USD",
  BNB: "BNB_USD",
  ZEC: "ZEC_USD",
  MSTRX: "MSTRX_USD",
  COINX: "COINX_USD",
  HOODX: "HOODX_USD",
  CRCLX: "CRCLX_USD",
  NFLXX: "NFLXX_USD",
  XAUT: "XAUT_USD",
  XAG: "XAG_USD",
  WTI: "WTI_USD",
  BRENT: "BRENT_USD",
  EURUSD: "EUR_USD",
  USDJPY: "USD_JPY",
};

/** Pyth feed IDs (32-byte hex) for the 200K-tier batch. */
const PYTH_FEED_IDS: Record<string, string> = {
  HYPE: "0x4279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b",
  XRP: "0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8",
  BNB: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f",
  ZEC: "0xbe9b59d178f0d6a97ab4c343bff2aa69caa1eaae3e9048a65788c529b125bb24",
  XAUT: "0x44465e17d2e9d390e70c999d5a11fda4f092847fcd2e3e5aa089d96c98a30e67",
  XAG: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  EURUSD: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  USDJPY: "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
  MSTRX: "0x53f95ba4e23ed15ea56083e2ee9a5eec48055d6f59033d4bb95f1ca2a2349c28",
  COINX: "0x641435d5dffb5311140b480517c79986d8488d5cf08a11eec53b83ad02cab33f",
  HOODX: "0xdd49a9ac6df5cbfa9d8fc6371f7ae927a74d5c6763c1c01b4220d70314c647f9",
  CRCLX: "0xc13184461c0c80d98ffcd89be627c2220b94a96c7c67f0c4b16bc12fd3b17758",
  NFLXX: "0x02a67e6184e6c9dd65e14745a2a80df8b2b3d2ca91b4b191404936003d9929ae",
  WTI: "0x925ca92ff005ae943c158e3563f59698ce7e75c5a8c8dd43303a0a154887b3e6",
  BRENT: "0x27f0d5e09a830083e5491795cac9ca521399c8f7fd56240d09484b14e614d57a",
};

// Aggregator config — Pyth-only, weight 1 meets threshold 1.
const WEIGHT_THRESHOLD = 1n;
const OUTLIER_TOLERANCE_BPS = 2000n; // 20% — only relevant once >1 source is added
const PYTH_WEIGHT = 1;

function baseTypeOf(symbol: string): string {
  const name = SYMBOL_TO_TYPE_NAME[symbol];
  if (!name) throw new Error(`No market_symbol witness mapped for ${symbol}`);
  return `${MARKET_SYMBOL_PKG}::market_symbol::${name}`;
}

function feedBytes(hex: string): number[] {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (stripped.length !== 64) throw new Error(`Pyth feed ID must be 32 bytes: ${hex}`);
  const out: number[] = [];
  for (let i = 0; i < stripped.length; i += 2) out.push(parseInt(stripped.slice(i, i + 2), 16));
  return out;
}

function addOracleSetupAndCreateMarket(tx: Transaction, entry: BatchMarketEntry) {
  const { symbol, params } = entry;
  const baseType = baseTypeOf(symbol);
  const feedHex = PYTH_FEED_IDS[symbol];
  if (!feedHex) throw new Error(`No Pyth feed ID for ${symbol}`);

  const aggType = `${ORACLE_PKG}::aggregator::PriceAggregator<${baseType}>`;
  const marketType = `${PERP_PKG}::trading::Market<${baseType}, ${WLP_TYPE}>`;

  // 1. aggregator::new<BASE>(listing_cap, weight_threshold, outlier_tolerance_bps)
  const [agg] = tx.moveCall({
    target: `${ORACLE_PKG}::aggregator::new`,
    typeArguments: [baseType],
    arguments: [
      tx.object(LISTING_CAP),
      tx.pure.u64(WEIGHT_THRESHOLD),
      tx.pure.u64(OUTLIER_TOLERANCE_BPS),
    ],
  });

  // 2. aggregator::set_rule_weight<BASE, PythRule>(agg, listing_cap, 1u8)
  tx.moveCall({
    target: `${ORACLE_PKG}::aggregator::set_rule_weight`,
    typeArguments: [baseType, PYTH_WITNESS],
    arguments: [agg, tx.object(LISTING_CAP), tx.pure.u8(PYTH_WEIGHT)],
  });

  // 3. share aggregator
  tx.moveCall({
    target: `0x2::transfer::public_share_object`,
    typeArguments: [aggType],
    arguments: [agg],
  });

  // 4. pyth_rule::set_identifier<BASE>(config, listing_cap, feed_bytes)
  tx.moveCall({
    target: `${PYTH_RULE_PKG}::pyth_rule::set_identifier`,
    typeArguments: [baseType],
    arguments: [
      tx.object(PYTH_RULE_CONFIG),
      tx.object(LISTING_CAP),
      tx.pure.vector("u8", feedBytes(feedHex)),
    ],
  });

  // 5. trading::create_market<BASE, WLP>(...)
  // v2 sig: create_market(cap, max_leverage_bps, min_coll_value, trading_fee_bps,
  //   maintenance_margin_bps, max_long_oi: u128, max_short_oi: u128,
  //   cooldown_ms, basic_funding_rate_bps, funding_interval_ms, clock, ctx)
  const p: MarketParams = params;
  const [market] = tx.moveCall({
    target: `${PERP_PKG}::trading::create_market`,
    typeArguments: [baseType, WLP_TYPE],
    arguments: [
      tx.object(ADMIN_CAP),
      tx.pure.u64(p.maxLeverageBps),
      tx.pure.u64(p.minCollValue),
      tx.pure.u64(p.tradingFeeBps),
      tx.pure.u64(p.maintenanceMarginBps),
      tx.pure.u128(p.maxLongOi),
      tx.pure.u128(p.maxShortOi),
      tx.pure.u64(p.cooldownMs),
      tx.pure.u64(p.basicFundingRateBps),
      tx.pure.u64(p.fundingIntervalMs),
      tx.object("0x6"),
    ],
  });

  // 6. share market
  tx.moveCall({
    target: `0x2::transfer::public_share_object`,
    typeArguments: [marketType],
    arguments: [market],
  });
}

function resolveSender(): string {
  const fromEnv = process.env.SUI_SENDER?.trim();
  if (fromEnv) return fromEnv;
  try {
    return execSync("sui client active-address", { encoding: "utf8" }).trim();
  } catch (e) {
    throw new Error(
      `Could not resolve sender. Set SUI_SENDER=0x… or ensure 'sui client active-address' works. (${
        e instanceof Error ? e.message : String(e)
      })`,
    );
  }
}

async function main() {
  const sender = resolveSender();
  const client = new SuiGrpcClient({
    baseUrl: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet",
  });

  const tx = new Transaction();
  tx.setSender(sender);
  // ~0.5 SUI/market * 15 markets, with headroom for shared-object resolution.
  tx.setGasBudget(1_000_000_000);

  for (const entry of MARKETS_200K_DEFINITIONS) {
    addOracleSetupAndCreateMarket(tx, entry);
  }

  const bytes = await tx.build({ client });
  const base64 = Buffer.from(bytes).toString("base64");

  // Header to stderr so stdout is just the base64 (suitable for `… > markets.b64`).
  console.error(`# Sender:  ${sender}`);
  console.error(`# Network: mainnet`);
  console.error(`# Markets: ${MARKETS_200K_DEFINITIONS.length} bundled into one PTB (atomic)`);
  console.error(`# Bytes:   ${bytes.length}`);
  console.error(``);

  console.log(base64);

  console.error(``);
  console.error(`Sign + execute via:`);
  console.error(`  sui keytool sign --address ${sender} --data <base64>`);
  console.error(`  sui client execute-signed-tx --tx-bytes <base64> --signatures <sig>`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
