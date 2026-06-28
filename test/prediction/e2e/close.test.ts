import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { getPosition } from "~predict/fetch.ts";
import {
  cancelClose,
  confirmClose,
  requestClose,
  requestPartialClose,
  selfCancelClose,
  splitPosition,
  transferPosition,
} from "~predict/prediction.ts";
import { beforeAll, describe, it } from "vitest";

import {
  createE2eClient,
  discoverFixtures,
  predictE2eNetwork,
  type E2eFixtures,
} from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

/**
 * Skip (instead of fail) when the simulate target function is not present on the
 * deployed package — i.e. the testnet `waterx_prediction` package predates a
 * newly added entrypoint and needs republishing. Re-throws any other error.
 */
async function simulateSuccessOrSkipMissing(
  ctx: import("vitest").TestContext,
  client: PredictClient,
  tx: Transaction,
  owner: string,
  fnName: string,
): Promise<void> {
  try {
    await expectSimulateSuccess(client, tx, owner);
  } catch (err) {
    const message = decodeURIComponent(err instanceof Error ? err.message : String(err));
    if (message.includes("unable to find function") && message.includes(fnName)) {
      ctx.skip(true, `${fnName} not published on this package yet — republish waterx_prediction.`);
      return;
    }
    throw err;
  }
}

/**
 * Close-pipeline PTBs (covers `CloseRequested` / `CloseConfirmed` / `CloseCancelled` indexer
 * events). Each test needs a position in a specific status — pre-seed via `pnpm seed:testnet`.
 */
describe(`close pipeline PTB simulate (${predictE2eNetwork})`, () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx, client);
  }, 120_000);

  it("requestClose on a seeded OPEN position", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const positionId = fx.openPositionId ?? fx.positionId;
    if (positionId === undefined) {
      guard.skipFixableBySeed(ctx, "openPositionId", { stage: "fill" });
    }

    const position = await getPosition(client, { positionId });
    if (position.accountId !== fx.accountId) {
      guard.skipFixableBySeed(ctx, "openPositionId owned by accountId", { stage: "fill" });
    }
    if (position.status !== "OPEN") {
      guard.skipFixableBySeed(ctx, `position status=OPEN (got ${position.status})`, {
        stage: "fill",
      });
    }

    const tx = new Transaction();
    requestClose(client, tx, {
      positionId,
      minProceeds: 1n,
      expiryTs: 999_999_999_999_999n,
    });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("requestPartialClose on a seeded OPEN position", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const positionId = fx.openPositionId ?? fx.positionId;
    if (positionId === undefined) {
      guard.skipFixableBySeed(ctx, "openPositionId", { stage: "fill" });
    }

    const position = await getPosition(client, { positionId });
    if (position.accountId !== fx.accountId) {
      guard.skipFixableBySeed(ctx, "openPositionId owned by accountId", { stage: "fill" });
    }
    if (position.status !== "OPEN") {
      guard.skipFixableBySeed(ctx, `position status=OPEN (got ${position.status})`, {
        stage: "fill",
      });
    }
    // partial close needs 0 < closeShares < filledShares, so at least 2 shares.
    if (position.filledShares < 2n) {
      guard.skipFixableBySeed(ctx, "openPositionId with filledShares >= 2", { stage: "fill" });
    }

    const tx = new Transaction();
    requestPartialClose(client, tx, {
      positionId,
      closeShares: 1n,
      minProceeds: 1n,
      expiryTs: 999_999_999_999_999n,
    });
    await simulateSuccessOrSkipMissing(ctx, client, tx, owner, "request_partial_close");
  });

  it("splitPosition on a seeded OPEN position", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const positionId = fx.openPositionId ?? fx.positionId;
    if (positionId === undefined) {
      guard.skipFixableBySeed(ctx, "openPositionId", { stage: "fill" });
    }

    const position = await getPosition(client, { positionId });
    if (position.accountId !== fx.accountId || position.status !== "OPEN") {
      guard.skipFixableBySeed(ctx, "openPositionId OPEN + owned by accountId", { stage: "fill" });
    }
    if (position.filledShares < 2n) {
      guard.skipFixableBySeed(ctx, "openPositionId with filledShares >= 2", { stage: "fill" });
    }

    const tx = new Transaction();
    splitPosition(client, tx, {
      positionId,
      recipientAccountId: fx.accountId,
      splitShares: 1n,
    });
    await simulateSuccessOrSkipMissing(ctx, client, tx, owner, "split_position");
  });

  it("transferPosition on a seeded OPEN position (self-recipient no-op)", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    const positionId = fx.openPositionId ?? fx.positionId;
    if (positionId === undefined) {
      guard.skipFixableBySeed(ctx, "openPositionId", { stage: "fill" });
    }

    const position = await getPosition(client, { positionId });
    if (position.accountId !== fx.accountId || position.status !== "OPEN") {
      guard.skipFixableBySeed(ctx, "openPositionId OPEN + owned by accountId", { stage: "fill" });
    }

    const tx = new Transaction();
    transferPosition(client, tx, {
      positionId,
      recipientAccountId: fx.accountId,
    });
    await simulateSuccessOrSkipMissing(ctx, client, tx, owner, "transfer_position");
  });

  it("selfCancelClose on an expired PENDING_CLOSE position (rescue path)", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    if (fx.expiredPendingClosePositionId === undefined) {
      guard.skipFixableBySeed(ctx, "expiredPendingClosePositionId (rescue precondition)", {
        stage: "expired-rescue",
      });
    }
    const tx = new Transaction();
    selfCancelClose(client, tx, { positionId: fx.expiredPendingClosePositionId });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("keeper confirmClose + cancelClose on a seeded PENDING_CLOSE position", async (ctx) => {
    if (fx.pendingClosePositionId === undefined) {
      guard.skipFixableBySeed(ctx, "pendingClosePositionId", { stage: "request-close" });
    }
    const txConfirm = new Transaction();
    confirmClose(client, txConfirm, { positionId: fx.pendingClosePositionId, proceeds: 1n });
    await expectSimulateSuccess(client, txConfirm);

    const txCancel = new Transaction();
    cancelClose(client, txCancel, { positionId: fx.pendingClosePositionId });
    await expectSimulateSuccess(client, txCancel);
  });
});
