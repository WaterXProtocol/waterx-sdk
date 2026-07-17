/**
 * SDK smoke test against testnet.
 *
 * 1. Loads `waterx-config/testnet.json` directly from disk (bypasses HTTP
 *    so we don't need the config repo published yet).
 * 2. Constructs a PerpClient.
 * 3. Builds a representative PTB per builder family.
 * 4. simulate() each one — reports OK / expected-on-chain-error / SDK-broken.
 *
 * "Expected on-chain errors" (missing account, missing position, alias-already-
 * taken, etc.) are GREEN — they mean the PTB reached chain dispatch. Anything
 * that fails *before* dispatch (BCS encode, schema mismatch, builder crash) is
 * RED and points to an SDK bug.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";

import { refreshOraclePrices } from "../src/oracle/index.ts";
import { PerpClient } from "../src/perp/client.ts";
import type { WaterXConfig } from "../src/perp/config.ts";
import { ORDER_TAG_WILDCARD, PERM_ALL_TRADING } from "../src/perp/constants.ts";
import { getRefererFor, isValidReferralCode, referralCodeExists } from "../src/perp/fetch.ts";
import {
  buildPlaceOrderArgument,
  cancelOrderRequest,
  closePositionRequest,
  createAccount,
  executeTrading,
  mintWlp,
  placeOrderRequest,
  requestRedeemWlp,
  setReferralCode,
} from "../src/perp/index.ts";
import { rawPrice } from "../src/utils/math.ts";
import { loadRepoEnvFiles, waterxConfigUrlFromEnv } from "./load-repo-env.ts";

const CONFIG_PATH = resolve(import.meta.dirname, "..", "..", "waterx-config", "testnet.json");

// A throwaway wxa account ID we use only to build PTBs. simulate will fail
// later with "subaccount not found" (account 600 range), which still counts
// as a green dispatch.
const FAKE_ACCOUNT_ID = "0x0000000000000000000000000000000000000000000000000000000000000001";
const FAKE_POSITION_ID = 1n;
const FAKE_ORDER_ID = 1n;
const FAKE_SENDER = "0x0000000000000000000000000000000000000000000000000000000000000abc";

type Outcome =
  | { kind: "ok" }
  | { kind: "expected"; abortCode?: string; details: string }
  | { kind: "sdk-error"; error: unknown }
  | { kind: "build-error"; error: unknown };

function describeOutcome(name: string, o: Outcome): void {
  const tag =
    o.kind === "ok"
      ? "\x1b[32mOK\x1b[0m       "
      : o.kind === "expected"
        ? "\x1b[33mEXPECTED\x1b[0m "
        : "\x1b[31mFAIL\x1b[0m     ";
  const detail =
    o.kind === "ok"
      ? "simulate succeeded"
      : o.kind === "expected"
        ? `${o.details}${o.abortCode ? ` (abort ${o.abortCode})` : ""}`
        : o.kind === "sdk-error"
          ? `SDK simulate error: ${String(o.error)}`
          : `builder crashed: ${String(o.error)}`;
  console.log(`${tag} ${name.padEnd(40)} ${detail}`);
}

interface SimMoveAbort {
  $kind?: string;
  message?: string;
  command?: number;
  MoveAbort?: {
    abortCode?: string;
    location?: { module?: string; functionName?: string };
    cleverError?: { constantName?: string; value?: string };
  };
}

interface SimResult {
  $kind?: string;
  FailedTransaction?: {
    status?: { success?: boolean; error?: SimMoveAbort };
  };
  commandResults?: unknown;
}

function classifySim(result: SimResult): Outcome {
  if (result.$kind === "FailedTransaction") {
    const err = result.FailedTransaction?.status?.error;
    if (!err) {
      return { kind: "expected", details: "FailedTransaction with no error payload" };
    }
    // Surface a compact description.
    const name = err.MoveAbort?.cleverError?.constantName;
    const fn = err.MoveAbort?.location?.functionName;
    const msg = err.message?.slice(0, 220) ?? "MoveAbort";
    const code = err.MoveAbort?.abortCode;
    if (name && fn) {
      return { kind: "expected", abortCode: name, details: `${fn}: ${name}` };
    }
    return { kind: "expected", abortCode: code, details: msg };
  }
  // No FailedTransaction wrapper — treat as success.
  return { kind: "ok" };
}

async function runCase(
  client: PerpClient,
  name: string,
  build: () => Promise<Transaction> | Transaction,
): Promise<void> {
  let tx: Transaction;
  try {
    tx = await build();
  } catch (e) {
    describeOutcome(name, { kind: "build-error", error: e });
    return;
  }
  try {
    tx.setSender(FAKE_SENDER);
    const sim = (await client.simulate(tx)) as unknown as SimResult;
    describeOutcome(name, classifySim(sim));
  } catch (e) {
    describeOutcome(name, { kind: "sdk-error", error: e });
  }
}

async function main(): Promise<void> {
  loadRepoEnvFiles();
  // Prefer the sibling `../waterx-config/testnet.json` checkout when present
  // (local dev), but fall back to fetching the canonical config over HTTP so
  // this works in CI, where the config repo isn't checked out alongside.
  let config: WaterXConfig;
  let client: PerpClient;
  if (existsSync(CONFIG_PATH)) {
    console.log(`Loading config from ${CONFIG_PATH}`);
    config = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as WaterXConfig;
    client = new PerpClient("TESTNET", config);
  } else {
    console.log(`Local config ${CONFIG_PATH} not found — fetching canonical config over HTTP`);
    client = await PerpClient.create("TESTNET", {
      cache: true,
      waterxConfigUrl: waterxConfigUrlFromEnv(),
    });
    config = client.config;
  }

  console.log("\n=== Config sanity ===");
  console.log(`  network               ${config.network} / ${config.chain_id}`);
  console.log(`  packages.waterx_perp  ${client.config.packages.waterx_perp.published_at}`);
  console.log(`  global_config         ${client.config.packages.waterx_perp.global_config}`);
  console.log(`  market_registry_wlp   ${client.config.packages.waterx_perp.market_registry_wlp}`);
  console.log(`  wxa account_registry  ${client.config.packages.waterx_account.account_registry}`);
  console.log(`  oracle                ${client.config.packages.waterx_oracle.oracle}`);
  console.log(`  wlp_pool              ${client.config.packages.wlp.wlp_pool}`);
  console.log(`  wlp_aum               ${client.config.packages.wlp.wlp_aum ?? "(missing)"}`);
  console.log(
    `  referral_table        ${client.config.packages.waterx_referral?.referral_table ?? "(missing)"}`,
  );
  console.log(`  pyth state            ${client.pyth.state_id}`);
  console.log(`  pyth hermes           ${client.pyth.hermes_endpoint}`);
  console.log(
    `  markets               ${Object.keys(client.config.packages.waterx_perp.markets).join(", ")}`,
  );
  console.log(
    `  pool_tokens           ${Object.keys(client.config.packages.wlp.pool_tokens).join(", ")}`,
  );
  console.log(`  wlpType()             ${client.wlpType()}`);

  const USDC_TYPE = client.getPoolTokenType("USD");
  const BTC_TICKER = "BTCUSD";

  console.log("\n=== Builder smoke ===");

  // 1. createAccount — pure wxa call, no oracle / collateral needed.
  await runCase(client, "createAccount", () => {
    const tx = new Transaction();
    createAccount(client, tx, { alias: "smoke-test" });
    return tx;
  });

  // 2. setReferralCode — referral package + sender_request only.
  await runCase(client, "setReferralCode", () => {
    const tx = new Transaction();
    setReferralCode(client, tx, { code: "smoke" });
    return tx;
  });

  // 3. closePositionRequest + execute — needs oracle refresh first.
  await runCase(client, "closePosition(BTC, fake pos)", async () => {
    const tx = new Transaction();
    // This case builds its own TradingRequest below rather than going
    // through wrapRequestAndExecute, so no sponsor fund is opened —
    // standalone smoke script pays its own gas for the Pyth update fee.
    await refreshOraclePrices(tx, client, [BTC_TICKER, "USDCUSD"], { allowGasFee: true });
    const req = closePositionRequest(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      accountId: FAKE_ACCOUNT_ID,
      positionId: FAKE_POSITION_ID,
      acceptablePrice: rawPrice(60000),
    });
    executeTrading(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      request: req,
    });
    return tx;
  });

  // 4. placeOrder (market form, triggerPrice undefined) — exercises pre-order
  //    vector construction with an empty vector.
  await runCase(client, "placeOrder(BTC market)", async () => {
    const tx = new Transaction();
    // This case builds its own TradingRequest below rather than going
    // through wrapRequestAndExecute, so no sponsor fund is opened —
    // standalone smoke script pays its own gas for the Pyth update fee.
    await refreshOraclePrices(tx, client, [BTC_TICKER, "USDCUSD"], { allowGasFee: true });
    const req = placeOrderRequest(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      accountId: FAKE_ACCOUNT_ID,
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
    executeTrading(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      request: req,
    });
    return tx;
  });

  // 5. placeOrder (limit + TP/SL pre-orders) — exercises non-empty vector
  //    of PlaceOrderArgument move structs.
  await runCase(client, "placeOrder(BTC limit + TP/SL)", async () => {
    const tx = new Transaction();
    // This case builds its own TradingRequest below rather than going
    // through wrapRequestAndExecute, so no sponsor fund is opened —
    // standalone smoke script pays its own gas for the Pyth update fee.
    await refreshOraclePrices(tx, client, [BTC_TICKER, "USDCUSD"], { allowGasFee: true });
    const req = placeOrderRequest(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      accountId: FAKE_ACCOUNT_ID,
      main: {
        isLong: true,
        isStopOrder: false,
        reduceOnly: false,
        size: rawPrice(0.01),
        triggerPrice: rawPrice(60000),
        acceptablePrice: undefined,
        collateralAmount: 1_000_000n,
      },
      preOrders: [
        {
          isLong: false,
          isStopOrder: false,
          reduceOnly: true,
          size: rawPrice(0.01),
          triggerPrice: rawPrice(70000),
          acceptablePrice: undefined,
          collateralAmount: 0n,
        },
        {
          isLong: false,
          isStopOrder: true,
          reduceOnly: true,
          size: rawPrice(0.01),
          triggerPrice: rawPrice(55000),
          acceptablePrice: undefined,
          collateralAmount: 0n,
        },
      ],
    });
    executeTrading(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      request: req,
    });
    return tx;
  });

  // 6. cancelOrder wildcard — defaults to scan all 4 books.
  await runCase(client, "cancelOrder(wildcard)", async () => {
    const tx = new Transaction();
    // This case builds its own TradingRequest below rather than going
    // through wrapRequestAndExecute, so no sponsor fund is opened —
    // standalone smoke script pays its own gas for the Pyth update fee.
    await refreshOraclePrices(tx, client, [BTC_TICKER, "USDCUSD"], { allowGasFee: true });
    const req = cancelOrderRequest(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      accountId: FAKE_ACCOUNT_ID,
      orderId: FAKE_ORDER_ID,
      triggerPrice: 0n,
      orderTypeTag: ORDER_TAG_WILDCARD,
    });
    executeTrading(client, tx, {
      ticker: BTC_TICKER,
      collateralType: USDC_TYPE,
      request: req,
    });
    return tx;
  });

  // 7. mintWlp — exercises WlpAum object + oracle refresh of every pool token.
  await runCase(client, "mintWlp(USDC)", async () => {
    const tx = new Transaction();
    const poolTickers = Object.keys(client.config.packages.wlp.pool_tokens).filter(
      (t) => client.config.packages.pyth_rule.feeds[t] !== undefined,
    );
    await refreshOraclePrices(tx, client, poolTickers, { allowGasFee: true });
    mintWlp(client, tx, {
      accountId: FAKE_ACCOUNT_ID,
      depositTokenType: USDC_TYPE,
      depositAmount: 1_000_000n,
      minLpAmount: 0n,
    });
    return tx;
  });

  // 8. requestRedeemWlp — no oracle refresh required.
  await runCase(client, "requestRedeemWlp(USDC)", () => {
    const tx = new Transaction();
    requestRedeemWlp(client, tx, {
      accountId: FAKE_ACCOUNT_ID,
      redeemTokenType: USDC_TYPE,
      lpAmount: 1_000_000n,
    });
    return tx;
  });

  // 9. Pure helper smoke: buildPlaceOrderArgument w/o running it through the perp.
  await runCase(client, "buildPlaceOrderArgument (struct only)", () => {
    const tx = new Transaction();
    buildPlaceOrderArgument(client, tx, {
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: rawPrice(1),
      collateralAmount: 1_000_000n,
    });
    return tx;
  });

  // 10. Referral read helpers — exercises waterx_referral query path.
  console.log("\n=== Referral reads ===");
  try {
    const valid = await isValidReferralCode(client, "smoke");
    console.log(`  isValidReferralCode("smoke")       ${valid}`);
    const claimed = await referralCodeExists(client, "smoke");
    console.log(`  referralCodeExists("smoke")        ${claimed}`);
    const refer = await getRefererFor(client, FAKE_SENDER);
    console.log(`  getRefererFor(FAKE_SENDER)         ${refer ?? "(none)"}`);
  } catch (e) {
    console.log(`  read FAIL: ${String(e).slice(0, 200)}`);
  }

  // Perm constant sanity (no on-chain bit, just makes sure the enum survived).
  console.log(`\n  PERM_ALL_TRADING = 0x${PERM_ALL_TRADING.toString(16)}`);
  console.log("Smoke run complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
