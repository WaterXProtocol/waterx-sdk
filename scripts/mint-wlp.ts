/**
 * Convert a specified amount of USDC and/or USDSUI into WLP via `mint_wlp`.
 *
 * For each collateral with a corresponding `*_AMOUNT` env value, builds ONE
 * PTB that:
 *   1. merges every owned coin of that type into `coins[0]`
 *   2. if `amount < merged total`, splits off the exact amount
 *   3. calls `buildMintWlpTx` with `recipient = owner` (Move-side `mint_wlp_to`
 *      transfers the minted WLP directly back to the wallet)
 *
 * Each collateral is processed in its OWN PTB — `buildMintWlpTx` refreshes
 * every pool token via `lp_pool::update_token_value`, so combining two mints
 * in one PTB would duplicate those calls and inflate gas for no benefit.
 *
 * The signer (`ADMIN_SECRET_KEY` / `WATERX_INTEGRATION_PRIVATE_KEY`) must be
 * the wallet that holds the USDC/USDSUI — this script is not a sponsored
 * transaction setup; the signer is both sender and gas payer.
 *
 * Usage:
 *   USDC_AMOUNT=5000000 ADMIN_SECRET_KEY=suiprivkey1... tsx scripts/mint-wlp.ts
 *   USDSUI_AMOUNT=10000000 ADMIN_SECRET_KEY=... tsx scripts/mint-wlp.ts
 *   USDC_AMOUNT=5000000 USDSUI_AMOUNT=10000000 ADMIN_SECRET_KEY=... tsx scripts/mint-wlp.ts
 *
 * Amounts are RAW u64 values (USDC / USDSUI both have 6 decimals on Sui — so
 * `5000000` means 5 USDC). At least one of `USDC_AMOUNT` / `USDSUI_AMOUNT`
 * must be set.
 *
 * Optional env:
 *   NETWORK            "testnet" (default) | "mainnet"
 *   USDC_MIN_LP        slippage protection for the USDC mint (raw u64, default 0)
 *   USDSUI_MIN_LP      slippage protection for the USDSUI mint (raw u64, default 0)
 *   MINT_GAS_BUDGET    default: 200_000_000
 *   UPDATE_PYTH=1      fetch a fresh Hermes update before feeding Pyth on-chain
 *   DRY_RUN=1          print intended action, don't sign
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { TransactionArgument } from "@mysten/sui/transactions";
import { Transaction } from "@mysten/sui/transactions";

import {
  buildMintWlpTx,
  type CollateralAsset,
  getAccountCoins,
  WaterXClient,
} from "../src/index.ts";

const DEFAULT_MINT_GAS_BUDGET = 200_000_000;

type Network = "mainnet" | "testnet";

type OwnedCoin = {
  objectId: string;
  type: string;
  balance: string;
  version: string;
  digest: string;
};

type CollateralPlan = {
  collateral: CollateralAsset;
  amount: bigint;
  minLpAmount: bigint;
};

function parseNetwork(): Network {
  const raw = process.env.NETWORK?.trim().toLowerCase();
  if (!raw || raw === "testnet") return "testnet";
  if (raw === "mainnet") return "mainnet";
  throw new Error(`NETWORK must be "mainnet" or "testnet", got: ${process.env.NETWORK}`);
}

function parsePositiveInt(envName: string, fallback: number): number {
  const raw = process.env[envName]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`${envName} must be a positive integer, got: ${raw}`);
  }
  return n;
}

function parseBigintEnv(envName: string, opts: { allowZero: boolean }): bigint | null {
  const raw = process.env[envName]?.trim();
  if (!raw) return null;
  let n: bigint;
  try {
    n = BigInt(raw);
  } catch {
    throw new Error(`${envName} must be an integer, got: ${raw}`);
  }
  if (n < 0n || (!opts.allowZero && n === 0n)) {
    throw new Error(`${envName} must be a positive integer, got: ${raw}`);
  }
  return n;
}

function loadSigner(): Ed25519Keypair {
  const secret =
    process.env.ADMIN_SECRET_KEY?.trim() ?? process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim();
  if (!secret) {
    throw new Error("Missing ADMIN_SECRET_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) in env");
  }
  return Ed25519Keypair.fromSecretKey(secret);
}

function sumBalances(coins: OwnedCoin[]): bigint {
  return coins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
}

function collectPlans(): CollateralPlan[] {
  const plans: CollateralPlan[] = [];
  const usdc = parseBigintEnv("USDC_AMOUNT", { allowZero: false });
  if (usdc !== null) {
    plans.push({
      collateral: "USDC",
      amount: usdc,
      minLpAmount: parseBigintEnv("USDC_MIN_LP", { allowZero: true }) ?? 0n,
    });
  }
  const usdsui = parseBigintEnv("USDSUI_AMOUNT", { allowZero: false });
  if (usdsui !== null) {
    plans.push({
      collateral: "USDSUI",
      amount: usdsui,
      minLpAmount: parseBigintEnv("USDSUI_MIN_LP", { allowZero: true }) ?? 0n,
    });
  }
  if (plans.length === 0) {
    throw new Error("Set USDC_AMOUNT and/or USDSUI_AMOUNT — nothing to do.");
  }
  return plans;
}

/**
 * Build a PTB argument representing a single `Coin<COLL>` with exactly
 * `amount` balance.
 *
 * Strategy: merge every owned coin into `coins[0]`, then split off `amount`
 * if smaller than the merged total. If `amount === total`, return the merged
 * coin directly (one fewer PTB command). Caller must guarantee
 * `coins.length > 0` and `amount <= sum(coins.balance)`.
 */
