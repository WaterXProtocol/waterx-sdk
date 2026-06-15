import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { getPosition } from "~predict/fetch.ts";
import { cancelClose, confirmClose, requestClose, selfCancelClose } from "~predict/prediction.ts";
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
