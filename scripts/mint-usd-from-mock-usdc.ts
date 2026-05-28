/**
 * Convert MOCK_USDC → USD via `native_custody` on testnet.
 *
 * Flow (single PTB):
 *   1. split `MINT_AMOUNT` raw units off your first Coin<MOCK_USDC>
 *   2. custody_vault::mint<MOCK_USDC, USD>             — get DepositRequest<USD>
 *   3. direct_rule::consume_deposit_direct<USD>        — settle USD into wxa account
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id that will receive the USD credit
 *
 * Optional env:
 *   MINT_AMOUNT                raw MOCK_USDC units to convert (default 1_000_000 = 1 USDC, 6 decimals)
 *   EXECUTE=1                  actually sign + execute (otherwise simulate only)
 *
 * Run:
 *   WATERX_SMOKE_ACCOUNT_ID=0x… pnpm exec tsx scripts/mint-usd-from-mock-usdc.ts
 *   WATERX_SMOKE_ACCOUNT_ID=0x… EXECUTE=1 pnpm exec tsx scripts/mint-usd-from-mock-usdc.ts
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
      "mint-usd-from-mock-usdc: WATERX_SMOKE_ACCOUNT_ID is required. " +
        "Run scripts/create-wxa-account.ts first and export the printed id.",
    );
  }
  const amount = BigInt(process.env.MINT_AMOUNT ?? "1000000");
  const doExecute = process.env.EXECUTE === "1";

  const client = await WaterXClient.create("TESTNET", { cache: true });

  const custody = client.config.packages.native_custody;
  const credit = client.config.packages.waterx_credit;
  if (!custody?.vault || !credit?.credit_type) {
    throw new Error("native_custody / waterx_credit not configured on this network");
  }

  const asset =
    custody.assets.find((a) => a.type.toLowerCase().includes("::mock_usdc::")) ?? custody.assets[0];
  if (!asset) throw new Error("no backing assets registered on the vault");
  const assetLabel = asset.type.split("::").slice(-1)[0] ?? asset.type;
  if (!asset.type.toLowerCase().includes("::mock_usdc::")) {
    console.warn(`note: MOCK_USDC not registered, falling back to ${assetLabel}`);
  }

  console.log(`sender:      ${address}`);
  console.log(`account:     ${accountId}`);
  console.log(`vault:       ${custody.vault}`);
  console.log(`asset:       ${asset.type}`);
  console.log(`credit:      ${credit.credit_type}`);
  console.log(`mint raw:    ${amount} (decimals=${asset.decimal})`);
  console.log(`mode:        ${doExecute ? "SIM + EXECUTE" : "SIM only"}`);

  const coin = await pickCoin(client, address, asset.type);
  if (!coin) {
    throw new Error(
      `mint-usd-from-mock-usdc: no Coin<${assetLabel}> in wallet ${address}. ` +
        `Mint MOCK_USDC from the testnet faucet first.`,
    );
  }
  if (coin.balance < amount) {
    throw new Error(
      `mint-usd-from-mock-usdc: Coin<${assetLabel}> balance ${coin.balance} < requested ${amount} ` +
        `(object ${coin.objectId}). Top up MOCK_USDC or lower MINT_AMOUNT.`,
    );
  }
  console.log(`source coin: ${coin.objectId} (balance ${coin.balance})`);

  const tx = new Transaction();
  const [assetCoin] = tx.splitCoins(tx.object(coin.objectId), [tx.pure.u64(amount)]);

  mintCreditToAccount(client, tx, {
    accountId,
    assetCoin: assetCoin!,
    assetType: asset.type,
  });

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
    `\nUSD credit settled into wxa account ${accountId}. View on https://suiscan.xyz/testnet/tx/${digest}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
