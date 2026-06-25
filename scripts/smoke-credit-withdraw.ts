/**
 * requestCreditWithdraw smoke against testnet.
 *
 * Builds the user-side credit-withdraw PTB via buildRequestCreditWithdrawTx:
 *   route_native<T>  →  account::request_withdraw<USD>  →  withdrawal_queue::enqueue<USD>
 * then SIMULATES it (default). Opt into real execution with
 * WATERX_CREDIT_WITHDRAW_EXECUTE=1.
 *
 * The signer is the active sui CLI address; it must own (or be a PERM_WITHDRAW
 * delegate of) the wxa account, and the account must hold enough USD.
 *
 * Run:
 *   pnpm exec tsx scripts/smoke-credit-withdraw.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/smoke-credit-withdraw.ts
 */
import type { Transaction } from "@mysten/sui/transactions";

import { PerpClient } from "../src/perp/client.ts";
import { buildRequestCreditWithdrawTx } from "../src/perp/tx-builders.ts";
import { loadActiveKeypair, resolveActiveAddress } from "./load-signer.ts";

/** Default wxa account (deployer's) if WATERX_SMOKE_ACCOUNT_ID is unset. */
const DEFAULT_ACCOUNT = "0x9d017d08000a6cfa4eae6366dafe44ffd197480ef01a3707a4057bd7f697b67b";
/** 1 USD @ 6dp. */
const WITHDRAW_AMOUNT = 1_000_000n;

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
}

async function main(): Promise<void> {
  const address = resolveActiveAddress();
  const client = await PerpClient.create("TESTNET", { cache: true });
  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID ?? DEFAULT_ACCOUNT;
  const execute = process.env.EXECUTE === "1";
  const usd = `${(client.config.packages as any).usd.published_at}::usd::USD`;
  // Native payout asset = MOCK_USDC (a registered, non-deprecated backing asset).
  const assetType =
    client.getNativeAssets().find((a) => /::mock_usdc::/i.test(a.type))?.type ??
    client.getNativeAssets()[0]!.type;

  console.log(`Sender:     ${address}`);
  console.log(`AccountId:  ${accountId}`);
  console.log(`CREDIT:     ${usd}`);
  console.log(`Amount:     ${WITHDRAW_AMOUNT} (1 USD)`);
  console.log(`Route:      native -> ${assetType}`);
  console.log(`Mode:       ${execute ? "EXECUTE" : "SIM only"}\n`);

  const tx: Transaction = buildRequestCreditWithdrawTx(client, {
    accountId,
    amount: WITHDRAW_AMOUNT,
    recipient: address,
    route: { kind: "native", assetType },
  });
  tx.setSender(address);

  console.log("=== requestCreditWithdraw + enqueue ===");
  if (!execute) {
    let r: SimResult;
    try {
      r = (await client.simulate(tx)) as unknown as SimResult;
    } catch (e) {
      console.log(`  \x1b[31m✗\x1b[0m sdk error: ${String(e).slice(0, 240)}`);
      process.exit(1);
    }
    if (r.$kind === "FailedTransaction") {
      const msg = r.FailedTransaction?.status?.error?.message?.slice(0, 240) ?? "(no msg)";
      console.log(`  \x1b[33m●\x1b[0m aborted on-chain: ${msg}`);
    } else {
      console.log(`  \x1b[32m✓\x1b[0m sim ok`);
    }
  } else {
    const r = (await client.signAndExecuteTransaction({
      signer: loadActiveKeypair().keypair,
      transaction: tx,
    })) as {
      Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
    };
    const digest = r.Transaction?.digest ?? "";
    const success = r.Transaction?.status?.success === true;
    console.log(
      `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${digest || "(no digest)"} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
    );
    if (digest)
      await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
