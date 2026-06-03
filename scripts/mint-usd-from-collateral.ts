/**
 * Convert collateral assets → USD CREDIT via `native_custody`.
 *
 * Mints USD CREDIT from EVERY backing asset registered on the custody vault,
 * one `mint` + `consume_deposit_direct` leg per asset in a single PTB. On
 * testnet the vault assets are MOCK_USDC + MOCK_USDSUI; on mainnet they are
 * the real USDC / USDSUI coins — the asset list is read from
 * `config.packages.native_custody.assets`, so this script is network-agnostic.
 *
 * Flow (single PTB), per targeted asset C:
 *   1. split `MINT_AMOUNT` raw units off your largest Coin<C>
 *   2. custody_vault::mint<C, USD>                     — get DepositRequest<USD>
 *   3. direct_rule::consume_deposit_direct<USD>        — settle USD into wxa account
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id that will receive the USD credit
 *
 * Optional env:
 *   MINT_AMOUNT                raw units to convert per asset (default 1_000_000 = 1 token, 6 decimals)
 *   MINT_ASSETS                comma-separated asset-name substrings to target
 *                              (case-insensitive, e.g. "usdc,usdsui"); default = every vault asset
 *   ALLOW_MISSING_ASSET=1      skip (warn) a targeted asset the wallet has no coin for,
 *                              instead of aborting; needs ≥1 asset minted to proceed
 *   EXECUTE=1                  actually sign + execute (otherwise simulate only)
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/mint-usd-from-collateral.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/mint-usd-from-collateral.ts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { mintCreditToAccount } from "../src/user/custody.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

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

/** First spendable coin of `coinType` owned by `owner`, with its balance. */
async function pickCoin(
  client: WaterXClient,
  owner: string,
  coinType: string,
): Promise<{ objectId: string; balance: bigint } | undefined> {
  const res = (await client.grpcClient.listCoins({ owner, coinType })) as {
    objects?: { objectId?: string; coinObjectId?: string; balance?: string | number }[];
    coins?: { objectId?: string; coinObjectId?: string; balance?: string | number }[];
  };
  if (process.env.DEBUG_COINS === "1") {
    console.log("listCoins raw:", JSON.stringify(res, null, 2));
  }
  const list = res.objects ?? res.coins ?? [];
  let best: { objectId: string; balance: bigint } | undefined;
  for (const c of list) {
    const id = c.objectId ?? c.coinObjectId;
    if (!id) continue;
    const balance = BigInt(c.balance ?? 0);
    if (!best || balance > best.balance) best = { objectId: id, balance };
  }
  return best;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const { keypair, address } = loadActiveKeypair();

  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "mint-usd-from-collateral: WATERX_SMOKE_ACCOUNT_ID is required. " +
        "Run scripts/create-wxa-account.ts first and export the printed id.",
    );
  }
  const amount = BigInt(process.env.MINT_AMOUNT ?? "1000000");
  const doExecute = process.env.EXECUTE === "1";
  const allowMissing = process.env.ALLOW_MISSING_ASSET === "1";
  // Comma-separated name/type substrings to target (case-insensitive); empty = every vault asset.
  const filters = (process.env.MINT_ASSETS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const client = await WaterXClient.create("TESTNET", { cache: true });

  const custody = client.config.packages.native_custody;
  const credit = client.config.packages.waterx_credit;
  if (!custody?.vault || !credit?.credit_type) {
    throw new Error("native_custody / waterx_credit not configured on this network");
  }

  const assetMatches = (a: { name?: string; type: string }): boolean =>
    filters.length === 0 ||
    filters.some(
      (f) => a.type.toLowerCase().includes(f) || (a.name ?? "").toLowerCase().includes(f),
    );
  const targeted = custody.assets.filter(assetMatches);
  if (targeted.length === 0) {
    throw new Error(
      `mint-usd-from-collateral: no vault asset matched MINT_ASSETS="${process.env.MINT_ASSETS ?? ""}". ` +
        `Available: ${custody.assets.map((a) => a.name ?? a.type).join(", ")}`,
    );
  }

  console.log(`sender:      ${address}`);
  console.log(`account:     ${accountId}`);
  console.log(`vault:       ${custody.vault}`);
  console.log(`credit:      ${credit.credit_type}`);
  console.log(`mint raw:    ${amount} per asset`);
  console.log(`assets:      ${targeted.map((a) => a.name ?? a.type).join(", ")}`);
  console.log(`mode:        ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const tx = new Transaction();
  const minted: string[] = [];
  const skipped: string[] = [];

  for (const asset of targeted) {
    const label = asset.name ?? asset.type.split("::").slice(-1)[0] ?? asset.type;
    const coin = await pickCoin(client, address, asset.type);
    if (!coin || coin.balance < amount) {
      const reason = !coin
        ? `no Coin<${label}> in wallet ${address} (mint from the faucet first)`
        : `Coin<${label}> balance ${coin.balance} < requested ${amount} (object ${coin.objectId})`;
      if (allowMissing) {
        console.warn(`  ⚠ skip ${label}: ${reason}`);
        skipped.push(label);
        continue;
      }
      throw new Error(
        `mint-usd-from-collateral: ${reason}. ` +
          `Top up the coin, lower MINT_AMOUNT, or set ALLOW_MISSING_ASSET=1 to skip it.`,
      );
    }

    console.log(`  + ${label}: split ${amount} off ${coin.objectId} (balance ${coin.balance})`);
    const [assetCoin] = tx.splitCoins(tx.object(coin.objectId), [tx.pure.u64(amount)]);
    mintCreditToAccount(client, tx, {
      accountId,
      assetCoin: assetCoin!,
      assetType: asset.type,
    });
    minted.push(label);
  }

  if (minted.length === 0) {
    throw new Error(
      `mint-usd-from-collateral: every targeted asset was skipped (${skipped.join(", ")}); nothing to mint.`,
    );
  }

  tx.setSender(address);

  console.log("\nsimulating…");
  const sim = (await client.simulate(tx)) as {
    $kind?: string;
    FailedTransaction?: { status?: { error?: { message?: string } } };
  };
  if (sim.$kind === "FailedTransaction") {
    const msg = sim.FailedTransaction?.status?.error?.message ?? "(no msg)";
    throw new Error(`simulate aborted: ${msg}`);
  }
  console.log("  ✓ simulate ok");

  if (!doExecute) {
    console.log("\nEXECUTE != 1 — stopping after simulate. Set EXECUTE=1 to broadcast.");
    return;
  }

  console.log("\nexecuting…");
  const r = (await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
  })) as {
    Transaction?: { digest?: string; status?: { success?: boolean; error?: string | null } };
  };
  const digest = r.Transaction?.digest ?? "";
  const success = r.Transaction?.status?.success === true;
  if (!success) {
    throw new Error(`execute failed: ${r.Transaction?.status?.error ?? "(no error)"} ${digest}`);
  }
  console.log(`  ✓ executed  digest=${digest}`);
  await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 }).catch(() => {});
  console.log(
    `\nUSD credit minted from [${minted.join(", ")}] settled into wxa account ${accountId}.` +
      (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : "") +
      `\nView on https://suiscan.xyz/testnet/tx/${digest}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