function buildExactAmountCoinArgument(
  tx: Transaction,
  coins: OwnedCoin[],
  amount: bigint,
  total: bigint,
): TransactionArgument {
  if (coins.length === 0) {
    throw new Error("buildExactAmountCoinArgument: no coins available");
  }
  if (amount > total) {
    throw new Error(
      `buildExactAmountCoinArgument: requested ${amount} > available ${total}`,
    );
  }
  const [primary, ...rest] = coins;
  const primaryArg = tx.object(primary!.objectId);
  if (rest.length > 0) {
    tx.mergeCoins(
      primaryArg,
      rest.map((c) => tx.object(c.objectId)),
    );
  }
  if (amount === total) {
    return primaryArg;
  }
  const [split] = tx.splitCoins(primaryArg, [amount]);
  return split!;
}

async function getWalletWlpTotal(client: WaterXClient, owner: string): Promise<bigint> {
  const coins = await getAccountCoins(client, owner, client.config.wlpType);
  return sumBalances(coins);
}

type ExecuteResult = {
  $kind?: string;
  Transaction?: { digest?: string; status?: { success?: boolean; error?: unknown } };
  FailedTransaction?: { digest?: string; status?: { success?: boolean; error?: unknown } };
};

async function signExecuteAndWait(
  client: WaterXClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<void> {
  const raw = (await client.grpcClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, events: true, objectTypes: true },
  })) as ExecuteResult;

  const inner =
    raw.$kind === "Transaction"
      ? raw.Transaction
      : raw.$kind === "FailedTransaction"
        ? raw.FailedTransaction
        : null;
  const digest = inner?.digest;
  const success = inner?.status?.success === true;

  if (!digest) throw new Error(`${label}: tx returned no digest`);
  if (!success) {
    throw new Error(
      `${label} failed (${digest}): ${
        typeof inner?.status?.error === "string"
          ? inner!.status!.error
          : JSON.stringify(inner?.status?.error)
      }`,
    );
  }
  console.log(`  tx digest: ${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 60_000 });
}

async function processPlan(
  client: WaterXClient,
  signer: Ed25519Keypair,
  plan: CollateralPlan,
  opts: { gasBudget: number; updatePythPrice: boolean; dryRun: boolean },
): Promise<void> {
  const owner = signer.toSuiAddress();
  const collType = client.getCollateral(plan.collateral).type;
  const coins = await getAccountCoins(client, owner, collType);
  const total = sumBalances(coins);

  console.log(`\n--- ${plan.collateral} (${collType}) ---`);
  console.log(`  wallet: ${coins.length} object(s), total=${total.toString()}`);
  console.log(`  requested: ${plan.amount.toString()}  minLP=${plan.minLpAmount.toString()}`);

  if (total < plan.amount) {
    throw new Error(
      `${plan.collateral}: wallet has ${total.toString()}, but ${plan.amount.toString()} requested`,
    );
  }

  const tx = new Transaction();
  tx.setSender(owner);

  const depositCoinArg = buildExactAmountCoinArgument(tx, coins, plan.amount, total);

  await buildMintWlpTx(client, {
    collateral: plan.collateral,
    depositCoin: depositCoinArg,
    recipient: owner,
    minLpAmount: plan.minLpAmount,
    updatePythPrice: opts.updatePythPrice,
    gasBudget: opts.gasBudget,
    tx,
  });

  if (opts.dryRun) {
    console.log(`  DRY_RUN=1: PTB built, skipping execute.`);
    return;
  }

  console.log(`  signing and executing mint tx...`);
  await signExecuteAndWait(client, signer, tx, `mint ${plan.collateral}→WLP`);
}

async function main() {
  const network = parseNetwork();
  const client = network === "mainnet" ? WaterXClient.mainnet() : WaterXClient.testnet();
  const signer = loadSigner();
  const owner = signer.toSuiAddress();
  const plans = collectPlans();
  const gasBudget = parsePositiveInt("MINT_GAS_BUDGET", DEFAULT_MINT_GAS_BUDGET);
  const updatePythPrice = process.env.UPDATE_PYTH === "1";
  const dryRun = process.env.DRY_RUN === "1";

  console.log(`=== mint-wlp (${network}) ===`);
  console.log(`owner=${owner}`);
  console.log(`wlpType=${client.config.wlpType}`);
  console.log(
    `plans=${plans
      .map((p) => `${p.collateral}:${p.amount.toString()}(minLP=${p.minLpAmount.toString()})`)
      .join(", ")}`,
  );
  console.log(`updatePyth=${updatePythPrice}`);

  const beforeWlp = await getWalletWlpTotal(client, owner);
  console.log(`before WLP balance: ${beforeWlp.toString()}`);

  for (const plan of plans) {
    await processPlan(client, signer, plan, { gasBudget, updatePythPrice, dryRun });
  }

  const afterWlp = await getWalletWlpTotal(client, owner);
  console.log(`\nafter WLP balance:  ${afterWlp.toString()}`);
  console.log(`wlpDelta=${(afterWlp - beforeWlp).toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
