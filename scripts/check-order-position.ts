/**
 * Read-only: list a wxa account's open orders + positions for a ticker.
 *   WATERX_ACCOUNT_ID=0x... WATERX_TICKER=BTCUSD pnpm exec tsx scripts/check-order-position.ts
 */
import { PerpClient } from "../src/perp/client.ts";
import { getAccountOrders, getAccountPositions } from "../src/perp/fetch.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

function j(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const client = await PerpClient.create("TESTNET", { cache: true });
  const accountId = process.env.WATERX_ACCOUNT_ID ?? process.env.WATERX_SMOKE_ACCOUNT_ID ?? "";
  const ticker = process.env.WATERX_TICKER ?? "BTCUSD";
  if (!accountId) throw new Error("set WATERX_ACCOUNT_ID");

  console.log(`account: ${accountId}`);
  console.log(`ticker:  ${ticker}\n`);

  const orders = await getAccountOrders(client, {
    ticker,
    accountObjectAddress: accountId,
  });
  console.log(`=== ORDERS (${orders.length}) ===`);
  console.log(j(orders));

  const positions = await getAccountPositions(client, {
    ticker,
    accountObjectAddress: accountId,
    basePriceUsd: 0n,
  });
  console.log(`\n=== POSITIONS (${positions.length}) ===`);
  console.log(j(positions));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
