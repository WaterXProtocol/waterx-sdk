/**
 * Native-custody (CREDIT PSM) smoke against testnet.
 *
 * Vault reads (always run, side-effect free — raw simulate + BCS decode):
 *   - creditSupply(vault)        total CREDIT minted by the vault
 *   - hasAsset(vault, T)         is backing asset T registered, per config asset
 *
 * Write builders from src/user/custody.ts:
 *   - mintCreditToAccount(...)   Coin<T> → CREDIT, settled into a wxa account
 *   - burnCredit(...)            Coin<CREDIT> → Coin<T>
 *
 * The write steps need a wxa account plus a spendable coin, so they only run
 * when WATERX_SMOKE_ACCOUNT_ID is set; each step is skipped with a note if no
 * matching coin is found in the sender's wallet. Writes are SIMULATED by
 * default — opt into real execution with WATERX_CUSTODY_EXECUTE=1. A simulate
 * that aborts on-chain still counts as a green dispatch.
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/smoke-custody.ts
 *
 * Optional env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id you own — enables mint/burn steps
 *   WATERX_CUSTODY_EXECUTE=1   actually sign + execute the write PTBs
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { DRY_RUN_SENDER } from "../src/constants.ts";
import { creditSupply, hasAsset } from "../src/generated/native_custody/custody_vault.ts";
import { burnCredit, mintCreditToAccount } from "../src/index.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

/** Raw units split off a discovered coin for the write-builder dry-runs. */
const SMOKE_AMOUNT = 1000n;

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

type SimOutcome = "ok" | "aborted" | "error";

/** Dry-run a write PTB; an on-chain abort is reported, not treated as failure. */
async function sim(
  client: WaterXClient,
  sender: string,
  tx: Transaction,
  label: string,
): Promise<SimOutcome> {
  tx.setSender(sender);
  let r: SimResult;
  try {
    r = (await client.simulate(tx)) as unknown as SimResult;
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m ${label.padEnd(30)} sdk error: ${String(e).slice(0, 200)}`);
    return "error";
  }
  if (r.$kind === "FailedTransaction") {
    const msg = r.FailedTransaction?.status?.error?.message?.slice(0, 220) ?? "(no msg)";
    console.log(`  \x1b[33m●\x1b[0m ${label.padEnd(30)} aborted on-chain: ${msg}`);
    return "aborted";
  }
  console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(30)} sim ok`);
  return "ok";
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
    `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(30)} ${digest || "(no digest)"} ${success ? "" : (r.Transaction?.status?.error ?? "")}`,
  );
  if (digest) {
    await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  }
  return success;
}

/** Raw simulate of a single getter move call, decoded with `decode`. */
async function readGetter<T>(
  client: WaterXClient,
  build: (tx: Transaction) => void,
  decode: (bytes: Uint8Array) => T,
): Promise<T> {
  const tx = new Transaction();
  build(tx);
  tx.setSender(DRY_RUN_SENDER);
  const r = (await client.simulate(tx)) as unknown as SimResult;
  if (r.$kind === "FailedTransaction") {
    throw new Error(
      r.FailedTransaction?.status?.error?.message?.slice(0, 200) ?? "simulate failed",
    );
  }
  const b = r.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!b) throw new Error("getter returned no BCS value");
  return decode(typeof b === "string" ? fromBase64(b) : b);
}

/** First spendable coin of `coinType` owned by `owner`, or undefined. */
async function firstCoin(
  client: WaterXClient,
  owner: string,
  coinType: string,
): Promise<string | undefined> {
  const res = (await client.grpcClient.listCoins({ owner, coinType })) as {
    objects?: { objectId?: string; coinObjectId?: string }[];
    coins?: { objectId?: string; coinObjectId?: string }[];
  };
  const list = res.objects ?? res.coins ?? [];
  const coin = list[0];
  return coin?.objectId ?? coin?.coinObjectId;
}

