/**
 * Consolidate ("歸集") all backing assets (USDC, USDSUI, …) parked at a wxa
 * account's address into the protocol's USD credit, *inside* that account.
 *
 * A wxa `accountId` doubles as an on-chain address (`account_id.to_address()`),
 * so anyone can fund it two ways:
 *
 *   1. **Transfer-to-object (TTO'd Coins)** — a raw `Coin<T>` published onto
 *      the account address. Drained via `requestDepositFromReceivings<T>`
 *      (needs each coin's `Receiving<Coin<T>>` ref).
 *   2. **Funds accumulator** — `transfer_coin` / `0x2::balance::send_funds<T>`
 *      lands a `Balance<T>` at the address. Drained in one shot via
 *      `requestDepositFromFunds<T>` (needs only the `0xacc` accumulator root).
 *
 * Both yield a `DepositRequest<T>`, which `native_custody` mints 1:1 into a
 * `DepositRequest<USD>` (`mintCreditFromRequest`), settled straight into the
 * account by `direct_rule::consume_deposit_direct<USD>`. Net effect: scattered
 * USDC / USDSUI → a single USD balance under the account.
 *
 * Per backing asset registered on the custody vault, this example adds a
 * funds-drain leg when the accumulator holds a balance and a receivings-drain
 * leg when TTO'd coins sit at the account address — all in one PTB. (`mint`
 * rejects zero-amount deposits, so empty legs are skipped.)
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/actions/action-consolidate-to-usd.ts
 *   # add WATERX_EXECUTE=1 to sign and send.
 */
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import type { WaterXClient } from "../../src/client.ts";
import { getConsolidatableBalances } from "../../src/fetch.ts";
import { consumeDepositDirect } from "../../src/generated/waterx_account/direct_rule.ts";
import {
  mintCreditFromRequest,
  requestDepositFromFunds,
  requestDepositFromReceivings,
} from "../../src/index.ts";

/** Fold a `DepositRequest<T>` into USD credit settled inside the account. */
function foldRequestToUsd(
  client: WaterXClient,
  tx: Transaction,
  depositRequest: TransactionArgument,
  assetType: string,
  usdType: string,
): void {
  const usdReq = mintCreditFromRequest(client, tx, {
    depositRequest,
    assetType,
    creditType: usdType,
  });
  consumeDepositDirect({
    package: client.config.packages.waterx_account.published_at,
    arguments: {
      registry: tx.object(client.config.packages.waterx_account.account_registry),
      req: usdReq as unknown as string,
    },
    typeArguments: [usdType],
  })(tx);
}

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");
  const usdType = client.creditType();

  // One gRPC sweep over every backing asset: parked funds + TTO'd coin refs.
  const rows = await getConsolidatableBalances(client, accountId);
  if (rows.length === 0) throw new Error("no native-custody backing assets configured");

  const tx = new Transaction();
  let legs = 0;

  for (const row of rows) {
    const tags: string[] = [];

    // --- Funds-accumulator leg (transfer_coin / send_funds path). ---
    // `mint` rejects a zero-amount deposit, so only add this leg when the
    // accumulator actually holds something.
    if (row.fundsBalance > 0n) {
      const fromFunds = requestDepositFromFunds(client, tx, {
        accountId,
        coinType: row.assetType,
      });
      foldRequestToUsd(client, tx, fromFunds, row.assetType, usdType);
      legs += 1;
      tags.push(`funds ${row.fundsBalance}`);
    }

    // --- Receivings leg (TTO'd Coin<T> path). ---
    // Only add when raw coins were published onto the account address.
    if (row.ttoCoins.length > 0) {
      const receivings = row.ttoCoins.map((c) =>
        tx.receivingRef(c),
      ) as unknown as TransactionArgument[];
      const fromReceivings = requestDepositFromReceivings(client, tx, {
        accountId,
        coinType: row.assetType,
        receivings,
      });
      foldRequestToUsd(client, tx, fromReceivings, row.assetType, usdType);
      legs += 1;
      tags.push(`${row.ttoCoins.length} TTO'd coin(s)`);
    }

    console.log(
      `  • ${row.assetType}: ${tags.length ? tags.join(" + ") + " → USD" : "nothing parked"}`,
    );
  }

  if (legs === 0) {
    console.log("  nothing to consolidate — no funds or coins parked at the account address");
    return;
  }
  console.log(`  consolidating across ${legs} drain leg(s) into USD`);
  await simThenMaybeExecute(client, tx, "consolidateToUsd", keypair);
});
