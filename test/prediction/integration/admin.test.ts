import { E2E_OPEN_MARKET_LABEL } from "~predict-scripts/seed/stages.ts";
import {
  addKeeper,
  adminWithdraw,
  depositSettlement,
  pauseMarket,
  removeKeeper,
  setMinReserve,
  setOrderCancelCooldownMs,
  unpauseMarket,
} from "~predict/admin.ts";
import { getMarketById, getRegistry } from "~predict/fetch.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { PTB_DUMMY } from "../fixtures/ptb-params.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent } from "../helpers/events.ts";
import {
  executeAndFetch,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

const OPEN_MARKET_BYTES = new Uint8Array(Buffer.from(E2E_OPEN_MARKET_LABEL, "utf8"));

async function ownerHoldsAdminCap(ctx: IntegrationCtx, cap: string): Promise<boolean> {
  try {
    const res = await ctx.client.grpcClient.getObject({ objectId: cap });
    const owner = res.object?.owner;
    if (!owner) return false;
    if (owner.$kind === "AddressOwner") {
      return owner.AddressOwner.toLowerCase() === ctx.ownerAddress.toLowerCase();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Admin integration — covers `MarketPaused` / `MarketUnpaused` / `MinReserveUpdated` /
 * `OrderCancelCooldownUpdated` / `KeeperAdded` / `KeeperRemoved` / `MarketRegistryWithdrawn`
 * events. Every test round-trips state so the test suite is idempotent. Skipped when the
 * configured owner does not hold the `AdminCap`.
 */
describe.skipIf(!hasWriteCredentials())("admin integration (sign + execute)", () => {
  let ctx: IntegrationCtx;
  let isAdmin = false;
  let cap: string;

  beforeAll(async () => {
    ctx = await setupIntegration();
    cap = requirePredictionAdminCap(ctx.client);
    isAdmin = await ownerHoldsAdminCap(ctx, cap);
  }, 180_000);

  it("setMinReserve emits MinReserveUpdated (round-trip)", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const reg = await getRegistry(ctx.client);
    const original = reg.minReserve;
    const bumped = original + 1n;

    const upRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      setMinReserve(ctx.client, tx, { adminCap: cap, newReserve: bumped });
    });
    expectEvent(upRes, "::events::MinReserveUpdated", {
      old_reserve: String(original),
      new_reserve: String(bumped),
    });

    const downRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      setMinReserve(ctx.client, tx, { adminCap: cap, newReserve: original });
    });
    expectEvent(downRes, "::events::MinReserveUpdated", {
      old_reserve: String(bumped),
      new_reserve: String(original),
    });
  }, 240_000);

  it("setOrderCancelCooldownMs emits OrderCancelCooldownUpdated (round-trip)", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const reg = await getRegistry(ctx.client);
    const original = reg.orderCancelCooldownMs;
    const bumped = original + 1n;

    const upRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      setOrderCancelCooldownMs(ctx.client, tx, { adminCap: cap, cooldownMs: bumped });
    });
    expectEvent(upRes, "::events::OrderCancelCooldownUpdated", {
      old_cooldown_ms: String(original),
      new_cooldown_ms: String(bumped),
    });

    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      setOrderCancelCooldownMs(ctx.client, tx, { adminCap: cap, cooldownMs: original });
    });
  }, 240_000);

  it("pauseMarket + unpauseMarket emit MarketPaused and MarketUnpaused", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const pauseRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      pauseMarket(ctx.client, tx, { adminCap: cap, marketId: OPEN_MARKET_BYTES });
    });
    expectEvent(pauseRes, "::events::MarketPaused");

    const market = await getMarketById(ctx.client, { marketId: OPEN_MARKET_BYTES });
    expect(market.paused).toBe(true);

    const unpauseRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      unpauseMarket(ctx.client, tx, { adminCap: cap, marketId: OPEN_MARKET_BYTES });
    });
    expectEvent(unpauseRes, "::events::MarketUnpaused");
  }, 240_000);

  it("addKeeper + removeKeeper emit KeeperAdded and KeeperRemoved (dummy address)", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const addRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      addKeeper(ctx.client, tx, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    });
    expectEvent(addRes, "::events::KeeperAdded", { keeper: PTB_DUMMY.delegate });

    const rmRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      removeKeeper(ctx.client, tx, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    });
    expectEvent(rmRes, "::events::KeeperRemoved", { keeper: PTB_DUMMY.delegate });
  }, 240_000);

  it("depositSettlement + adminWithdraw emit MarketRegistryWithdrawn", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const coinPage = await ctx.client.listCoins({
      owner: ctx.ownerAddress,
      coinType: ctx.client.settlementCoinType(),
    });
    const first = (coinPage as { objects?: { objectId?: string }[] }).objects?.[0];
    if (!first?.objectId) {
      testCtx.skip(true, "no settlement coin in admin wallet");
      return;
    }
    const coinObjectId = first.objectId;
    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      const [pay] = tx.splitCoins(tx.object(coinObjectId), [1n]);
      depositSettlement(ctx.client, tx, { adminCap: cap, payment: pay });
    });

    const wdRes = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      adminWithdraw(ctx.client, tx, {
        adminCap: cap,
        amount: 1n,
        recipient: ctx.ownerAddress,
      });
    });
    expectEvent(wdRes, "::events::MarketRegistryWithdrawn", {
      amount: "1",
      recipient: ctx.ownerAddress,
    });
  }, 240_000);
});

function requirePredictionAdminCap(client: IntegrationCtx["client"]): string {
  return client.predictionAdminCap();
}
