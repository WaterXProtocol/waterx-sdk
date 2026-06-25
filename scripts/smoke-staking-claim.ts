/**
 * Staking + reward-claim lifecycle smoke against testnet:
 *   1. Discover rewarder reward-types by scanning the StakingPool's
 *      `RewarderKey<R>` dynamic fields (no need to hardcode reward types).
 *   2. View pre-flight (raw simulate): total_stake, stake_exists,
 *      and `realtime_reward_amount<STAKE, R>` per rewarder.
 *   3. Stake N WLP, settling every rewarder in the same PTB.
 *   4. Poll the realtime reward until it accrues a non-zero amount
 *      (or `WATERX_REWARD_WAIT_MS` elapses), then claim each rewarder.
 *   5. Unstake.
 *
 * Demonstrates four shapes of `simulateTransaction`:
 *   - `total_stake_amount(pool) → u64`
 *   - `stake_exists(pool, account) → bool`
 *   - `realtime_reward_amount<STAKE, R>(pool, account) → u64`
 *   - dynamic-field discovery via `suix_getDynamicFields` (not simulate,
 *     but the canonical way to enumerate Rewarder<STAKE, R> entries)
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id with WLP balance
 *
 * Optional env:
 *   WATERX_STAKE_AMOUNT        raw u64 to stake, default 1_000_000
 *   WATERX_REWARD_WAIT_MS      max poll window for first non-zero reward, default 15000
 *   WATERX_POLL_INTERVAL_MS    poll interval, default 1500
 *   WATERX_SKIP_UNSTAKE=1      skip the unstake step
 */
import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { PerpClient } from "../src/client.ts";
import { DRY_RUN_SENDER } from "../src/constants.ts";
import { getAccountBalance } from "../src/fetch.ts";
import { isProtocolWhitelisted } from "../src/generated/waterx_account/account.ts";
import {
  realtimeRewardAmount as realtimeRewardAmountCall,
  stakeExists as stakeExistsCall,
  totalStakeAmount as totalStakeAmountCall,
} from "../src/generated/waterx_staking/waterx_staking.ts";
import { claimReward, stake, unstake } from "../src/index.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { loadActiveKeypair } from "./load-signer.ts";

const TESTNET_JSON_RPC = "https://fullnode.testnet.sui.io:443";

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
  commandResults?: { returnValues?: { bcs?: Uint8Array | string }[] }[] | null;
}

async function sim(
  client: PerpClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<boolean> {
  tx.setSender(signer.toSuiAddress());
  const r = (await client.simulate(tx)) as unknown as SimResult;
  if (r.$kind === "FailedTransaction") {
    const msg = r.FailedTransaction?.status?.error?.message?.slice(0, 240) ?? "(no msg)";
    console.log(`  \x1b[33m●\x1b[0m ${label.padEnd(28)} sim aborted: ${msg}`);
    return false;
  }
  console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(28)} sim ok`);
  return true;
}

async function execute(
  client: PerpClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<boolean> {
  tx.setSender(signer.toSuiAddress());
  const r = (await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  const success = r.Transaction?.status?.success === true;
  console.log(
    `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(28)} ${digest || "(no digest)"} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
  );
  if (digest) {
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  }
  return success;
}

function poolId(client: PerpClient, alias = "WLP"): string {
  const id = client.config.packages.waterx_staking?.pools?.[alias];
  if (!id) throw new Error(`waterx_staking.pools[${alias}] not set in config`);
  return id;
}

function stakingPkg(client: PerpClient): string {
  const pkg = client.config.packages.waterx_staking?.published_at;
  if (!pkg) throw new Error("waterx_staking.published_at not set in config");
  return pkg;
}

interface SimplifiedBcs {
  bcs?: Uint8Array | string;
}

function pullBcs(field: SimplifiedBcs | undefined): Uint8Array {
  if (!field?.bcs) throw new Error("no BCS returnValue");
  return typeof field.bcs === "string" ? fromBase64(field.bcs) : field.bcs;
}

