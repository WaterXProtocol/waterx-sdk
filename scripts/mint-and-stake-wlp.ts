/**
 * Mint WLP from the wxa account's USD balance AND stake it atomically — the
 * "deposit USD and earn rewards" flow.
 *
 * By default does a FULL oracle refresh (Hermes fetch + on-chain Pyth push +
 * aggregate + TokenPoolInfo.value_usd bump) via `buildMintAndStakeWlpTx`'s
 * default refresh path, so it works regardless of how stale the on-chain Pyth
 * price is.
 *
 * `SKIP_PRICE_UPDATE=1` switches to the aggregate-only path: skip the Hermes
 * fetch + Pyth push and only re-aggregate the price already on-chain (mint_wlp
 * still needs a same-PTB `oracle::aggregate` or it aborts EStalePrice). That
 * only succeeds while the on-chain USDCUSD Pyth price is within the pyth_rule
 * tolerance window — otherwise the aggregate fails ETotalWeightNotEnough and
 * you must run the default full refresh instead.
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID (or WATERX_ACCOUNT_ID)  wxa account id
 *
 * Optional env:
 *   DEPOSIT_AMOUNT     raw USD units to deposit (default 30_000_000 = 30 USD)
 *   MIN_LP_AMOUNT      slippage floor in raw WLP units (default 0)
 *   STAKE_ALIAS        staking pool alias (default "WLP")
 *   SKIP_PRICE_UPDATE=1  aggregate-only (no Pyth push) — needs a fresh on-chain price
 *   EXECUTE=1          sign + execute (otherwise simulate only)
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/mint-and-stake-wlp.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/mint-and-stake-wlp.ts
 */
import { Transaction } from "@mysten/sui/transactions";

import { getAccountBalance } from "../src/fetch.ts";
import { buildMintAndStakeWlpTx } from "../src/tx-builders.ts";
import { aggregateTickerWithPyth } from "../src/utils/pyth.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { loadActiveKeypair, resolveActiveAddress } from "./load-signer.ts";
import { makeSmokeClient } from "./make-smoke-client.ts";

const TICKER = "USDCUSD"; // WLP pool's only token's ticker

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const address = resolveActiveAddress();

  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID ?? process.env.WATERX_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("mint-and-stake-wlp: set WATERX_SMOKE_ACCOUNT_ID (or WATERX_ACCOUNT_ID)");
  }
  const depositAmount = BigInt(process.env.DEPOSIT_AMOUNT ?? "30000000");
  const minLpAmount = BigInt(process.env.MIN_LP_AMOUNT ?? "0");
  const stakeAlias = process.env.STAKE_ALIAS ?? "WLP";
  const skipPriceUpdate = process.env.SKIP_PRICE_UPDATE === "1";
  const doExecute = process.env.EXECUTE === "1";

  const client = await makeSmokeClient();
  const usdType = client.creditType();
  const wlpType = client.wlpType();

  console.log(`sender:        ${address}`);
  console.log(`account:       ${accountId}`);
  console.log(`deposit token: ${usdType}`);
  console.log(`deposit raw:   ${depositAmount} (USD, 6 dec)`);
  console.log(`min lp raw:    ${minLpAmount}`);
  console.log(`stake alias:   ${stakeAlias}`);
  console.log(
    `price update:  ${skipPriceUpdate ? "SKIPPED (aggregate-only, no Pyth push)" : "full refresh (Hermes + Pyth push)"}`,
  );
  console.log(`mode:          ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const usdBalance = await getAccountBalance(client, accountId, usdType);
  console.log(`wxa USD bal:   ${usdBalance}`);
  if (usdBalance < depositAmount) {
    throw new Error(`mint-and-stake-wlp: wxa USD balance ${usdBalance} < deposit ${depositAmount}`);
  }

  const tx = new Transaction();
  if (skipPriceUpdate) {
    // Re-aggregate the on-chain USDCUSD price (no Hermes / no Pyth push) so
    // mint_wlp's oracle::get_price sees a same-PTB aggregate. Only works while
    // that on-chain price is within pyth_rule tolerance.
    const feed = client.getPythFeed(TICKER);
    aggregateTickerWithPyth(tx, client, {
      ticker: TICKER,
      priceInfoObjectId: feed.price_info_object,
    });
  }

  await buildMintAndStakeWlpTx(client, {
    tx,
    skipOraclePriceRefresh: skipPriceUpdate,
    accountId,
    depositTokenType: usdType,
    depositTicker: TICKER,
    depositAmount,
    minLpAmount,
    stakeAlias,
  });
  tx.setSender(address);

  console.log("\nsimulating…");
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    throw new Error(
      `simulate aborted: ${sim.FailedTransaction?.status?.error?.message ?? "(no msg)"}`,
    );
  }
  console.log("  ✓ simulate ok");

  if (!doExecute) {
    console.log("\nEXECUTE != 1 — stopping after simulate. Set EXECUTE=1 to broadcast.");
    return;
  }

  console.log("\nexecuting…");
  const r = (await client.signAndExecuteTransaction({
    signer: loadActiveKeypair().keypair,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  if (r.Transaction?.status?.success !== true) {
    throw new Error(`execute failed: ${r.Transaction?.status?.error ?? "(no error)"} ${digest}`);
  }
  console.log(`  ✓ executed  digest=${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});

  const usdAfter = await getAccountBalance(client, accountId, usdType);
  const wlpAfter = await getAccountBalance(client, accountId, wlpType);
  console.log(`\nwxa USD after: ${usdAfter}  (Δ ${usdAfter - usdBalance})`);
  console.log(`wxa WLP after: ${wlpAfter} (un-staked; staked WLP lives in the staking pool)`);
  console.log(`tx: https://suiscan.xyz/testnet/tx/${digest}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
