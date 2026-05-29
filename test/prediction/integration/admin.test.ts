import { Transaction } from "@mysten/sui/transactions";
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

    const upTx = new Transaction();
    setMinReserve(ctx.client, upTx, { adminCap: cap, newReserve: bumped });
    const upRes = await executeAndFetch(ctx.client, ctx.signer, upTx);
    expectEvent(upRes, "::events::MinReserveUpdated", {
      old_reserve: String(original),
      new_reserve: String(bumped),
    });

    const downTx = new Transaction();
    setMinReserve(ctx.client, downTx, { adminCap: cap, newReserve: original });
    const downRes = await executeAndFetch(ctx.client, ctx.signer, downTx);
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

    const upTx = new Transaction();
    setOrderCancelCooldownMs(ctx.client, upTx, { adminCap: cap, cooldownMs: bumped });
    const upRes = await executeAndFetch(ctx.client, ctx.signer, upTx);
    expectEvent(upRes, "::events::OrderCancelCooldownUpdated", {
      old_cooldown_ms: String(original),
      new_cooldown_ms: String(bumped),
    });

    const downTx = new Transaction();
    setOrderCancelCooldownMs(ctx.client, downTx, { adminCap: cap, cooldownMs: original });
    await executeAndFetch(ctx.client, ctx.signer, downTx);
  }, 240_000);

  it("pauseMarket + unpauseMarket emit MarketPaused and MarketUnpaused", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const pauseTx = new Transaction();
    pauseMarket(ctx.client, pauseTx, { adminCap: cap, marketId: OPEN_MARKET_BYTES });
    const pauseRes = await executeAndFetch(ctx.client, ctx.signer, pauseTx);
    expectEvent(pauseRes, "::events::MarketPaused");

    const market = await getMarketById(ctx.client, { marketId: OPEN_MARKET_BYTES });
    expect(market.paused).toBe(true);

    const unpauseTx = new Transaction();
    unpauseMarket(ctx.client, unpauseTx, { adminCap: cap, marketId: OPEN_MARKET_BYTES });
    const unpauseRes = await executeAndFetch(ctx.client, ctx.signer, unpauseTx);
    expectEvent(unpauseRes, "::events::MarketUnpaused");
  }, 240_000);

  it("addKeeper + removeKeeper emit KeeperAdded and KeeperRemoved (dummy address)", async (testCtx) => {
    if (!isAdmin) {
      testCtx.skip(true, "owner is not the AdminCap holder");
      return;
    }
    const addTx = new Transaction();
    addKeeper(ctx.client, addTx, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    const addRes = await executeAndFetch(ctx.client, ctx.signer, addTx);
    expectEvent(addRes, "::events::KeeperAdded", { keeper: PTB_DUMMY.delegate });

    const rmTx = new Transaction();
    removeKeeper(ctx.client, rmTx, { adminCap: cap, keeper: PTB_DUMMY.delegate });
    const rmRes = await executeAndFetch(ctx.client, ctx.signer, rmTx);
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
    const depTx = new Transaction();
    const [pay] = depTx.splitCoins(depTx.object(first.objectId), [1n]);
    depositSettlement(ctx.client, depTx, { adminCap: cap, payment: pay });
    await executeAndFetch(ctx.client, ctx.signer, depTx);

    const wdTx = new Transaction();
    adminWithdraw(ctx.client, wdTx, {
      adminCap: cap,
      amount: 1n,
      recipient: ctx.ownerAddress,
    });
    const wdRes = await executeAndFetch(ctx.client, ctx.signer, wdTx);
    expectEvent(wdRes, "::events::MarketRegistryWithdrawn", {
      amount: "1",
      recipient: ctx.ownerAddress,
    });
  }, 240_000);
});

function requirePredictionAdminCap(client: IntegrationCtx["client"]): string {
  return client.predictionAdminCap();
}
