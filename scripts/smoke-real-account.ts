/**
 * Real-account smoke: creates a wxa account on testnet under the local
 * `sui client active-address`, then runs read + write builders against it.
 *
 *   tsx scripts/smoke-real-account.ts
 *
 * Reads the active Sui CLI address + its keypair from `~/.sui/sui_config/`,
 * builds & signs every PTB itself (never echoes secrets). Outputs digests
 * and the discovered account id.
 *
 * Optional env:
 *   - WATERX_SMOKE_ACCOUNT_ID   reuse an existing wxa account instead of
 *                                creating a new one (saves gas).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { ORDER_TAG_WILDCARD, rawPrice } from "../src/constants.ts";
import {
  getAccountData,
  getAccountOrders,
  getAccountPositions,
  getRefererFor,
  isValidReferralCode,
  referralCodeExists,
} from "../src/fetch.ts";
import {
  cancelOrderRequest,
  closePositionRequest,
  createAccount,
  executeTrading,
  placeOrderRequest,
} from "../src/index.ts";
import { refreshOraclePrices } from "../src/utils/pyth.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");

function loadActiveKeypair(): { keypair: Ed25519Keypair; address: string } {
  // Read client.yaml WITHOUT logging it.
  const yaml = readFileSync(CLIENT_YAML, "utf8");
  const m = /active_address:\s*"?(0x[a-f0-9]+)"?/i.exec(yaml);
  if (!m) throw new Error("could not parse active_address from client.yaml");
  const activeAddress = m[1]!.toLowerCase();

  // Legacy Sui keystore: JSON array of base64-encoded `[flag, ...32-byte-secret]`
  // where flag === 0x00 → Ed25519, 0x01 → Secp256k1, 0x02 → Secp256r1.
  const keystore = JSON.parse(readFileSync(KEYSTORE, "utf8")) as string[];
  for (const encoded of keystore) {
    const raw = fromBase64(encoded);
    if (raw.length !== 33 || raw[0] !== 0x00) continue; // ed25519 only
    const secret = raw.slice(1);
    const kp = Ed25519Keypair.fromSecretKey(secret);
    if (kp.toSuiAddress().toLowerCase() === activeAddress) {
      return { keypair: kp, address: kp.toSuiAddress() };
    }
  }
  throw new Error(`no ED25519 key in keystore matches active address ${activeAddress}`);
}

async function signAndExecute(
  client: WaterXClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
): Promise<{ digest: string; success: boolean; events: unknown[] }> {
  tx.setSender(signer.toSuiAddress());
  const result = (await client.signAndExecuteTransaction({
    signer,
    transaction: tx,
  })) as {
    $kind?: string;
    Transaction?: {
      digest?: string;
      status?: { success?: boolean; error?: string | null };
    };
  };

  const digest = result.Transaction?.digest ?? "";
  const success = result.Transaction?.status?.success === true;
  const errMsg = result.Transaction?.status?.error ?? "";

  console.log(
    `  ${success ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label.padEnd(28)} ${digest || "(no digest)"} ${success ? "" : errMsg}`,
  );

  // Pull events for the digest so we can extract the new account_object_address.
  let events: unknown[] = [];
  if (success && digest) {
    // Wait for the fullnode to index the transaction (executed via dispatch,
    // but read APIs lag the dispatch). Then re-fetch with events.
    try {
      await client.grpcClient.waitForTransaction({ digest, timeout: 30_000 });
    } catch (e) {
      console.warn(`  (waitForTransaction timeout: ${String(e).slice(0, 120)})`);
    }
    try {
      const detail = (await client.grpcClient.getTransaction({
        digest,
        include: { events: true, objectChanges: true } as never,
      })) as Record<string, unknown>;
      if (process.env.WATERX_SMOKE_DEBUG === "1") {
        console.log(
          JSON.stringify(detail, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2).slice(
            0,
            4000,
          ),
        );
      }
      const e1 = (detail.events ?? []) as unknown[];
      const e2 = ((detail.transaction as { events?: unknown[] } | undefined)?.events ??
        []) as unknown[];
      events = e1.length ? e1 : e2;
    } catch (e) {
      console.warn(`  (could not fetch events for ${digest}: ${String(e).slice(0, 200)})`);
    }
  }
  return { digest, success, events };
}

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
}

async function simulate(
  client: WaterXClient,
  signer: Ed25519Keypair,
  tx: Transaction,
  label: string,
) {
  tx.setSender(signer.toSuiAddress());
  const sim = (await client.simulate(tx)) as unknown as SimResult;
  if (sim.$kind === "FailedTransaction") {
    const msg = sim.FailedTransaction?.status?.error?.message?.slice(0, 200) ?? "(no msg)";
    console.log(`  \x1b[33m●\x1b[0m ${label.padEnd(28)} aborted: ${msg}`);
  } else {
    console.log(`  \x1b[32m✓\x1b[0m ${label.padEnd(28)} simulate ok`);
  }
}

async function main(): Promise<void> {
  console.log("=== Loading local Sui CLI signer ===");
  const { keypair, address } = loadActiveKeypair();
  console.log(`  sender: ${address}`);

  const client = await WaterXClient.create("TESTNET", { cache: true });
  console.log(`  config: testnet@${client.config.chain_id}`);

  // 1. Get-or-create the wxa account.
  let accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) {
    console.log("\n=== Creating wxa account ===");
    const tx = new Transaction();
    createAccount(client, tx, { alias: "sdk-smoke" });
    const res = await signAndExecute(client, keypair, tx, "createAccount");
    if (!res.success) {
      throw new Error("createAccount failed; cannot proceed with real-account smoke");
    }
    // Find the new account id from SubAccountCreated / AccountCreated events.
    interface EventLite {
      type?: string;
      parsedJson?: { account_object_address?: string };
    }
    const evs = (res.events ?? []) as EventLite[];
    const acctEvt = evs.find(
      (e) =>
        (e.type ?? "").includes("AccountCreated") || (e.type ?? "").includes("SubAccountCreated"),
    );
    accountId = acctEvt?.parsedJson?.account_object_address;
    if (!accountId) {
      throw new Error(
        `createAccount succeeded but no AccountCreated event found in tx ${res.digest}`,
      );
    }
    console.log(`  new accountId: ${accountId}`);
  } else {
    console.log(`\n=== Reusing accountId from env: ${accountId} ===`);
  }

  // 2a. AccountData read — confirms the wxa registry view path works against
  //     a real registered account.
  console.log("\n=== AccountData / view reads ===");
  try {
    const data = await getAccountData(client, accountId);
    if (!data) {
      console.log(
        `  getAccountData                   None (no perp data slot — never opened position / order)`,
      );
    } else {
      console.log(
        `  getAccountData                   account_id=${data.account_id} account_object_address=${data.account_object_address}`,
      );
    }
  } catch (e) {
    console.log(`  getAccountData                   FAIL: ${String(e).slice(0, 200)}`);
  }
  try {
    const positions = await getAccountPositions(client, {
      ticker: "BTCUSD",
      accountObjectAddress: accountId,
      basePriceUsd: 0n,
    });
    console.log(`  getAccountPositions(BTC)         ${positions.length} positions`);
  } catch (e) {
    console.log(`  getAccountPositions(BTC)         FAIL: ${String(e).slice(0, 200)}`);
  }
  try {
    const orders = await getAccountOrders(client, {
      ticker: "BTCUSD",
      accountObjectAddress: accountId,
    });
    console.log(`  getAccountOrders(BTC)            ${orders.length} orders`);
  } catch (e) {
    console.log(`  getAccountOrders(BTC)            FAIL: ${String(e).slice(0, 200)}`);
  }

  // 2b. Referral reads (no on-chain state needed)
  console.log("\n=== Referral read helpers ===");
  console.log(`  isValidReferralCode("smoke"):    ${await isValidReferralCode(client, "smoke")}`);
  console.log(`  referralCodeExists("smoke"):     ${await referralCodeExists(client, "smoke")}`);
  console.log(
    `  getRefererFor(sender):           ${(await getRefererFor(client, address)) ?? "(none)"}`,
  );

  // 3. Trading builders — these all simulate (no execute), since the account
  //    has no collateral yet so they'd abort anyway. The point is that the
  //    real account passes the wxa auth check (we expect EPositionNotFound /
  //    EOrderNotFound / EInsufficientBalance rather than EUnauthorized).
  const BTC = "BTCUSD";
  const USDC = client.getPoolTokenType("USDCUSD");

  console.log("\n=== Trading PTBs (simulate-only) ===");

  {
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, [BTC, "USDCUSD"]);
    const req = closePositionRequest(client, tx, {
      ticker: BTC,
      collateralType: USDC,
      accountId,
      positionId: 1n,
      acceptablePrice: rawPrice(60000),
    });
    executeTrading(client, tx, { ticker: BTC, collateralType: USDC, request: req });
    await simulate(client, keypair, tx, "closePosition(fake)");
  }

  {
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, [BTC, "USDCUSD"]);
    const req = placeOrderRequest(client, tx, {
      ticker: BTC,
      collateralType: USDC,
      accountId,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.01),
        triggerPrice: undefined,
        acceptablePrice: rawPrice(70000),
        collateralAmount: 1_000_000n,
      },
      preOrders: [],
    });
    executeTrading(client, tx, { ticker: BTC, collateralType: USDC, request: req });
    await simulate(client, keypair, tx, "placeOrder(market)");
  }

  {
    const tx = new Transaction();
    await refreshOraclePrices(tx, client, [BTC, "USDCUSD"]);
    const req = cancelOrderRequest(client, tx, {
      ticker: BTC,
      collateralType: USDC,
      accountId,
      orderId: 1n,
      triggerPrice: 0n,
      orderTypeTag: ORDER_TAG_WILDCARD,
    });
    executeTrading(client, tx, { ticker: BTC, collateralType: USDC, request: req });
    await simulate(client, keypair, tx, "cancelOrder(wildcard)");
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
