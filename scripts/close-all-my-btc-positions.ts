/**
 * Close every open BTC perp position for the integration wallet's UserAccount.
 * Uses the same key / account resolution as `pnpm test:integration` (see `test/integration/setup.ts`).
 *
 * Usage:
 *   pnpm close-all-btc          # execute closes
 *   pnpm close-all-btc -- --dry-run   # only list what would be closed
 */
import { getAccountsByOwner } from "../src/index.ts";
import { buildClosePositionTx } from "../src/tx-builders.ts";
import { listAccountPositionsInMarket } from "../test/integration/helpers/list-account-positions.ts";
import {
  assertSuccess,
  client,
  execTx,
  loadIntegrationTraderKeypair,
  sleep,
} from "../test/integration/setup.ts";

function resolveAccountId(
  owner: string,
  accounts: Awaited<ReturnType<typeof getAccountsByOwner>>,
): string {
  const fromEnv = process.env.WATERX_INTEGRATION_ACCOUNT_ID?.trim();
  if (fromEnv) {
    if (!accounts.some((a) => a.accountId === fromEnv)) {
      throw new Error(`WATERX_INTEGRATION_ACCOUNT_ID=${fromEnv} is not listed for owner ${owner}.`);
    }
    return fromEnv;
  }
  if (!accounts.length) {
    throw new Error(
      `No WaterX UserAccount for ${owner}. Create one or set WATERX_INTEGRATION_ACCOUNT_ID.`,
    );
  }
  return accounts[0]!.accountId;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const signer = loadIntegrationTraderKeypair();
  const owner = signer.getPublicKey().toSuiAddress();
  const accounts = await getAccountsByOwner(client, owner);
  const accountId = resolveAccountId(owner, accounts);

  const rows = await listAccountPositionsInMarket(client, accountId, "BTC");
  console.log(`Account ${accountId} (owner ${owner}): ${rows.length} open BTC position(s).`);

  if (!rows.length) {
    console.log("Nothing to close.");
    return;
  }

  rows.sort((a, b) => a.positionId - b.positionId);
  for (const row of rows) {
    console.log(
      `  position_id=${row.positionId} size=${row.info.size} collateral=${row.info.collateralAmount} long=${row.info.isLong}`,
    );
  }

  if (dryRun) {
    console.log("\n--dry-run: no transactions sent.");
    return;
  }

  for (const row of rows) {
    await sleep(600);
    const tx = await buildClosePositionTx(client, {
      accountId,
      base: "BTC",
      positionId: row.positionId,
      acceptablePrice: 0n,
    });
    const result = await execTx(tx, signer, { gasBudget: 200_000_000 });
    assertSuccess(result);
    console.log(`Closed position_id=${row.positionId} digest=${result.digest}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
