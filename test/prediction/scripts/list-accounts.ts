/**
 * CLI helper: list registry account ids for a wallet (uses SDK `getAccountIds`).
 *
 * Usage:
 *   pnpm list-accounts -- 0xYourAddress
 */
import { getAccountData, getAccountIds, PredictClient } from "~predict/index.ts";

/** First wallet arg; skips `pnpm` separator `--` in argv. */
function ownerFromArgv(argv: string[]): string | undefined {
  return argv.slice(2).find((arg) => arg !== "--" && arg.startsWith("0x"));
}

async function main(): Promise<void> {
  const owner = ownerFromArgv(process.argv);
  if (!owner) {
    console.error("Usage: pnpm list-accounts -- 0xOwnerAddress");
    process.exit(1);
  }

  // `loadConfig` no longer reads env — source the URL at this script boundary.
  const client = await PredictClient.testnet({
    waterxConfigUrl: process.env.E2E_CONFIG_URL ?? process.env.WATERX_CONFIG_URL,
  });
  const ids = await getAccountIds(client, { owner });

  if (ids.length === 0) {
    console.log("No accounts found for", owner);
    return;
  }

  console.log("owner:", owner);
  console.log(`Found ${ids.length} account(s):\n`);

  for (let i = 0; i < ids.length; i++) {
    const registryAccountId = ids[i]!;
    console.log(`--- #${i}`);
    console.log("registryAccountId:", registryAccountId);
    try {
      const data = await getAccountData(client, { accountId: registryAccountId });
      console.log("hasData:", data.hasData);
      console.log("orderCount:", data.orderCount.toString());
      console.log("positionCount:", data.positionCount.toString());
    } catch (err) {
      console.log("error:", err instanceof Error ? err.message : String(err));
    }
    console.log("");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
