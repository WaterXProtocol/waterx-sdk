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
 * `buildConsolidateToUsdTx` does the per-asset funds + receivings scan and
 * appends one drain leg per non-empty bucket. The same sweep runs implicitly
 * before every accountId-bearing tx-builder (`consolidateToUsd: true` by
 * default on `CommonBuildOpts`), so this script is mostly useful for ad-hoc
 * cleanup or to surface what's actually parked.
 *
 *   WATERX_ACCOUNT_ID=0x... \
 *     pnpm exec tsx examples/actions/action-consolidate-to-usd.ts
 *   # add WATERX_EXECUTE=1 to sign and send.
 */
import {
  buildClient,
  loadActiveKeypair,
  requireEnv,
  run,
  simThenMaybeExecute,
} from "../_shared.ts";
import { buildConsolidateToUsdTx } from "../../src/index.ts";

run(async () => {
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();
  const accountId = requireEnv("WATERX_ACCOUNT_ID");

  const tx = await buildConsolidateToUsdTx(client, { accountId });

  const legs = tx.getData().commands?.length ?? 0;
  if (legs === 0) {
    console.log("  nothing to consolidate — no funds or coins parked at the account address");
    return;
  }
  // Each drain leg adds 3 commands (request_deposit_from_* + mint_from_request + consume_direct).
  console.log(`  consolidating across ${Math.floor(legs / 3)} drain leg(s) into USD`);
  await simThenMaybeExecute(client, tx, "consolidateToUsd", keypair);
});
