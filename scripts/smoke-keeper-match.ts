/**
 * simulateTransaction usage smoke — market-order → keeper-match → close.
 *
 * Walks the four shapes of `client.simulate(tx)` you'll likely use:
 *
 *   A. Dry-run a write PTB before signing (catch aborts cheaply).
 *      See `sim()` below; called before every execute.
 *
 *   B. View helpers in `src/fetch.ts` (`getMarketData` / `getAccountOrders`
 *      / `getAccountPositions`). Each builds a one-shot PTB, runs
 *      `client.simulate`, and BCS-decodes the first command's return value.
 *
 *   C. Hand-rolled raw simulate against a `waterx_perp_view` move call —
 *      shows how the helpers work under the hood (`readMarketRaw`).
 *
 *   D. After-the-fact state confirmation between steps (same as B but
 *      narratively: "did the order actually rest? did the position open?").
 *
 * Trading flow:
 *   1. View — print BTC market state + current account positions/orders.
 *   2. Place a market BUY (limit at tick 0, acceptable_price capped high)
 *      via `buildPlaceOrderTx` and capture `orderId` from `OrderCreated`.
 *   3. Keeper match_orders on the LIMIT_BUY book (this signer plays keeper;
 *      keeper paths skip the witness checklist). Capture `positionId` from
 *      `PositionOpened`. If the event indexer is slow, fall back to
 *      `getAccountPositions(BTCUSD)`.
 *   4. Close via `close_position_request` — direct user-side close
 *      consumed by `trading::execute` in the same PTB. Fills at the live
 *      oracle, no keeper round-trip needed. `PositionClosed` emits pnl,
 *      final views show 0 positions / 0 orders.
 *
 * Required env:
 *   WATERX_SMOKE_ACCOUNT_ID    wxa account id you own with USD + WLP seeded
 *                              (run scripts/smoke-happy-path.ts first to
 *                              deposit + mint WLP if you haven't).
 *
 * Optional env:
 *   WATERX_ORDER_SIZE             raw 1e9-scaled Float, default rawPrice(0.0001)
 *   WATERX_ORDER_COLLATERAL       raw USD amount, default 5_000_000 (5 USD)
 *   WATERX_MAX_ACCEPTABLE_USD     USD cap on market buy, default 200_000
 *   WATERX_CLOSE_ACCEPTABLE_USD   USD floor on close, default 1
 *   WATERX_SKIP_PLACE=1           skip place step (use existing order)
 *   WATERX_ORDER_ID               override extracted orderId
 *   WATERX_POSITION_ID            override extracted positionId
 *   WATERX_SKIP_MATCH=1           skip keeper match_orders
 *   WATERX_SKIP_CLOSE=1           skip close step
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fromBase64 } from "@mysten/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

import { WaterXClient } from "../src/client.ts";
import { DRY_RUN_SENDER, ORDER_LIMIT_BUY } from "../src/constants.ts";
import {
  getAccountOrders,
  getAccountPositions,
  getMarketData,
  type MarketDataView,
} from "../src/fetch.ts";
import {
  MarketData,
  marketData as marketDataCall,
} from "../src/generated/waterx_perp_view/view.ts";
import {
  buildClosePositionTx,
  buildPlaceOrderTx,
  matchOrders,
  updateTokenValue,
} from "../src/index.ts";
import { rawPrice } from "../src/utils/math.ts";
import { refreshOraclePrices } from "../src/utils/pyth.ts";
import { loadRepoEnvFiles } from "./load-repo-env.ts";

const KEYSTORE = resolve(homedir(), ".sui/sui_config/sui.keystore");
const CLIENT_YAML = resolve(homedir(), ".sui/sui_config/client.yaml");
const BTC = "BTCUSD";

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

/** (A) Dry-run a write PTB. Returns false if simulate aborts. */
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
 * (C) Hand-rolled raw simulate against `waterx_perp_view::market_data`.
 * Mirrors what `getMarketData` does, decomposed so you can see the moving
 * parts: build PTB → setSender(zero) → simulate → pull BCS bytes →
 * `MarketData.parse(bytes)`.
 */
async function readMarketRaw(client: WaterXClient): Promise<MarketDataView> {
  const tx = new Transaction();
  marketDataCall({
    package: client.config.packages.waterx_perp_view.published_at,
    arguments: {
      marketRegistry: tx.object(client.config.packages.waterx_perp.market_registry_wlp),
      ticker: BTC,
    },
    typeArguments: [client.wlpType()],
  })(tx);
  tx.setSender(DRY_RUN_SENDER);

  const r = (await client.simulate(tx)) as unknown as SimResult;
  if (r.$kind === "FailedTransaction") {
    throw new Error(
      `simulate aborted: ${r.FailedTransaction?.status?.error?.message ?? "(no msg)"}`,
    );
  }
  const bcsField = r.commandResults?.[0]?.returnValues?.[0]?.bcs;
  if (!bcsField) throw new Error("no BCS return value from market_data view");
  const bytes = typeof bcsField === "string" ? fromBase64(bcsField) : bcsField;
  return MarketData.parse(bytes);
}

