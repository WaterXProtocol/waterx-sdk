/**
 * Happy-path smoke against a real wxa account on testnet:
 *   1. Deposit USD into the wxa account (request_deposit + consume_deposit_direct)
 *   2. Mint WLP into the WLP pool from the wxa account's USD balance — this
 *      seeds the pool with LP liquidity so positions have reserve room.
 *   3. Place a limit buy via buildPlaceOrderTx (auto-wires pyth_sponsor_rule).
 *   4. Cancel the order via buildCancelOrderTx.
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id you own
 *
 * Optional env:
 *   WATERX_DEPOSIT_AMOUNT      raw USD to deposit, default 50_000_000 (50 USD)
 *   WATERX_MINT_WLP_AMOUNT     raw USD to convert to WLP, default 30_000_000
 *   WATERX_ORDER_SIZE          raw 1e9-scaled Float, default rawPrice(0.0001)
 *   WATERX_ORDER_PRICE         raw 1e9-scaled Float, default rawPrice(60000)
 *   WATERX_ORDER_COLLATERAL    raw USD amount for order, default 5_000_000
 *   WATERX_ORDER_ID            order id for cancel step (auto-extracted)
 *   WATERX_SKIP_DEPOSIT=1      skip deposit
 *   WATERX_SKIP_MINT=1         skip mintWlp
 *   WATERX_SKIP_PLACE=1        skip placeOrder
 *   WATERX_SKIP_CANCEL=1       skip cancelOrder
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { ORDER_LIMIT_BUY } from "../src/constants.ts";
import { consumeDepositDirect } from "../src/generated/waterx_account/direct_rule.ts";
import {
  buildCancelOrderTx,
  buildMintWlpTx,
  buildPlaceOrderTx,
  getAccountBalance,
  requestDeposit,
} from "../src/index.ts";
import { rawPrice } from "../src/utils/math.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";
import { loadActiveKeypair } from "./load-signer.ts";
import { makeSmokeClient } from "./make-smoke-client.ts";

interface SimResult {
  $kind?: string;
  FailedTransaction?: { status?: { error?: { message?: string } } };
}

async function sim(client: WaterXClient, signer: Ed25519Keypair, tx: Transaction, label: string) {
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
): Promise<{ digest: string; success: boolean }> {
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
  return { digest, success };
}

/**
 * Read events via the JSON-RPC fallback (gRPC `getTransaction` doesn't
 * include events on testnet at the moment). Returns parsedJson by type
 * suffix.
 */