async function main(): Promise<void> {
  const { keypair, address } = loadActiveKeypair();
  const client = await WaterXClient.create("TESTNET", { cache: true });

  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  const doExecute = process.env.WATERX_CUSTODY_EXECUTE === "1";

  const credit = client.config.packages.waterx_credit;
  const custody = client.config.packages.native_custody;
  if (!credit || !custody?.vault) {
    throw new Error(
      "waterx_credit / native_custody.vault not in config — credit pipeline unavailable",
    );
  }
  const vault = custody.vault;
  const creditType = client.creditType();

  console.log(`Sender:        ${address}`);
  console.log(`credit pkg:    ${credit.published_at}`);
  console.log(`credit type:   ${creditType}`);
  console.log(`custody vault: ${custody.vault}`);
  console.log(`assets:        ${custody.assets.map((a) => a.type).join(", ") || "(none)"}`);
  console.log(`mode:          ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  // ==========================================================================
  // 1. Vault reads — side-effect free, always run
  // ==========================================================================
  console.log("\n=== Vault reads ===");
  const supply = await readGetter(
    client,
    (tx) =>
      creditSupply({
        package: custody.published_at,
        arguments: { vault: tx.object(vault) },
        typeArguments: [creditType],
      })(tx),
    (b) => BigInt(bcs.u64().parse(b)),
  );
  console.log(`  creditSupply(vault)              ${supply}`);
  for (const asset of custody.assets) {
    const present = await readGetter(
      client,
      (tx) =>
        hasAsset({
          package: custody.published_at,
          arguments: { vault: tx.object(vault) },
          typeArguments: [asset.type, creditType],
        })(tx),
      (b) => bcs.bool().parse(b),
    );
    console.log(
      `  hasAsset(${asset.type.split("::").slice(-1)[0]})${" ".repeat(Math.max(1, 22 - (asset.type.split("::").slice(-1)[0]?.length ?? 0)))}${present}`,
    );
  }

  if (!accountId) {
    console.log("\nWATERX_SMOKE_ACCOUNT_ID not set — skipping mint / burn write steps.");
    console.log("\nDone.");
    return;
  }

  // ==========================================================================
  // 2. mintCreditToAccount — Coin<T> → CREDIT into the wxa account
  // ==========================================================================
  const asset = custody.assets[0];
  console.log(`\n=== mintCreditToAccount (${asset?.type.split("::").slice(-1)[0] ?? "?"}) ===`);
  if (!asset) {
    console.log("  no backing asset registered in config — skipped");
  } else {
    const coinId = await firstCoin(client, address, asset.type);
    if (!coinId) {
      console.log(`  no Coin<${asset.type.split("::").slice(-1)[0]}> in wallet — skipped`);
    } else {
      const tx = new Transaction();
      const [part] = tx.splitCoins(tx.object(coinId), [tx.pure.u64(SMOKE_AMOUNT)]);
      mintCreditToAccount(client, tx, {
        accountId,
        assetCoin: part!,
        assetType: asset.type,
      });
      const outcome = await sim(client, address, tx, "mintCreditToAccount (sim)");
      if (doExecute && outcome === "ok") {
        await execute(client, keypair, tx, "mintCreditToAccount (execute)");
      }
    }
  }

  // ==========================================================================
  // 3. burnCredit — Coin<CREDIT> → Coin<T>, redeemed coin returned to sender
  // ==========================================================================
  console.log("\n=== burnCredit ===");
  if (!asset) {
    console.log("  no backing asset registered in config — skipped");
  } else {
    const creditCoinId = await firstCoin(client, address, creditType);
    if (!creditCoinId) {
      console.log("  no Coin<CREDIT> in wallet — skipped");
    } else {
      const tx = new Transaction();
      const [part] = tx.splitCoins(tx.object(creditCoinId), [tx.pure.u64(SMOKE_AMOUNT)]);
      const redeemed = burnCredit(client, tx, {
        accountId,
        creditCoin: part!,
        assetType: asset.type,
      });
      tx.transferObjects([redeemed as unknown as TransactionObjectArgument], address);
      const outcome = await sim(client, address, tx, "burnCredit (sim)");
      if (doExecute && outcome === "ok") {
        await execute(client, keypair, tx, "burnCredit (execute)");
      }
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
