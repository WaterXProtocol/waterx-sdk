/**
 * Merge all coins of a given type owned by the sender into one coin.
 *
 * Pages through `client.core.listCoins` until either every coin is fetched or
 * `MAX` is hit (default 1000 — safe ceiling for one PTB). Builds a PTB that
 * calls `mergeCoins(primary, [...sources])`. Does not sign — outputs unsigned
 * tx bytes (base64) on stdout for CLI signing, matching the create-markets
 * flow.
 *
 * For `0x2::sui::SUI`, the primary coin is also pinned as gas payment so the
 * runtime cannot pick a coin we are merging from.
 *
 * Env:
 *   COIN_TYPE   required, e.g. `0x2::sui::SUI` or `0x…::usdc::USDC`
 *   SUI_SENDER  override sender (defaults to `sui client active-address`)
 *   MAX         max coins to merge (default 1000, min 2)
 *
 * Usage:
 *   COIN_TYPE=0x2::sui::SUI npx tsx scripts/merge-coins.ts > merge.b64
 */

import { execSync } from "node:child_process";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";

const SUI_TYPE = "0x2::sui::SUI";
const PAGE_LIMIT = 50;

interface CoinRef {
  objectId: string;
  version: string;
  digest: string;
  balance: string;
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

async function fetchCoins(
  client: SuiGrpcClient,
  owner: string,
  coinType: string,
  max: number,
): Promise<CoinRef[]> {
  const out: CoinRef[] = [];
  let cursor: string | null | undefined = undefined;
  while (out.length < max) {
    const remaining = max - out.length;
    const page = await client.core.listCoins({
      owner,
      coinType,
      cursor,
      limit: Math.min(PAGE_LIMIT, remaining),
    });
    for (const c of page.objects) {
      out.push({
        objectId: c.objectId,
        version: String(c.version),
        digest: c.digest,
        balance: c.balance,
      });
      if (out.length >= max) break;
    }
    if (!page.hasNextPage || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

async function main() {
  const coinType =
    process.env.COIN_TYPE ??
    "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI";
  if (!coinType) throw new Error("COIN_TYPE is required (e.g. 0x2::sui::SUI)");

  const max = Number(process.env.MAX ?? 500);
  if (!Number.isInteger(max) || max < 2) throw new Error("MAX must be an integer ≥ 2");

  const sender = resolveSender();
  const client = new SuiGrpcClient({
    baseUrl: "https://fullnode.mainnet.sui.io:443",
    network: "mainnet",
  });

  console.error(`# Sender:    ${sender}`);
  console.error(`# Coin type: ${coinType}`);
  console.error(`# Max coins: ${max}`);

  const coins = await fetchCoins(client, sender, coinType, max);
  console.error(`# Fetched:   ${coins.length} coins`);

  if (coins.length < 2) {
    console.error(`Nothing to merge — only ${coins.length} coin(s) of this type.`);
    return;
  }

  const total = coins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
  console.error(`# Total bal: ${total.toString()}`);

  const tx = new Transaction();
  tx.setSender(sender);
  tx.setGasBudget(500_000_000);

  if (coinType === SUI_TYPE) {
    // Pin the first coin as gas, merge the rest into tx.gas (== first coin).
    // Prevents the gas resolver from picking one of our merge sources.
    const [primary, ...rest] = coins;
    tx.setGasPayment([
      { objectId: primary.objectId, version: primary.version, digest: primary.digest },
    ]);
    if (rest.length > 0) {
      tx.mergeCoins(
        tx.gas,
        rest.map((c) => tx.object(c.objectId)),
      );
    }
  } else {
    const [primary, ...rest] = coins;
    tx.mergeCoins(
      tx.object(primary.objectId),
      rest.map((c) => tx.object(c.objectId)),
    );
  }

  const bytes = await tx.build({ client });
  const base64 = Buffer.from(bytes).toString("base64");

  console.error(`# Bytes:     ${bytes.length}`);
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
