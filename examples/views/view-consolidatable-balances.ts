/**
 * Show the **consolidatable** ("可歸集") balances parked at a wxa account's
 * address — i.e. funds that `action-consolidate-to-usd.ts` would fold into USD.
 *
 * Thin wrapper over `getConsolidatableBalances()` (`fetch.ts`), which reads both
 * funding paths per `client.getNativeAssets()` asset:
 *
 *   1. **Funds accumulator** — `transfer_coin` / `balance::send_funds<T>` lands a
 *      `Balance<T>` at the address. Drained via `requestDepositFromFunds<T>`.
 *   2. **TTO'd Coins** — raw `Coin<T>` objects transferred onto the address.
 *      Drained via `requestDepositFromReceivings<T>`.
 *
 * Distinct from `getAccountBalance(accountId)`, which reads the account's
 * *internal* bridged `Balance<T>` — already consolidated, withdrawable credit.
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/views/view-consolidatable-balances.ts
 */
import { buildClient, requireEnv, run } from "../_shared.ts";
import { getConsolidatableBalances } from "../../src/fetch.ts";

run(async () => {
  const client = await buildClient();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");

  const rows = await getConsolidatableBalances(client, accountId);
  if (rows.length === 0) throw new Error("no native-custody backing assets configured");

  console.log(`  consolidatable balances at ${accountId}\n`);

  let anything = false;
  for (const r of rows) {
    if (r.total === 0n) {
      console.log(`  • ${r.assetType}: nothing parked`);
      continue;
    }
    anything = true;
    console.log(
      `  • ${r.assetType}` +
        `\n      funds (send_funds):  ${r.fundsBalance} → requestDepositFromFunds` +
        `\n      TTO'd coins (${r.ttoCoins.length}):     ${r.ttoBalance} → requestDepositFromReceivings` +
        `\n      total consolidatable: ${r.total} (raw, 1e${r.decimal})`,
    );
  }

  if (!anything) {
    console.log("\n  nothing to consolidate — no funds or coins parked at the account address");
  }
});
