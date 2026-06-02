import type { PredictClient } from "~predict/client.ts";
import {
  getAccountData,
  getAccountIds,
  getAccountOrderIds,
  getAccountOrderIdsByMarketId,
  getAccountPositionIds,
  getAccountPositionIdsByMarketId,
  getKeeperAddresses,
  getMarketById,
  getMarketByKey,
  getOrder,
  getOrderCursor,
  getPosition,
  getPositionCursor,
  getRegistry,
  getResolvedMarketCursor,
  getUnresolvedMarketCursor,
  isKeeper,
} from "~predict/fetch.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { createE2eClient, discoverFixtures, type E2eFixtures } from "../helpers/e2e-context.ts";
import { fixtureGuards } from "../helpers/e2e-skip.ts";

describe("fetch helpers (testnet simulate)", () => {
  let client: PredictClient;
  let fx: E2eFixtures;
  let guard: ReturnType<typeof fixtureGuards>;

  beforeAll(async () => {
    client = await createE2eClient();
    fx = await discoverFixtures(client);
    guard = fixtureGuards(fx);
  }, 120_000);

  it("getRegistry", async () => {
    const r = await getRegistry(client);
    expect(r.nextOrderId).toBeGreaterThanOrEqual(0n);
  });

  it("cursor views", async () => {
    await expect(getOrderCursor(client)).resolves.toMatchObject({ count: expect.any(BigInt) });
    await expect(getPositionCursor(client)).resolves.toMatchObject({ count: expect.any(BigInt) });
    await expect(getUnresolvedMarketCursor(client)).resolves.toMatchObject({
      count: expect.any(BigInt),
    });
    await expect(getResolvedMarketCursor(client)).resolves.toMatchObject({
      count: expect.any(BigInt),
    });
  });

  it("getMarketByKey when marketKey discovered", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.marketKey, "marketKey");
    const m = await getMarketByKey(client, { marketKey: fx.marketKey });
    expect(m.marketKey).toBe(fx.marketKey);
  });

  it("getMarketById when bytes discovered", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.marketIdBytes, "marketIdBytes");
    const m = await getMarketById(client, { marketId: fx.marketIdBytes });
    expect(m.marketIdHex).toBeTruthy();
  });

  it("getOrder when order id discovered", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.orderId, "orderId");
    const o = await getOrder(client, { orderId: fx.orderId });
    expect(o.orderId).toBe(fx.orderId);
  });

  it("getPosition when position id discovered", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.positionId, "positionId");
    const p = await getPosition(client, { positionId: fx.positionId });
    expect(p.positionId).toBe(fx.positionId);
  });

  it("account-scoped views when account and market discovered", async (ctx) => {
    guard.skipUnlessDefined(ctx, fx.accountId, "accountId");
    guard.skipUnlessDefined(ctx, fx.marketKey, "marketKey");
    await expect(getAccountData(client, { accountId: fx.accountId })).resolves.toMatchObject({
      accountId: fx.accountId,
    });
    await expect(
      getAccountOrderIds(client, { accountId: fx.accountId, marketKey: fx.marketKey }),
    ).resolves.toEqual(expect.any(Array));
    await expect(
      getAccountPositionIds(client, { accountId: fx.accountId, marketKey: fx.marketKey }),
    ).resolves.toEqual(expect.any(Array));
    if (fx.marketIdBytes !== undefined) {
      await expect(
        getAccountOrderIdsByMarketId(client, {
          accountId: fx.accountId,
          marketId: fx.marketIdBytes,
        }),
      ).resolves.toEqual(expect.any(Array));
      await expect(
        getAccountPositionIdsByMarketId(client, {
          accountId: fx.accountId,
          marketId: fx.marketIdBytes,
        }),
      ).resolves.toEqual(expect.any(Array));
    }
  });

  it("keeper views", async () => {
    const addrs = await getKeeperAddresses(client);
    expect(Array.isArray(addrs)).toBe(true);
    if (addrs[0]) {
      await expect(isKeeper(client, { keeper: addrs[0] })).resolves.toEqual(expect.any(Boolean));
    }
  });
});
