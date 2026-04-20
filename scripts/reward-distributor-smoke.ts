/**
 * Testnet smoke script for the reward distributor SDK surface originally requested:
 * mint a small WLP coin to the wallet, stake it, read incentive / stake data, then redeem it.
 *
 * Uses the same integration wallet loading path as `pnpm test:integration`.
 *
 * Usage:
 *   pnpm rewarder:smoke
 *   pnpm rewarder:smoke -- --mint-usdc-amount 10000000 --wait-ms 5000
 *   pnpm rewarder:smoke -- --wlp-coin 0x...
 *
 * Requirements:
 *   - Integration key configured (`WATERX_INTEGRATION_PRIVATE_KEY` or `.integration-trader.keystore`)
 *   - Wallet has enough testnet USDC to mint a small WLP position unless `--wlp-coin` is supplied
 */

import type { TransactionArgument } from "@mysten/sui/transactions";
import { Transaction } from "@mysten/sui/transactions";

import {
  calculateRewardDistributorIncentive,
  getAccountCoins,
  getRewardDistributorStakeData,
  selectCoinsForAmount,
  TESTNET_TYPES,
  type RewardDistributorStakeData,
} from "../src/index.ts";
import {
  buildMintWlpTx,
  buildStakeRewardDistributorTx,
  buildUnstakeRewardDistributorTx,
} from "../src/tx-builders.ts";
import { normalizeIntegrationTxResult } from "../test/helpers/integration-tx-result.ts";
import { client, loadIntegrationTraderKeypair, sleep } from "../test/integration/setup.ts";

type ParsedArgs = {
  mintUsdcAmount: bigint;
  waitMs: number;
  wlpCoinId?: string;
};

type OwnedCoin = {
  objectId: string;
  type: string;
  balance: string;
  version: string;
  digest: string;
};

const DEFAULT_MINT_USDC_AMOUNT = 10_000_000n;
const DEFAULT_WAIT_MS = 5_000;

function parseArgs(argv: string[]): ParsedArgs {
  const readValue = (flag: string) => {
    const idx = argv.findIndex((arg) => arg === flag);
    return idx >= 0 ? argv[idx + 1] : undefined;
  };

  const mintUsdcAmountRaw = readValue("--mint-usdc-amount");
  const waitMsRaw = readValue("--wait-ms");
  const wlpCoinId = readValue("--wlp-coin");

  return {
    mintUsdcAmount: mintUsdcAmountRaw ? BigInt(mintUsdcAmountRaw) : DEFAULT_MINT_USDC_AMOUNT,
    waitMs: waitMsRaw ? Number(waitMsRaw) : DEFAULT_WAIT_MS,
    ...(wlpCoinId ? { wlpCoinId } : {}),
  };
}

function assertPositive(name: string, value: bigint) {
  if (value <= 0n) {
    throw new Error(`${name} must be > 0, got ${value.toString()}`);
  }
}