async function readTotalStake(client: PerpClient): Promise<bigint> {
  const tx = new Transaction();
  totalStakeAmountCall({
    package: stakingPkg(client),
    arguments: { self: tx.object(poolId(client)) },
    typeArguments: [client.wlpType()],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  return BigInt(bcs.u64().parse(pullBcs(r.commandResults?.[0]?.returnValues?.[0])));
}

async function readStakeExists(client: PerpClient, accountId: string): Promise<boolean> {
  const tx = new Transaction();
  stakeExistsCall({
    package: stakingPkg(client),
    arguments: { self: tx.object(poolId(client)), account: accountId },
    typeArguments: [client.wlpType()],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  return bcs.bool().parse(pullBcs(r.commandResults?.[0]?.returnValues?.[0]));
}

async function readRealtimeReward(
  client: PerpClient,
  accountId: string,
  rewardType: string,
): Promise<bigint> {
  const tx = new Transaction();
  realtimeRewardAmountCall({
    package: stakingPkg(client),
    arguments: { self: tx.object(poolId(client)), account: accountId },
    typeArguments: [client.wlpType(), rewardType],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  return BigInt(bcs.u64().parse(pullBcs(r.commandResults?.[0]?.returnValues?.[0])));
}

async function readStakingWhitelisted(client: PerpClient): Promise<boolean> {
  const tx = new Transaction();
  const stakingOrig = client.config.packages.waterx_staking?.original_id;
  if (!stakingOrig) throw new Error("waterx_staking.original_id not set in config");
  const witnessType = `${stakingOrig}::witness::WaterXStaking`;
  isProtocolWhitelisted({
    package: client.config.packages.waterx_account.published_at,
    arguments: { registry: tx.object(client.config.packages.waterx_account.account_registry) },
    typeArguments: [witnessType],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  return bcs.bool().parse(pullBcs(r.commandResults?.[0]?.returnValues?.[0]));
}

/**
 * Discover rewarder reward-types by enumerating the StakingPool's
 * `RewarderKey<R>` dynamic fields. Returns each R as a fully-qualified
 * Move type. `rewarder_ids(pool)` returns `&VecSet<TypeName>` — a
 * reference type devInspect can't BCS-serialize back — so the canonical
 * read path is the dynamic-field listing.
 */
async function discoverRewarderTypes(stakingPool: string): Promise<string[]> {
  const res = await fetch(TESTNET_JSON_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "suix_getDynamicFields",
      params: [stakingPool],
    }),
  });
  const json = (await res.json()) as {
    result?: { data?: { name?: { type?: string } }[] };
  };
  const fields = json.result?.data ?? [];
  const types: string[] = [];
  // Name type looks like `${pkg}::waterx_staking::RewarderKey<R>` → extract R.
  const re = /::waterx_staking::RewarderKey<(.+)>$/;
  for (const f of fields) {
    const m = re.exec(f.name?.type ?? "");
    if (m) types.push(m[1]!);
  }
  return types;
}

async function snapshot(
  client: PerpClient,
  accountId: string,
  rewarderTypes: string[],
  label: string,
): Promise<void> {
  const total = await readTotalStake(client);
  const exists = await readStakeExists(client, accountId);
  console.log(`  ${label.padEnd(28)} total_stake=${total} stake_exists=${exists}`);
  for (const r of rewarderTypes) {
    const amt = await readRealtimeReward(client, accountId, r);
    const tail = r.split("::").slice(-2).join("::");
    console.log(`    realtime_reward ${tail.padEnd(20)} = ${amt}`);
  }
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "smoke-staking-claim: WATERX_SMOKE_ACCOUNT_ID is required. " +
        "Run scripts/create-wxa-account.ts first.",
    );
  }

  const { keypair, address } = loadActiveKeypair();
  console.log(`Sender:    ${address}`);
  console.log(`AccountId: ${accountId}`);

  const client = await PerpClient.create("TESTNET", { cache: true });
  const stakeAmount = BigInt(process.env.WATERX_STAKE_AMOUNT ?? "1000000");
  const waitMs = Number(process.env.WATERX_REWARD_WAIT_MS ?? "15000");
  const pollMs = Number(process.env.WATERX_POLL_INTERVAL_MS ?? "1500");

  // Bail cleanly if the WLP staking pool isn't registered in this config
  // (canonical testnet ships with an empty waterx_staking.pools map).
  const stakingPools = client.config.packages.waterx_staking?.pools ?? {};
  if (!stakingPools["WLP"]) {
    console.log("\nwaterx_staking.pools[WLP] not registered in this config — skipping smoke.");
    console.log(`Available pool aliases: ${Object.keys(stakingPools).join(", ") || "(none)"}`);
    return;
  }

  // ============================================================================
  // 1. Discover rewarders + pre-flight
  // ============================================================================
  const pool = poolId(client);
  const rewarderTypes = await discoverRewarderTypes(pool);
  console.log(`\nRewarders configured (${rewarderTypes.length}):`);
  for (const r of rewarderTypes) console.log(`  • ${r}`);
  if (rewarderTypes.length === 0) {
    throw new Error(
      "smoke-staking-claim: no rewarders configured on the WLP staking pool. " +
        "Configure a rewarder via admin tooling or skip this smoke.",
    );
  }

  const wlpBalance = await getAccountBalance(client, accountId, client.wlpType());
  if (wlpBalance < stakeAmount) {
    throw new Error(
      `smoke-staking-claim: wxa WLP balance ${wlpBalance} < stake ${stakeAmount}. ` +
        `Run scripts/deposit-to-wlp.ts first (or lower WATERX_STAKE_AMOUNT).`,
    );
  }

  console.log("\n=== Pre-flight (raw simulate) ===");
  if (!(await readStakingWhitelisted(client))) {
    throw new Error(
      "WaterXStaking witness not whitelisted on AccountRegistry — admin must whitelist the staking witness on the wxa AccountRegistry first",
    );
  }
  await snapshot(client, accountId, rewarderTypes, "pre-flight");

  // ============================================================================
  // 2. Stake (settling every rewarder)
  // ============================================================================
  console.log(`\n=== Stake ${stakeAmount} WLP (settling ${rewarderTypes.length} rewarder) ===`);
  {
    const tx = new Transaction();
    stake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType: client.wlpType(),
      stakeAmount,
      rewarderTypes,
    });
    if (!(await sim(client, keypair, tx, "stake (sim)"))) process.exit(2);
    if (!(await execute(client, keypair, tx, "stake (execute)"))) process.exit(1);
  }
  await snapshot(client, accountId, rewarderTypes, "post-stake");

  // ============================================================================
  // 3. Poll until rewards accrue (or timeout)
  // ============================================================================
  console.log(`\n=== Poll for non-zero realtime reward (≤ ${waitMs}ms) ===`);
  const primary = rewarderTypes[0]!;
  const deadline = Date.now() + waitMs;
  let realtime = 0n;
  while (Date.now() < deadline) {
    realtime = await readRealtimeReward(client, accountId, primary);
    if (realtime > 0n) break;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  console.log(`  realtime_reward(${primary.split("::").pop()}) = ${realtime}`);

  // ============================================================================
  // 4. Claim each rewarder
  // ============================================================================
  for (const r of rewarderTypes) {
    const tail = r.split("::").pop();
    console.log(`\n=== Claim ${tail} ===`);
    const tx = new Transaction();
    claimReward(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType: client.wlpType(),
      rewardType: r,
    });
    if (!(await sim(client, keypair, tx, `claim ${tail} (sim)`))) continue;
    await execute(client, keypair, tx, `claim ${tail} (execute)`);
  }
  await snapshot(client, accountId, rewarderTypes, "post-claim");

  // ============================================================================
  // 5. Unstake
  // ============================================================================
  if (process.env.WATERX_SKIP_UNSTAKE !== "1") {
    console.log(`\n=== Unstake ${stakeAmount} WLP ===`);
    const tx = new Transaction();
    unstake(client, tx, {
      accountId,
      stakeAlias: "WLP",
      stakeType: client.wlpType(),
      withdrawalAmount: stakeAmount,
      rewarderTypes,
    });
    if (!(await sim(client, keypair, tx, "unstake (sim)"))) process.exit(2);
    if (!(await execute(client, keypair, tx, "unstake (execute)"))) process.exit(1);
    await snapshot(client, accountId, rewarderTypes, "post-unstake");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
