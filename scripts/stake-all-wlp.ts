/**
 * Stake ALL of a wallet's WLP coins into the WaterX reward distributor.
 *
 * Reads a private key from env, merges every Coin<WLP> the wallet owns inside
 * one PTB, and stakes the merged coin into `RewardDistributor<WLP>`.
 *
 * Usage:
 *   ADMIN_SECRET_KEY=suiprivkey1... tsx scripts/stake-all-wlp.ts
 *   # or
 *   WATERX_INTEGRATION_PRIVATE_KEY=suiprivkey1... tsx scripts/stake-all-wlp.ts
 *
 * Optional env:
 *   NETWORK            "testnet" (default) | "mainnet"
 *   STAKE_GAS_BUDGET   default: 150_000_000
 *   DRY_RUN=1          print intended action, don't sign
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { TransactionArgument } from "@mysten/sui/transactions";
import { Transaction } from "@mysten/sui/transactions";

import {
  buildStakeRewardDistributorTx,
  getAccountCoins,
  getRewardDistributorStakeData,
  WaterXClient,
} from "../src/index.ts";

type Network = "mainnet" | "testnet";

function parseNetwork(): Network {
  const raw = process.env.NETWORK?.trim().toLowerCase();
  if (!raw || raw === "testnet") return "testnet";
  if (raw === "mainnet") return "mainnet";
  throw new Error(`NETWORK must be "mainnet" or "testnet", got: ${process.env.NETWORK}`);
}

const DEFAULT_STAKE_GAS_BUDGET = 150_000_000;

type OwnedCoin = {
  objectId: string;
  type: string;
  balance: string;
  version: string;
  digest: string;
};

function loadSigner(): Ed25519Keypair {
  const secret =
    process.env.ADMIN_SECRET_KEY?.trim() ?? process.env.WATERX_INTEGRATION_PRIVATE_KEY?.trim();
  if (!secret) {
    throw new Error("Missing ADMIN_SECRET_KEY (or WATERX_INTEGRATION_PRIVATE_KEY) in env");
  }
  return Ed25519Keypair.fromSecretKey(secret);
}

function parseGasBudget(): number {
  const raw = process.env.STAKE_GAS_BUDGET?.trim();
  if (!raw) return DEFAULT_STAKE_GAS_BUDGET;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`STAKE_GAS_BUDGET must be a positive integer, got: ${raw}`);
  }
  return n;
}

function sumBalances(coins: OwnedCoin[]): bigint {
  return coins.reduce((acc, c) => acc + BigInt(c.balance), 0n);
}

/**
 * Merge every `Coin<WLP>` the wallet owns into `coins[0]` and return it.
 *
 * Strategy: merge-all. Picks `coins[0]` as the destination and folds the
 * remaining objects into it via `tx.mergeCoins`. The returned argument
 * represents a single `Coin<WLP>` with `balance == sum(coins.balance)`,
 * ready to be moved by value into `deposit`.
 */
function buildStakeCoinArgument(tx: Transaction, coins: OwnedCoin[]): string | TransactionArgument {
  if (coins.length === 0) {
    throw new Error("buildStakeCoinArgument: no WLP coins to stake");
  }
  const [primary, ...rest] = coins;
  const primaryArg = tx.object(primary!.objectId);
  if (rest.length > 0) {
    tx.mergeCoins(
      primaryArg,
      rest.map((c) => tx.object(c.objectId)),
    );
  }
  return primaryArg;
}

async function main() {
  const network = parseNetwork();
  const client = network === "mainnet" ? WaterXClient.mainnet() : WaterXClient.testnet();
  const signer = loadSigner();
  const owner = signer.toSuiAddress();
  const wlpType = client.config.wlpType;
  const dryRun = process.env.DRY_RUN === "1";
  const gasBudget = parseGasBudget();

  console.log(`=== stake-all-wlp (${network}) ===`);
  console.log(`owner=${owner}`);
  console.log(`distributor=${client.config.rewardDistributorId}`);
  console.log(`wlpType=${wlpType}`);
  console.log(`rewardTokenTypes=${client.config.rewardDistributorRewardTokenTypes?.join(",")}`);

  const before = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: wlpType,
  });
  console.log(
    `before: staked=${before.stakeAmount} claimable=${before.claimableRewardAmount} cumulative=${before.cumulativeRewardAmount}`,
  );

  const walletWlp = await getAccountCoins(client, owner, wlpType);
  const totalWlp = sumBalances(walletWlp);
  console.log(`walletWlp: ${walletWlp.length} object(s), total=${totalWlp.toString()}`);

  if (walletWlp.length === 0 || totalWlp === 0n) {
    throw new Error("Wallet holds no WLP — nothing to stake.");
  }

  const stakeTx = new Transaction();
  stakeTx.setSender(owner);

  const stakeCoinArg = buildStakeCoinArgument(stakeTx, walletWlp);

  buildStakeRewardDistributorTx(client, {
    stakeTokenType: wlpType,
    stakeCoin: stakeCoinArg,
    gasBudget,
    tx: stakeTx,
  });

  if (dryRun) {
    console.log("\nDRY_RUN=1: skipping sign/execute. PTB built successfully.");
    return;
  }

  console.log("\nSigning and executing stake tx...");
  const raw = await client.grpcClient.signAndExecuteTransaction({
    signer,
    transaction: stakeTx,
    include: { effects: true, events: true, objectTypes: true },
  });

  const result = raw as {
    $kind?: string;
    Transaction?: { digest?: string; status?: { success?: boolean; error?: unknown } };
    FailedTransaction?: { digest?: string; status?: { success?: boolean; error?: unknown } };
  };
  const inner =
    result.$kind === "Transaction"
      ? result.Transaction
      : result.$kind === "FailedTransaction"
        ? result.FailedTransaction
        : null;
  const digest = inner?.digest;
  const success = inner?.status?.success === true;

  if (!digest) throw new Error("Stake tx returned no digest");
  if (!success) {
    throw new Error(
      `Stake tx failed (${digest}): ${
        typeof inner?.status?.error === "string"
          ? inner!.status!.error
          : JSON.stringify(inner?.status?.error)
      }`,
    );
  }
  console.log(`tx digest: ${digest}`);

  await client.grpcClient.waitForTransaction({ digest, timeout: 60_000 });

  const after = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: wlpType,
  });
  console.log(
    `after: staked=${after.stakeAmount} claimable=${after.claimableRewardAmount} cumulative=${after.cumulativeRewardAmount}`,
  );
  const delta = after.stakeAmount - before.stakeAmount;
  console.log(`stakeDelta=${delta.toString()} (expected ${totalWlp.toString()})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