async function extractOrderId(digest: string): Promise<bigint | undefined> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "sui_getTransactionBlock",
    params: [digest, { showEvents: true }],
  });
  const res = await fetch("https://fullnode.testnet.sui.io:443", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const json = (await res.json()) as {
    result?: { events?: { type?: string; parsedJson?: Record<string, unknown> }[] };
  };
  const events = json.result?.events ?? [];
  const ev = events.find((e) => (e.type ?? "").endsWith("::events::OrderCreated"));
  const raw = ev?.parsedJson?.order_id as string | undefined;
  return raw ? BigInt(raw) : undefined;
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "smoke-happy-path: WATERX_SMOKE_ACCOUNT_ID is required. " +
        "Run scripts/create-wxa-account.ts first.",
    );
  }

  const { keypair, address } = loadActiveKeypair();
  console.log(`Sender:    ${address}`);
  console.log(`AccountId: ${accountId}`);

  const client = await makeSmokeClient();
  const usdcType = client.getPoolTokenType("USD");

  // ============================================================================
  // 1. Deposit USDC into the wxa account
  // ============================================================================
  const depositAmount = BigInt(process.env.WATERX_DEPOSIT_AMOUNT ?? "50000000"); // 50 USD @ 6 dec
  // Downstream USD draws from the account balance: WLP mint (step 2) + the
  // order collateral (step 3). The deposit step tops the account up from a
  // wallet Coin<USD>, but in the smoke chain mint-usd-from-collateral already
  // funded the account — so if there's no wallet coin we skip rather than fail,
  // as long as the account balance already covers the downstream needs.
  const mintAmount = BigInt(process.env.WATERX_MINT_WLP_AMOUNT ?? "30000000"); // 30 USD
  const orderCollateral = BigInt(process.env.WATERX_ORDER_COLLATERAL ?? "5000000"); // 5 USD
  const downstreamNeed = mintAmount + orderCollateral;
  if (process.env.WATERX_SKIP_DEPOSIT !== "1") {
    console.log(`\n=== Deposit ${depositAmount} USD → wxa account ===`);
    const coins = (await client.grpcClient.listCoins({ owner: address, coinType: usdcType })) as {
      objects?: { objectId?: string; balance?: string }[];
      coins?: { coinObjectId?: string; balance?: string }[];
    };
    const list = (coins.objects ?? coins.coins ?? []) as {
      objectId?: string;
      coinObjectId?: string;
      balance?: string;
    }[];
    const candidates = list
      .map((c) => ({ id: c.objectId ?? c.coinObjectId, bal: BigInt(c.balance ?? "0") }))
      .filter((c): c is { id: string; bal: bigint } => Boolean(c.id))
      .sort((a, b) => (b.bal > a.bal ? 1 : -1));
    const picked = candidates[0];
    if (!picked || picked.bal < depositAmount) {
      // No usable wallet Coin<USD> — fall back to the existing account balance.
      const accBal = await getAccountBalance(client, accountId, usdcType);
      if (accBal >= downstreamNeed) {
        const why = picked
          ? `wallet coin ${picked.bal} < deposit ${depositAmount}`
          : "no wallet Coin<USD>";
        console.log(
          `  skip deposit (${why}); account already holds ${accBal} USD ≥ downstream need ${downstreamNeed}`,
        );
      } else {
        throw new Error(
          `no usable wallet Coin<${usdcType}> for ${address} and account balance ${accBal} < downstream need ${downstreamNeed} — ` +
            `fund the wallet with USD or lower WATERX_MINT_WLP_AMOUNT / WATERX_ORDER_COLLATERAL`,
        );
      }
    } else {
      console.log(`  using coin ${picked.id} (balance ${picked.bal})`);

      const tx = new Transaction();
      const [chunk] = tx.splitCoins(tx.object(picked.id), [tx.pure.u64(depositAmount)]);
      const req = requestDeposit(client, tx, {
        accountId,
        coin: chunk as unknown as TransactionArgument,
        coinType: usdcType,
      });
      consumeDepositDirect({
        package: client.config.packages.waterx_account.published_at,
        arguments: {
          registry: tx.object(client.config.packages.waterx_account.account_registry),
          req: req as unknown as string,
        },
        typeArguments: [usdcType],
      })(tx);

      if (!(await sim(client, keypair, tx, "deposit (sim)"))) process.exit(2);
      const r = await execute(client, keypair, tx, "deposit (execute)");
      if (!r.success) process.exit(1);
    }
  }

  // ============================================================================
  // 2. Mint WLP from the wxa account's USD balance — seeds the pool with LP
  //    liquidity so the placeOrder step has reserve room.
  // ============================================================================
  if (process.env.WATERX_SKIP_MINT !== "1") {
    console.log(`\n=== Mint WLP from ${mintAmount} USD ===`);
    const mintTx = await buildMintWlpTx(client, {
      accountId,
      depositTokenType: usdcType,
      depositTicker: "USDCUSD",
      depositAmount: mintAmount,
      minLpAmount: 0n,
    });
    if (!(await sim(client, keypair, mintTx, "mintWlp (sim)"))) process.exit(2);
    const r = await execute(client, keypair, mintTx, "mintWlp (execute)");
    if (!r.success) process.exit(1);
  }

  if (process.env.WATERX_SKIP_PLACE === "1") {
    console.log("\nWATERX_SKIP_PLACE=1; stopping after mint.");
    return;
  }

  // ============================================================================
  // 3. Place limit BTC LONG (auto-wires pyth_sponsor_rule)
  // ============================================================================
  const orderSize = BigInt(process.env.WATERX_ORDER_SIZE ?? rawPrice(0.0001).toString());
  const orderPrice = BigInt(process.env.WATERX_ORDER_PRICE ?? rawPrice(60000).toString());
  console.log(
    `\n=== Place limit BTC LONG size=${orderSize} px=${orderPrice} collateral=${orderCollateral} ===`,
  );

  const placeTx = await buildPlaceOrderTx(client, {
    ticker: "BTCUSD",
    collateralType: usdcType,
    accountId,
    main: {
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: orderSize,
      triggerPrice: orderPrice,
      acceptablePrice: undefined,
      collateralAmount: orderCollateral,
    },
    preOrders: [],
  });

  if (!(await sim(client, keypair, placeTx, "placeOrder (sim)"))) {
    console.error("placeOrder failed at sim; not executing");
    process.exit(2);
  }
  const placeRes = await execute(client, keypair, placeTx, "placeOrder (execute)");
  if (!placeRes.success) process.exit(1);

  if (process.env.WATERX_SKIP_CANCEL === "1") {
    console.log("\nWATERX_SKIP_CANCEL=1; stopping after place.");
    return;
  }

  // ============================================================================
  // 4. Cancel the order (extracts order_id from OrderCreated event)
  // ============================================================================
  const orderId =
    process.env.WATERX_ORDER_ID !== undefined
      ? BigInt(process.env.WATERX_ORDER_ID)
      : await extractOrderId(placeRes.digest);
  if (orderId === undefined) {
    console.warn(
      "could not extract orderId from OrderCreated event; pass WATERX_ORDER_ID to cancel manually",
    );
    return;
  }
  console.log(`\n=== Cancel orderId=${orderId} ===`);
  const cancelTx = await buildCancelOrderTx(client, {
    ticker: "BTCUSD",
    collateralType: usdcType,
    accountId,
    orderId,
    triggerPrice: orderPrice,
    orderTypeTag: ORDER_LIMIT_BUY,
  });

  if (!(await sim(client, keypair, cancelTx, "cancelOrder (sim)"))) {
    console.warn("cancelOrder sim failed; not executing");
    return;
  }
  await execute(client, keypair, cancelTx, "cancelOrder (execute)");

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
