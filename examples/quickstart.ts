/**
 * The README quickstart, runnable.
 *
 * The runnable companion to the "First integration" walkthrough in `README.md`.
 * Being a real file, it is covered by `pnpm lint` and `pnpm typecheck`, so the
 * API it exercises cannot go stale unnoticed. Edit the two together.
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
 *   export PYTH_API_KEY=...   # the default fed set includes pyth_lazer_rule
 *   pnpm exec tsx examples/quickstart.ts                       # simulate every step
 *   WATERX_EXECUTE=1 pnpm exec tsx examples/quickstart.ts      # sign + send
 *   WATERX_ACCOUNT_ID=0x... pnpm exec tsx examples/quickstart.ts   # use an existing account
 *
 * Preconditions: a local Sui CLI keypair (`~/.sui/sui_config/`) — it is the
 * simulate sender, not just the signer. For the order step the account must
 * already hold collateral (see `actions/action-request-deposit.ts`) and the
 * market must be deployed on the target network.
 */
import { Transaction } from "@mysten/sui/transactions";

import {
  buildPlaceOrderTx,
  createAccount,
  getAccountPositions,
  rawPrice,
} from "../src/perp/index.ts";
import { buildClient, dump, loadActiveKeypair, run, simThenMaybeExecute } from "./_shared.ts";

const TICKER = process.env.WATERX_TICKER ?? "BTCUSD";

run(async () => {
  // --- 1. client -----------------------------------------------------------
  // buildClient() supplies the two REQUIRED create options (waterxConfigUrl,
  // oracleSource) from its own env — the SDK never reads env itself, so every
  // consumer wires them at its own boundary exactly like this.
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
      "\n  No WATERX_ACCOUNT_ID set. Take `account_object_address` from the\n" +
        "  AccountCreated event, fund it (actions/action-request-deposit.ts),\n" +
        "  then re-run with WATERX_ACCOUNT_ID=0x... to place an order.",
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
  // An `EAccountNotFound` abort here means the id is not a wxa account on THIS
  // network — a fixture from another deployment, or a Sui address in its place.
  // run() prints and exits 1 on the throw.
  const positions = await getAccountPositions(client, {
    ticker: TICKER,
    accountObjectAddress: accountId,
    basePriceUsd: 0n,
  });
  dump(`getAccountPositions(${TICKER}) → (${positions.length})`, positions);
});