interface EventLite {
  type?: string;
  parsedJson?: Record<string, unknown>;
}

async function fetchTxEvents(digest: string): Promise<EventLite[]> {
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
  const json = (await res.json()) as { result?: { events?: EventLite[] } };
  return json.result?.events ?? [];
}

function findEvent(events: EventLite[], suffix: string): EventLite | undefined {
  return events.find((e) => (e.type ?? "").endsWith(suffix));
}

/** Pretty-print a BCS-parsed struct (or array of structs) with BigInts as strings. */
function dump(label: string, value: unknown): void {
  const text = JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  console.log(`  ${label}\n${text.replace(/^/gm, "    ")}`);
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  const accountId = process.env.WATERX_SMOKE_ACCOUNT_ID;
  if (!accountId) throw new Error("set WATERX_SMOKE_ACCOUNT_ID to a wxa account id you own");

  const { keypair, address } = loadActiveKeypair();
  console.log(`Sender:    ${address}`);
  console.log(`AccountId: ${accountId}`);

  const client = await WaterXClient.create("TESTNET", { cache: true });
  const usdcType = client.getPoolTokenType("USD");

  // ============================================================================
  // (B + C) Pre-flight view reads via simulate
  // ============================================================================
  console.log("\n=== Pre-flight views (simulate) ===");

  // (C) raw simulate decoded by hand
  const market = await readMarketRaw(client);
  dump("readMarketRaw →", market);

  // (B) view helper — same shape via the packaged helper
  const market2 = await getMarketData(client, { ticker: BTC });
  dump("getMarketData(BTC) →", market2);

  const positionsBefore = await getAccountPositions(client, {
    ticker: BTC,
    accountObjectAddress: accountId,
    basePriceUsd: 0n,
  });
  dump(`getAccountPositions(BTC) → (${positionsBefore.length})`, positionsBefore);

  const ordersBefore = await getAccountOrders(client, {
    ticker: BTC,
    accountObjectAddress: accountId,
  });
  dump(`getAccountOrders(BTC) → (${ordersBefore.length})`, ordersBefore);

  // ============================================================================
  // 2. Place market BUY (limit at tick 0, capped slippage)
  // ============================================================================
  const orderSize = BigInt(process.env.WATERX_ORDER_SIZE ?? rawPrice(0.0001).toString());
  const orderCollateral = BigInt(process.env.WATERX_ORDER_COLLATERAL ?? "5000000");
  const maxAcceptableUsd = Number(process.env.WATERX_MAX_ACCEPTABLE_USD ?? "200000");
  const acceptableBuy = rawPrice(maxAcceptableUsd);

  let orderId: bigint | undefined =
    process.env.WATERX_ORDER_ID !== undefined ? BigInt(process.env.WATERX_ORDER_ID) : undefined;

  if (process.env.WATERX_SKIP_PLACE !== "1" && orderId === undefined) {
    console.log(
      `\n=== Place market BUY size=${orderSize} acceptable<=${acceptableBuy} collateral=${orderCollateral} ===`,
    );
    const placeTx = await buildPlaceOrderTx(client, {
      ticker: BTC,
      collateralType: usdcType,
      accountId,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: orderSize,
        triggerPrice: undefined, // market form — parks at tick 0
        acceptablePrice: acceptableBuy,
        collateralAmount: orderCollateral,
      },
      preOrders: [],
    });
    if (!(await sim(client, keypair, placeTx, "placeOrder (sim)"))) process.exit(2);
    const placeRes = await execute(client, keypair, placeTx, "placeOrder (execute)");
    if (!placeRes.success) process.exit(1);

    const events = await fetchTxEvents(placeRes.digest);
    const ev = findEvent(events, "::events::OrderCreated");
    const raw = ev?.parsedJson?.order_id as string | undefined;
    orderId = raw ? BigInt(raw) : undefined;
    console.log(`  extracted orderId                ${orderId ?? "(not found)"}`);
  } else {
    console.log(`\n=== Skipping place; orderId=${orderId} ===`);
  }

  // (D) post-state view — confirm the order is resting on the BUY book
  if (orderId !== undefined) {
    const ordersAfterPlace = await getAccountOrders(client, {
      ticker: BTC,
      accountObjectAddress: accountId,
    });
    dump(`getAccountOrders after place → (${ordersAfterPlace.length})`, ordersAfterPlace);
  }

  // ============================================================================
  // 3. Keeper match_orders — fill the parked market order
  // ============================================================================
  let positionId: bigint | undefined =
    process.env.WATERX_POSITION_ID !== undefined
      ? BigInt(process.env.WATERX_POSITION_ID)
      : undefined;

  if (process.env.WATERX_SKIP_MATCH !== "1" && positionId === undefined) {
    console.log("\n=== Keeper match_orders (LIMIT_BUY book, from tick 0) ===");
    const matchTx = new Transaction();

    // Pool freshness: refresh every pool token's oracle + base ticker, then
    // bump each pool token's last_price_refresh_timestamp so the in-call
    // `assert_prices_fresh` passes.
    const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens);
    const oracleTickers = Array.from(new Set([BTC, "USDCUSD", ...poolTickers]));
    await refreshOraclePrices(matchTx, client, oracleTickers);
    for (const [, tokenType] of Object.entries(client.config.packages.wlp.pool_tokens)) {
      updateTokenValue(client, matchTx, { tokenType });
    }

    matchOrders(client, matchTx, {
      ticker: BTC,
      collateralType: usdcType,
      orderTypeTag: ORDER_LIMIT_BUY,
      triggerPrice: 0n, // tick 0 — where market orders park
      maxFills: 1n,
    });

    if (!(await sim(client, keypair, matchTx, "matchOrders (sim)"))) process.exit(2);
    const matchRes = await execute(client, keypair, matchTx, "matchOrders (execute)");
    if (!matchRes.success) process.exit(1);

    const events = await fetchTxEvents(matchRes.digest);
    const ev = findEvent(events, "::events::PositionOpened");
    const raw = ev?.parsedJson?.position_id as string | undefined;
    positionId = raw ? BigInt(raw) : undefined;
    console.log(`  PositionOpened event             positionId=${positionId ?? "(not found)"}`);

    // (D) post-match view — show the just-opened position(s)
    const positionsAfterOpen = await getAccountPositions(client, {
      ticker: BTC,
      accountObjectAddress: accountId,
      basePriceUsd: 0n,
    });
    dump(`getAccountPositions after match → (${positionsAfterOpen.length})`, positionsAfterOpen);
    if (positionId === undefined && positionsAfterOpen.length > 0) {
      positionId = BigInt(positionsAfterOpen[positionsAfterOpen.length - 1]!.position_id);
      console.log(`  view-fallback positionId         ${positionId}`);
    }
  } else {
    console.log(`\n=== Skipping match; positionId=${positionId} ===`);
  }

  // ============================================================================
  // 4. Close via close_position_request — direct user-side close (no keeper).
  //    Fills at the live oracle inside the same execute() call.
  // ============================================================================
  if (process.env.WATERX_SKIP_CLOSE === "1") {
    console.log("\nWATERX_SKIP_CLOSE=1; stopping after match.");
    return;
  }
  if (positionId === undefined) {
    console.warn("no positionId — set WATERX_POSITION_ID to close an existing position");
    return;
  }

  const positionsForClose = await getAccountPositions(client, {
    ticker: BTC,
    accountObjectAddress: accountId,
    basePriceUsd: 0n,
  });
  dump(`getAccountPositions before close → (${positionsForClose.length})`, positionsForClose);
  if (!positionsForClose.find((p) => BigInt(p.position_id) === positionId)) {
    console.warn(`positionId=${positionId} not found on-chain; nothing to close`);
    return;
  }

  // `acceptable_price` is the slippage floor for closing a LONG (fill must
  // be ≥ floor). $1 is a wide-open floor — the actual fill is at oracle.
  const acceptableCloseUsd = Number(process.env.WATERX_CLOSE_ACCEPTABLE_USD ?? "1");
  const acceptableClose = rawPrice(acceptableCloseUsd);

  console.log(
    `\n=== close_position_request positionId=${positionId} acceptable>=${acceptableClose} ===`,
  );
  const closeTx = await buildClosePositionTx(client, {
    ticker: BTC,
    collateralType: usdcType,
    accountId,
    positionId,
    acceptablePrice: acceptableClose,
  });
  if (!(await sim(client, keypair, closeTx, "closePosition (sim)"))) {
    console.warn("closePosition sim failed; not executing");
    return;
  }
  const closeRes = await execute(client, keypair, closeTx, "closePosition (execute)");
  if (!closeRes.success) return;

  const closeEvents = await fetchTxEvents(closeRes.digest);
  const closedEv = findEvent(closeEvents, "::events::PositionClosed");
  if (closedEv?.parsedJson) {
    const pnl = closedEv.parsedJson["pnl_amount"];
    const profit = closedEv.parsedJson["pnl_is_profit"];
    console.log(`  PositionClosed event             pnl=${pnl} is_profit=${profit}`);
  } else {
    console.log("  PositionClosed event             (not found in indexer yet)");
  }

  // (D) final view confirmation
  const positionsAfter = await getAccountPositions(client, {
    ticker: BTC,
    accountObjectAddress: accountId,
    basePriceUsd: 0n,
  });
  dump(`getAccountPositions after close → (${positionsAfter.length})`, positionsAfter);
  const ordersFinal = await getAccountOrders(client, {
    ticker: BTC,
    accountObjectAddress: accountId,
  });
  dump(`getAccountOrders after close → (${ordersFinal.length})`, ordersFinal);
  const marketFinal = await getMarketData(client, { ticker: BTC });
  dump("getMarketData(BTC) final →", marketFinal);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
