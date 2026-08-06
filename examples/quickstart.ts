/**
 * The README quickstart, runnable.
 *
 * This file is the SOURCE OF TRUTH for the "First integration" walkthrough in
 * `README.md` — it is covered by `pnpm lint` and `pnpm typecheck`, so the
 * documented snippet cannot drift away from the API. Edit them together.
 *
 * Walks the whole first-integration arc:
 *   1. build a client        (waterxConfigUrl + oracleSource are REQUIRED)
 *   2. ensure a wxa account  (created when WATERX_ACCOUNT_ID is unset)
 *   3. place a market order  (oracle refresh happens inside build*Tx)
 *   4. read the positions back
 *
 * Simulate-only by default — nothing is signed or sent unless you opt in.
 *
 *   export WATERX_CONFIG_URL=https://raw.githubusercontent.com/WaterXProtocol/waterx-config/main/testnet.json
 *   pnpm exec tsx examples/quickstart.ts                       # simulate every step
 *   WATERX_EXECUTE=1 pnpm exec tsx examples/quickstart.ts      # sign + send
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/quickstart.ts   # use an existing account
 *
 * Preconditions for the order step: the account must already hold collateral
 * (see `examples/actions/action-request-deposit.ts`) and the market must be
 * deployed on the target network.
 */
import { Transaction } from "@mysten/sui/transactions";

import { getAccountPositions } from "../src/perp/fetch.ts";
import { createAccount } from "../src/perp/index.ts";
import { buildPlaceOrderTx } from "../src/perp/tx-builders.ts";
import { rawPrice } from "../src/utils/math.ts";
import { buildClient, dump, loadActiveKeypair, run, simThenMaybeExecute } from "./_shared.ts";

const TICKER = process.env.WATERX_TICKER ?? "BTCUSD";

run(async () => {
  // --- 1. client -----------------------------------------------------------
  // buildClient() reads WATERX_CONFIG_URL + ORACLE_SOURCE from ITS env and calls
  //   PerpClient.create(network, { waterxConfigUrl, oracleSource, pythApiKey })
  // Both of the first two are REQUIRED — the SDK has no defaults, and it never
  // reads env itself: every consumer wires them at its own boundary like this.
  const client = await buildClient();
  const { keypair } = loadActiveKeypair();

  // --- 2. account ----------------------------------------------------------
  // A wxa account is the prerequisite for every trading call. One account
  // serves both the perp and the prediction line.
  const accountId = process.env.WATERX_ACCOUNT_ID;
  if (!accountId) {
    const tx = new Transaction();
    createAccount(client, tx, { alias: process.env.WATERX_ALIAS ?? "quickstart" });
    await simThenMaybeExecute(client, tx, "createAccount", keypair);
    console.log(
      "\n  No WATERX_ACCOUNT_ID set. Run with WATERX_EXECUTE=1 to create the account,\n" +
        "  take `account_object_address` from the AccountCreated event, fund it\n" +
        "  (examples/actions/action-request-deposit.ts), then re-run with\n" +
        "  WATERX_ACCOUNT_ID=0x... to place an order.",
    );
    return;
  }

  // --- 3. order ------------------------------------------------------------
  // Market order = no triggerPrice; `acceptablePrice` is the slippage cap.
  // buildPlaceOrderTx is async because it prepends the oracle refresh legs
  // for whichever source `oracleSource` selected.
  const tx = await buildPlaceOrderTx(client, {
    ticker: TICKER,
    collateralType: client.creditType(),
    accountId,
    main: {
      isLong: true,
      isStopOrder: false,
      reduceOnly: false,
      size: rawPrice(0.0001), // 1e9-scaled — always go through rawPrice()
      triggerPrice: undefined, // market form
      acceptablePrice: rawPrice(200_000), // slippage cap, above any real BTC price
      collateralAmount: 5_000_000n, // 6-decimal collateral → 5 USDC
    },
    preOrders: [], // optional reduce-only TP/SL legs
  });
  await simThenMaybeExecute(client, tx, "placeOrder market", keypair);

  // --- 4. read -------------------------------------------------------------
  // Reads are gRPC simulateTransaction + BCS decode — no signer, no gas.
  // basePriceUsd is a WHOLE-DOLLAR u64, not a rawPrice(); 0n zero-bases PnL.
  try {
    const positions = await getAccountPositions(client, {
      ticker: TICKER,
      accountObjectAddress: accountId,
      basePriceUsd: 0n,
    });
    dump(`getAccountPositions(${TICKER}) → (${positions.length})`, positions);
  } catch (e) {
    // `EAccountNotFound` here means the id is not a wxa account on THIS network
    // — a fixture from another deployment, or a Sui address used in its place.
    console.error(`  read failed for account ${accountId}: ${String(e)}`);
    process.exitCode = 1;
  }
});
