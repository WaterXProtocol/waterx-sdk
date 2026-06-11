import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import {
  adminPlaceOrderFor,
  cancelOrder,
  fillOrder,
  placeOrder,
  selfCancelOrder,
} from "~predict/prediction.ts";
import { beforeAll, describe, it } from "vitest";

import { minimalPlaceOrderParams, PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import {
  expectSimulateSuccess,
  parseMoveAbortCode,
  resolveObjectOwner,
  simulateErrorMessage,
  simulateWithSender,
} from "../helpers/simulate.ts";

/** `waterx_prediction::fill_order` abort code when the order's expiry has already passed. */
const E_ORDER_EXPIRED = 18;
/** `waterx_prediction::place_order` abort code when `receiver_account_id` is not registered. */
const E_NOT_ACCOUNT_POSITION = 16;
/** Valid address shape, never registered in the wxa AccountRegistry. */
const UNREGISTERED_RECEIVER_ID =
  "0x00000000000000000000000000000000000000000000000000000000000000bb";

/**
 * Order lifecycle PTBs (covers `OrderPlaced` / `OrderCancelled` / `OrderFilled` indexer events
 * via dry-run simulate). Keeper-style and admin-style sims do not require the corresponding
 * key — they only need an existing order id and a coin owned by the AdminCap holder respectively.
 */
describe("order PTB simulate (testnet)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx, client);
  }, 120_000);

  it("placeOrder", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const marketBytes = fx.openMarketIdBytes ?? fx.marketIdBytes;
    if (!marketBytes) {
      guard.skipFixableBySeed(ctx, "openMarketIdBytes", { stage: "place-open" });
    }
    const tx = new Transaction();
    placeOrder(client, tx, {
      ...minimalPlaceOrderParams(client),
      accountId: fx.accountId,
      marketId: marketBytes,
    });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("placeOrder aborts ENotAccountPosition for an unregistered receiverAccountId (bet-sharing guard)", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const marketBytes = fx.openMarketIdBytes ?? fx.marketIdBytes;
    if (!marketBytes) {
      guard.skipFixableBySeed(ctx, "openMarketIdBytes", { stage: "place-open" });
    }
    const tx = new Transaction();
    placeOrder(client, tx, {
      ...minimalPlaceOrderParams(client),
      accountId: fx.accountId,
      receiverAccountId: UNREGISTERED_RECEIVER_ID,
      marketId: marketBytes,
    });
    const result = await simulateWithSender(client, tx, owner);
    if (result.$kind !== "FailedTransaction") {
      throw new Error("Expected placeOrder with unregistered receiver to abort");
    }
    // `has_account(receiver_account_id)` is the first assert in place_order —
    // the abort must be ENotAccountPosition, not a later permission/payment abort.
    if (parseMoveAbortCode(simulateErrorMessage(result)) !== E_NOT_ACCOUNT_POSITION) {
      throw new Error(
        `Expected abort code ${E_NOT_ACCOUNT_POSITION} (ENotAccountPosition), got: ${simulateErrorMessage(result)}`,
      );
    }
  });

  it("selfCancelOrder on an expired OPEN order (rescue path)", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    if (fx.expiredOpenOrderId === undefined) {
      guard.skipFixableBySeed(ctx, "expiredOpenOrderId (rescue precondition)", {
        stage: "expired-rescue",
      });
    }
    const tx = new Transaction();
    selfCancelOrder(client, tx, { orderId: fx.expiredOpenOrderId });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("keeper fillOrder + cancelOrder on a seeded OPEN order", async (ctx) => {
    const orderId = fx.openOrderId ?? fx.orderId;
    if (orderId === undefined) {
      guard.skipFixableBySeed(ctx, "openOrderId", { stage: "place-open" });
    }
    const txFill = new Transaction();
    fillOrder(client, txFill, { orderId, filledShares: 1n, filledCost: 1n });
    const fill = await simulateWithSender(client, txFill);
    // Stale-seed guard: the discovered open order can expire on-chain after it was seeded,
    // making `fill_order` abort EOrderExpired. That's a testnet-state condition, not a code
    // bug — skip (re-seed to refresh) rather than fail. Any other failure is a real error.
    if (
      fill.$kind === "FailedTransaction" &&
      parseMoveAbortCode(simulateErrorMessage(fill)) === E_ORDER_EXPIRED
    ) {
      guard.skipFixableBySeed(ctx, "a non-expired open order (seeded order has expired)", {
        stage: "place-open",
      });
    }
    if (fill.$kind === "FailedTransaction") {
      throw new Error(`Expected fillOrder simulate success, got: ${simulateErrorMessage(fill)}`);
    }

    const txCancel = new Transaction();
    cancelOrder(client, txCancel, { orderId });
    await expectSimulateSuccess(client, txCancel);
  });

  it("adminPlaceOrderFor", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    const marketBytes = fx.openMarketIdBytes ?? fx.marketIdBytes;
    if (!marketBytes) {
      guard.skipFixableBySeed(ctx, "openMarketIdBytes", { stage: "place-open" });
    }
    if (!fx.adminUsdCoinObjectId) {
      guard.skipPermanent(
        ctx,
        `adminPlaceOrderFor dry-run requires a settlement coin owned by the AdminCap holder. Transfer USD to that wallet (see scripts/probe-admin-coins.ts).`,
      );
    }
    const adminCap = requirePredictionAdminCap(client);
    const adminOwner = await resolveObjectOwner(client, adminCap);
    const tx = new Transaction();
    adminPlaceOrderFor(client, tx, {
      adminCap,
      payment: fx.adminUsdCoinObjectId,
      accountId: fx.accountId,
      marketId: marketBytes,
      selection: "YES",
      minShares: 1n,
      priceCapBps: 7000n,
      expiryTs: 9_999_999_999_999n,
    });
    await expectSimulateSuccess(client, tx, adminOwner);
  });
});

function requirePredictionAdminCap(client: PredictClient): string {
  return client.predictionAdminCap();
}
