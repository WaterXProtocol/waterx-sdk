import { Transaction } from "@mysten/sui/transactions";
import type { PredictClient } from "~predict/client.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureSummary } from "../helpers/e2e-skip.ts";
import { expectSimulateSuccess } from "../helpers/simulate.ts";

describe("PredictClient testnet smoke", () => {
  let client: PredictClient;
  let fixtures: E2eFixtures;

  beforeAll(async () => {
    client = await createE2eClient();
    fixtures = await discoverFixtures(client);
  }, 120_000);

  it("getObject reads shared GlobalConfig", async () => {
    const obj = await client.getObject(client.globalConfigId());
    expect(obj).toBeDefined();
  });

  it("getObjects batches reads", async () => {
    const ids = [client.globalConfigId(), client.accountRegistry()].filter(Boolean);
    const res = await client.getObjects(ids);
    expect(res.objects?.length).toBe(ids.length);
  });

  it("listOwnedObjects accepts query", async () => {
    const page = await client.listOwnedObjects(
      "0x0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(page.objects).toBeDefined();
  });

  it("simulateTransaction runs dry-run next_order_id-style view PTB", async () => {
    const tx = new Transaction();
    tx.moveCall({
      target: `${client.packageId()}::waterx_prediction::next_order_id`,
      typeArguments: [client.settlementCoinType()],
      arguments: [tx.object(client.marketRegistry())],
    });
    await expectSimulateSuccess(client, tx);
  });

  it("fixtures discovery found chain or env context", (ctx) => {
    const hasMarket = fixtures.marketKey !== undefined || fixtures.marketIdBytes !== undefined;
    const hasOrderOrPosition = fixtures.orderId !== undefined || fixtures.positionId !== undefined;
    if (!hasMarket && !hasOrderOrPosition) {
      ctx.skip(
        true,
        `No orders/positions/markets discovered on testnet. Fixtures: ${fixtureSummary(fixtures)}.`,
      );
    }
    expect(hasMarket || hasOrderOrPosition).toBe(true);
  });

  it("discovery exposes fixture metadata", () => {
    expect(fixtures.accountId).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(fixtures.meta.accountId).toBeTruthy();
  });
});
