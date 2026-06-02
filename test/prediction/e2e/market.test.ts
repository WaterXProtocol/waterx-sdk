import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { resolveMarket } from "~predict/prediction.ts";
import { beforeAll, describe, it } from "vitest";

import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

/**
 * Market lifecycle PTB simulate (covers `MarketResolved` indexer event). Pause / unpause /
 * keeper management are admin-only and live in `admin.e2e.test.ts`.
 */
describe("market PTB simulate (testnet)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx);
  }, 120_000);

  it("resolveMarket (keeper) on an unresolved market", async (ctx) => {
    const marketBytes = fx.openMarketIdBytes ?? fx.marketIdBytes;
    if (!marketBytes) {
      guard.skipFixableBySeed(ctx, "openMarketIdBytes", { stage: "place-open" });
    }
    const tx = new Transaction();
    resolveMarket(client, tx, { marketId: marketBytes, outcome: "YES" });
    await expectSimulateSuccess(client, tx);
  });
});
