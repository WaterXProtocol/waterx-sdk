/**
 * Staking lifecycle smoke against testnet:
 *   1. View — pool's total stake + this account's `stake_exists` flag
 *   2. Stake N WLP from the wxa account into the WLP staking pool
 *   3. View — confirm `stake_exists=true` + total stake grew by N
 *   4. Unstake N WLP back into the wxa account
 *   5. View — confirm flat (stake_exists=false again iff started zero,
 *      or returns to pre-stake total otherwise)
 *
 * Demonstrates two more shapes of `simulateTransaction`:
 *   - `total_stake_amount(pool) → u64`  (raw simulate + bcs.u64 parse)
 *   - `stake_exists(pool, account) → bool`  (raw simulate + bcs.bool parse)
 *
 * The wxa account must already hold WLP (run smoke-happy-path's mintWlp
 * step first if not). Staking has no rewarders configured for the WLP
 * pool on testnet, so the `claim` path is skipped here.
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id you own with WLP balance
 *
 * Optional env:
 *   WATERX_STAKE_AMOUNT        raw u64 to stake/unstake, default 1_000_000
 *   WATERX_SKIP_STAKE=1        skip stake step
 *   WATERX_SKIP_UNSTAKE=1      skip unstake step
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { SENDER } from "../src/constants.ts";
import { isProtocolWhitelisted } from "../src/generated/waterx_account/account.ts";
import {
  stakeExists as stakeExistsCall,
  totalStakeAmount as totalStakeAmountCall,
} from "../src/generated/waterx_staking/waterx_staking.ts";
import { stake, unstake } from "../src/index.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

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

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
  commandResults?: { returnValues?: { bcs?: Uint8Array | string }[] }[] | null;
}

async function sim(
  client: WaterXClient,
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
  client: WaterXClient,
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

function poolId(client: WaterXClient, alias = "WLP"): string {
  const id = client.config.packages.waterx_staking?.pools?.[alias];
  if (!id) throw new Error(`waterx_staking.pools[${alias}] not set in config`);
  return id;
}

function stakingPkg(client: WaterXClient): string {
  const pkg = client.config.packages.waterx_staking?.published_at;
  if (!pkg) throw new Error("waterx_staking.published_at not set in config");
  return pkg;
}

/** Hand-rolled raw simulate against `waterx_staking::total_stake_amount`. */
async function readTotalStakeAmount(client: WaterXClient): Promise<bigint> {
  const tx = new Transaction();
  totalStakeAmountCall({
    package: stakingPkg(client),
    arguments: { self: tx.object(poolId(client)) },
    typeArguments: [client.wlpType()],
  })(tx);
  tx.setSender(SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  const b = r.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!b) throw new Error("total_stake_amount returned no BCS value");
  const bytes = typeof b === "string" ? fromBase64(b) : b;
  return BigInt(bcs.u64().parse(bytes));
}

/** Hand-rolled raw simulate against `waterx_staking::stake_exists`. */
async function readStakeExists(client: WaterXClient, accountId: string): Promise<boolean> {
  const tx = new Transaction();
  stakeExistsCall({
    package: stakingPkg(client),
    arguments: { self: tx.object(poolId(client)), account: accountId },
    typeArguments: [client.wlpType()],
  })(tx);
  tx.setSender(SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  const b = r.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!b) throw new Error("stake_exists returned no BCS value");
  const bytes = typeof b === "string" ? fromBase64(b) : b;
  return bcs.bool().parse(bytes);
}

async function snapshot(client: WaterXClient, accountId: string, label: string): Promise<void> {
  const total = await readTotalStakeAmount(client);
  const exists = await readStakeExists(client, accountId);
  console.log(`  ${label.padEnd(28)} total_stake=${total} stake_exists=${exists}`);
}

/**
 * Check whether `WaterXStaking` is in the AccountRegistry protocol whitelist.
 * If false, every `take`/`put` call routed through the staking witness will
 * abort with `EProtocolNotWhitelisted` — an admin must first call
 * `account::whitelist_protocol<WaterXStaking>(registry, &AdminCap)`.
 */