function assertNonNegativeNumber(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number, got ${String(value)}`);
  }
}

function stakeDelta(before: RewardDistributorStakeData, after: RewardDistributorStakeData) {
  return after.stakeAmount - before.stakeAmount;
}

function unstakeDelta(before: RewardDistributorStakeData, after: RewardDistributorStakeData) {
  return before.stakeAmount - after.stakeAmount;
}

async function executeAndWait(
  label: string,
  tx: Transaction,
  owner: string,
  gasBudget: number,
  signer: ReturnType<typeof loadIntegrationTraderKeypair>,
) {
  tx.setSender(owner);
  tx.setGasBudget(gasBudget);

  const raw = await client.grpcClient.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true, events: true, objectTypes: true },
  });
  const result = normalizeIntegrationTxResult(raw);

  await client.grpcClient.waitForTransaction({
    digest: result.digest,
    timeout: 60_000,
  });

  if (result.effects.status.status !== "success") {
    throw new Error(
      `${label} failed (${result.digest}): ${result.effects.status.error ?? "unknown"}`,
    );
  }

  console.log(`${label} digest: ${result.digest}`);
  return result;
}

async function listWalletCoins(owner: string, coinType: string): Promise<OwnedCoin[]> {
  return getAccountCoins(client, owner, coinType);
}

function chooseNewCoin(before: OwnedCoin[], after: OwnedCoin[]): OwnedCoin {
  const beforeIds = new Set(before.map((coin) => coin.objectId.toLowerCase()));
  const created = after.filter((coin) => !beforeIds.has(coin.objectId.toLowerCase()));

  if (created.length === 1) return created[0]!;
  if (created.length > 1) {
    created.sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1));
    return created[0]!;
  }

  throw new Error("Could not identify the newly minted WLP coin in wallet after mint.");
}

async function buildWalletCoinForAmount(
  owner: string,
  coinType: string,
  amount: bigint,
): Promise<{ tx: Transaction; selectedCoin: string | TransactionArgument }> {
  const { coins, totalBalance } = await selectCoinsForAmount(client, owner, coinType, amount);
  if (totalBalance < amount) {
    throw new Error(
      `Wallet ${coinType} insufficient: need ${amount.toString()}, have ${totalBalance.toString()}.`,
    );
  }

  const tx = new Transaction();
  tx.setSender(owner);

  if (coins.length === 1 && totalBalance === amount) {
    return { tx, selectedCoin: coins[0]!.objectId };
  }

  const primary = tx.object(coins[0]!.objectId);
  if (coins.length > 1) {
    tx.mergeCoins(
      primary,
      coins.slice(1).map((coin) => tx.object(coin.objectId)),
    );
  }

  if (totalBalance === amount) {
    return { tx, selectedCoin: primary };
  }

  const [selectedCoin] = tx.splitCoins(primary, [amount]);
  tx.transferObjects([primary], owner);
  return { tx, selectedCoin: selectedCoin! };
}

async function resolveStakeCoin(
  owner: string,
  args: ParsedArgs,
  signer: ReturnType<typeof loadIntegrationTraderKeypair>,
): Promise<{ coinId: string; stakeAmount: bigint; minted: boolean }> {
  if (args.wlpCoinId) {
    const walletWlpCoins = await listWalletCoins(owner, TESTNET_TYPES.WLP);
    const match = walletWlpCoins.find(
      (coin) => coin.objectId.toLowerCase() === args.wlpCoinId!.toLowerCase(),
    );
    if (!match) {
      throw new Error(`Specified WLP coin not found in wallet: ${args.wlpCoinId}`);
    }
    return {
      coinId: match.objectId,
      stakeAmount: BigInt(match.balance),
      minted: false,
    };
  }

  const beforeWlpCoins = await listWalletCoins(owner, TESTNET_TYPES.WLP);
  const { tx, selectedCoin } = await buildWalletCoinForAmount(
    owner,
    TESTNET_TYPES.USDC,
    args.mintUsdcAmount,
  );

  await buildMintWlpTx(client, {
    tx,
    collateral: "USDC",
    depositCoin: selectedCoin,
    minLpAmount: 0n,
    recipient: owner,
  });

  await executeAndWait("mintWlp", tx, owner, 200_000_000, signer);

  const afterWlpCoins = await listWalletCoins(owner, TESTNET_TYPES.WLP);
  const mintedCoin = chooseNewCoin(beforeWlpCoins, afterWlpCoins);

  return {
    coinId: mintedCoin.objectId,
    stakeAmount: BigInt(mintedCoin.balance),
    minted: true,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertPositive("mintUsdcAmount", args.mintUsdcAmount);
  assertNonNegativeNumber("waitMs", args.waitMs);

  const signer = loadIntegrationTraderKeypair();
  const owner = signer.getPublicKey().toSuiAddress();

  console.log("=== Reward Distributor Smoke ===");
  console.log(`owner=${owner}`);
  console.log(`distributor=${client.config.rewardDistributorId}`);
  console.log(`stakeTokenType=${TESTNET_TYPES.WLP}`);
  console.log(
    `rewardTokenTypes=${client.config.rewardDistributorRewardTokenTypes?.join(",") ?? ""}`,
  );

  const beforeStakeData = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: TESTNET_TYPES.WLP,
  });

  console.log(
    `before: stake=${beforeStakeData.stakeAmount} claimable=${beforeStakeData.claimableRewardAmount}`,
  );

  const { coinId, stakeAmount, minted } = await resolveStakeCoin(owner, args, signer);
  assertPositive("stakeAmount", stakeAmount);
  if (stakeAmount < 1_000n) {
    throw new Error(`stakeAmount must be >= 1000 for redeem, got ${stakeAmount}.`);
  }

  console.log(
    `${minted ? "minted" : "using existing"} WLP coin=${coinId} amount=${stakeAmount.toString()}`,
  );

  const stakeTx = buildStakeRewardDistributorTx(client, {
    stakeTokenType: TESTNET_TYPES.WLP,
    stakeCoin: coinId,
  });
  await executeAndWait("stakeRewardDistributor", stakeTx, owner, 100_000_000, signer);

  const afterStakeData = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: TESTNET_TYPES.WLP,
  });

  const stakedDelta = stakeDelta(beforeStakeData, afterStakeData);
  if (stakedDelta !== stakeAmount) {
    throw new Error(
      `Unexpected stake delta after stake: expected ${stakeAmount}, got ${stakedDelta}.`,
    );
  }

  console.log(
    `after stake: stake=${afterStakeData.stakeAmount} claimable=${afterStakeData.claimableRewardAmount}`,
  );

  if (args.waitMs > 0) {
    console.log(`waiting ${args.waitMs}ms before reading incentive...`);
    await sleep(args.waitMs);
  }

  const incentive = await calculateRewardDistributorIncentive(client, {
    account: owner,
    stakeTokenType: TESTNET_TYPES.WLP,
  });
  const afterWaitData = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: TESTNET_TYPES.WLP,
  });

  console.log(
    `incentive=${incentive} | stakeData.claimable=${afterWaitData.claimableRewardAmount} cumulative=${afterWaitData.cumulativeRewardAmount}`,
  );

  const unstakeTx = buildUnstakeRewardDistributorTx(client, {
    stakeTokenType: TESTNET_TYPES.WLP,
    withdrawalAmount: stakeAmount,
    recipient: owner,
  });
  await executeAndWait("unstakeRewardDistributor", unstakeTx, owner, 50_000_000, signer);

  const afterUnstakeData = await getRewardDistributorStakeData(client, {
    account: owner,
    stakeTokenType: TESTNET_TYPES.WLP,
  });

  const redeemedDelta = unstakeDelta(afterStakeData, afterUnstakeData);
  if (redeemedDelta !== stakeAmount) {
    throw new Error(
      `Unexpected stake delta after unstake: expected ${stakeAmount}, got ${redeemedDelta}.`,
    );
  }

  console.log(
    `after unstake: stake=${afterUnstakeData.stakeAmount} claimable=${afterUnstakeData.claimableRewardAmount}`,
  );
  console.log("\nSmoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
