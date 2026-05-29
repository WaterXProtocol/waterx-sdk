/**
 * Mint WLP from the wxa account's USD balance AND stake it atomically — the
 * "deposit USD and earn rewards" flow — WITHOUT pushing a fresh Pyth price.
 *
 * Like `deposit-to-wlp.ts`'s SKIP_PRICE_UPDATE path: we skip the Hermes fetch
 * + on-chain Pyth push (updatePythPrices) and only re-aggregate the price
 * already sitting on-chain. mint_wlp still calls oracle::get_price, which
 * aborts EStalePrice unless oracle::aggregate ran THIS PTB — so we run the
 * collector → feed → aggregate cycle ourselves, then hand the same PTB to
 * buildMintAndStakeWlpTx with `skipOraclePriceRefresh: true`.
 *
 * Only succeeds while the on-chain USDCUSD Pyth price is within the pyth_rule
 * tolerance window (set to 1 year on this testnet); otherwise the aggregate
 * fails ETotalWeightNotEnough and you must run a full refresh instead.
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID (or WATERX_ACCOUNT_ID)  wxa account id
 *
 * Optional env:
 *   DEPOSIT_AMOUNT   raw USD units to deposit (default 30_000_000 = 30 USD)
 *   MIN_LP_AMOUNT    slippage floor in raw WLP units (default 0)
 *   STAKE_ALIAS      staking pool alias (default "WLP")
 *   EXECUTE=1        sign + execute (otherwise simulate only)
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/mint-and-stake-wlp.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/mint-and-stake-wlp.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { getAccountBalance } from "../src/fetch.ts";
import { buildMintAndStakeWlpTx } from "../src/tx-builders.ts";
import { aggregateTickerWithPyth } from "../src/utils/pyth.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");
const TICKER = "USDCUSD"; // WLP pool's only token's ticker

function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address from client.yaml");
  const activeAddress = m[1]!.toLowerCase();
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue;
    const kp = Ed25519Keypair.fromSecretKey(raw.slice(1));
    if (kp.toSuiAddress().toLowerCase() === activeAddress) {
      return { keypair: kp, address: kp.toSuiAddress() };
    }
  }
  throw new Error(`no ED25519 key in keystore matches active address ${activeAddress}`);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const { keypair, address } = loadActiveKeypair();

  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID ?? process.env.WATERX_ACCOUNT_ID;
  if (!accountId) {
    throw new Error("mint-and-stake-wlp: set WATERX_SMOKE_ACCOUNT_ID (or WATERX_ACCOUNT_ID)");
  }
  const depositAmount = BigInt(process.env.DEPOSIT_AMOUNT ?? "30000000");
  const minLpAmount = BigInt(process.env.MIN_LP_AMOUNT ?? "0");
  const stakeAlias = process.env.STAKE_ALIAS ?? "WLP";
  const doExecute = process.env.EXECUTE === "1";

  const client = await WaterXClient.create("TESTNET", { cache: true });
  const usdType = client.creditType();
  const wlpType = client.wlpType();

  console.log(`sender:        ${address}`);
  console.log(`account:       ${accountId}`);
  console.log(`deposit token: ${usdType}`);
  console.log(`deposit raw:   ${depositAmount} (USD, 6 dec)`);
  console.log(`min lp raw:    ${minLpAmount}`);
  console.log(`stake alias:   ${stakeAlias}`);
  console.log(`price update:  SKIPPED (aggregate-only, no Pyth push)`);
  console.log(`mode:          ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const usdBalance = await getAccountBalance(client, accountId, usdType);
  console.log(`wxa USD bal:   ${usdBalance}`);
  if (usdBalance < depositAmount) {
    throw new Error(`mint-and-stake-wlp: wxa USD balance ${usdBalance} < deposit ${depositAmount}`);
  }

  const tx = new Transaction();
  // Re-aggregate the on-chain USDCUSD price (no Hermes / no Pyth push) so
  // mint_wlp's oracle::get_price sees a same-PTB aggregate.
  const feed = client.getPythFeed(TICKER);
  aggregateTickerWithPyth(tx, client, {
    ticker: TICKER,
    priceInfoObjectId: feed.price_info_object,
  });

  await buildMintAndStakeWlpTx(client, {
    tx,
    skipOraclePriceRefresh: true,
    accountId,
    depositTokenType: usdType,
    depositTicker: TICKER,
    depositAmount,
    minLpAmount,
    stakeAlias,
    rewarderTypes: [], // current WLP pool has no rewarders
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
  const r = (await client.signAndExecuteTransaction({ signer: keypair, transaction: tx })) as {
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