async function readStakingWhitelisted(client: WaterXClient): Promise<boolean> {
  const tx = new Transaction();
  const stakingPkgOrig = client.config.packages.waterx_staking?.original_id;
  if (!stakingPkgOrig) throw new Error("waterx_staking.original_id not set in config");
  const witnessType = `${stakingPkgOrig}::witness::WaterXStaking`;
  isProtocolWhitelisted({
    package: client.config.packages.waterx_account.published_at,
    arguments: { registry: tx.object(client.config.packages.waterx_account.account_registry) },
    typeArguments: [witnessType],
  })(tx);
  tx.setSender(SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  const b = r.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!b) throw new Error("is_protocol_whitelisted returned no BCS value");
  const bytes = typeof b === "string" ? fromBase64(b) : b;
  return bcs.bool().parse(bytes);
}

async function main(): Promise<void> {
  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) throw new Error("set WATERX_SMOKE_ACCOUNT_ID to a wxa account id you own");

  const { keypair, address } = loadActiveKeypair();
  console.log(`Sender:    ${address}`);
  console.log(`AccountId: ${accountId}`);

  const client = await WaterXClient.create("TESTNET", { cache: true });
  const stakeAmount = BigInt(process.env.WATERX_STAKE_AMOUNT ?? "1000000");
  const stakeAlias = process.env.WATERX_STAKE_ALIAS ?? "WLP";

  // ============================================================================
  // 1. Pre-flight view
  // ============================================================================
  console.log("\n=== Pre-flight (raw simulate) ===");
  await snapshot(client, accountId, "pre-flight");

  // stake/unstake go through the wxa `take`/`put` flow gated by a registry
  // protocol whitelist. If WaterXStaking isn't in it yet, every write
  // aborts with EProtocolNotWhitelisted — bail with a clear message.
  const whitelisted = await readStakingWhitelisted(client);
  console.log(`  waterx_staking whitelisted   ${whitelisted}`);
  if (!whitelisted) {
    console.warn(
      "\nWaterXStaking witness not whitelisted on AccountRegistry — stake/unstake will abort.\n" +
        "Admin must call: account::whitelist_protocol<WaterXStaking>(registry, &AdminCap)\n" +
        `  registry:  ${client.config.packages.waterx_account.account_registry}\n` +
        `  admin_cap: ${client.config.packages.waterx_account.admin_cap}\n`,
    );
    process.exit(2);
  }

  // ============================================================================
  // 2. Stake
  // ============================================================================
  if (process.env.WATERX_SKIP_STAKE !== "1") {
    console.log(`\n=== Stake ${stakeAmount} WLP ===`);
    const tx = new Transaction();
    stake(client, tx, {
      accountId,
      stakeAlias,
      stakeType: client.wlpType(),
      stakeAmount,
      rewarderTypes: [], // WLP pool has no rewarders configured on testnet
    });
    if (!(await sim(client, keypair, tx, "stake (sim)"))) process.exit(2);
    if (!(await execute(client, keypair, tx, "stake (execute)"))) process.exit(1);
    await snapshot(client, accountId, "post-stake");
  }

  // ============================================================================
  // 3. Unstake
  // ============================================================================
  if (process.env.WATERX_SKIP_UNSTAKE !== "1") {
    console.log(`\n=== Unstake ${stakeAmount} WLP ===`);
    const tx = new Transaction();
    unstake(client, tx, {
      accountId,
      stakeAlias,
      stakeType: client.wlpType(),
      withdrawalAmount: stakeAmount,
      rewarderTypes: [],
    });
    if (!(await sim(client, keypair, tx, "unstake (sim)"))) process.exit(2);
    if (!(await execute(client, keypair, tx, "unstake (execute)"))) process.exit(1);
    await snapshot(client, accountId, "post-unstake");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
