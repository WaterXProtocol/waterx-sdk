import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { getPosition } from "~predict/fetch.ts";
import { claim, forceClaim } from "~predict/prediction.ts";
import { beforeAll, describe, it } from "vitest";

import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

/**
 * Claim PTBs (covers `PositionClaimed` indexer event). The keeper variant `forceClaim` works on
 * positions whose markets have already been resolved — pre-seed via `--preset=with-claim`.
 */
describe("claim PTB simulate (testnet)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx, client);
  }, 120_000);

  it("claim on a position whose market is resolved", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessAccountReady(ctx);
    const owner = await guard.skipUnlessAccountOwner(ctx);
    if (fx.claimablePositionId === undefined) {
      guard.skipFixableBySeed(ctx, "claimablePositionId", { preset: "with-claim" });
    }
    const position = await getPosition(client, { positionId: fx.claimablePositionId });
    if (position.accountId !== fx.accountId) {
      guard.skipFixableBySeed(ctx, "claimablePositionId owned by accountId", {
        preset: "with-claim",
      });
    }

    const tx = new Transaction();
    claim(client, tx, { positionId: fx.claimablePositionId });
    await expectSimulateSuccess(client, tx, owner);
  });

  it("forceClaim (keeper) on a position whose market is resolved", async (ctx) => {
    if (fx.claimablePositionId === undefined) {
      guard.skipFixableBySeed(ctx, "claimablePositionId", { preset: "with-claim" });
    }
    const tx = new Transaction();
    forceClaim(client, tx, { positionId: fx.claimablePositionId });
    await expectSimulateSuccess(client, tx);
  });
});
