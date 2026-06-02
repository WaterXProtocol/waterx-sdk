import { Transaction } from "@mysten/sui/transactions";
import { getMarketById, getOrderCursor, getPositionCursor } from "~predict/fetch.ts";
import { claim, fillOrder, forceClaim, placeOrder, resolveMarket } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape, normalizeEnumField } from "../helpers/events.ts";
import {
  executeAndFetch,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

const FAR_FUTURE = 9_999_999_999_999n;

function uniqueMarketLabel(suffix: string): { label: string; bytes: Uint8Array } {
  const label = `pred-it-${suffix}-${Date.now().toString(36)}`;
  return { label, bytes: new Uint8Array(Buffer.from(label, "utf8")) };
}

/**
 * Claim / resolve integration — produces `MarketResolved` + `PositionClaimed` events using a
 * throwaway market created in-test (so we never resolve a shared testnet market like
 * `smoke-test-1`). Requires both an owner key (placeOrder + claim) and a keeper key
 * (fillOrder + resolveMarket + forceClaim).
 */
describe.skipIf(!hasWriteCredentials())("claim integration (sign + execute)", () => {
  let ctx: IntegrationCtx;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("resolveMarket + claim emit MarketResolved and PositionClaimed", async (testCtx) => {
    if (!ctx.keeper) {
      testCtx.skip(true, "needs keeper key to resolveMarket / fillOrder");
      return;
    }
    const { bytes } = uniqueMarketLabel("claim");

    // 1. placeOrder on the new market (auto-creates the market).
    const beforeOrder = await getOrderCursor(ctx.client);
    const placeTx = new Transaction();
    placeOrder(ctx.client, placeTx, {
      accountId: ctx.accountId,
      marketId: bytes,
      selection: "YES",
      maxSpend: 1_000n,
      minShares: 1n,
      priceCapBps: 9_000n,
      expiryTs: FAR_FUTURE,
    });
    await executeAndFetch(ctx.client, ctx.signer, placeTx);
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId =
      afterOrder.back ?? (beforeOrder.back !== null ? beforeOrder.back + 1n : afterOrder.front);
    expect(orderId).toBeDefined();

    // 2. keeper fillOrder → creates position.
    const beforePos = await getPositionCursor(ctx.client);
    const fillTx = new Transaction();
    fillOrder(ctx.client, fillTx, { orderId: orderId!, filledShares: 1n, filledCost: 1n });
    await executeAndFetch(ctx.client, ctx.keeper, fillTx);
    const afterPos = await getPositionCursor(ctx.client);
    const positionId =
      afterPos.back ?? (beforePos.back !== null ? beforePos.back + 1n : afterPos.front);
    expect(positionId).toBeDefined();

    // 3. keeper resolveMarket YES → MarketResolved event.
    const resolveTx = new Transaction();
    resolveMarket(ctx.client, resolveTx, { marketId: bytes, outcome: "YES" });
    const resolveResult = await executeAndFetch(ctx.client, ctx.keeper, resolveTx);
    const resolveEv = expectEvent(resolveResult, EVENT_CONTRACT.MarketResolved.suffix);
    expectEventShape(resolveEv, EVENT_CONTRACT.MarketResolved);
    expect(normalizeEnumField(resolveEv.json.outcome)).toBe("YES");

    const market = await getMarketById(ctx.client, { marketId: bytes });
    expect(market.resolved).toBe(true);
    expect(market.outcome).toBe("YES");

    // 4. owner claim → PositionClaimed event with payout = filled_shares.
    const claimTx = new Transaction();
    claim(ctx.client, claimTx, { positionId: positionId! });
    const claimResult = await executeAndFetch(ctx.client, ctx.signer, claimTx);
    const claimEv = expectEvent(claimResult, EVENT_CONTRACT.PositionClaimed.suffix, {
      position_id: String(positionId),
      payout: "1",
    });
    expectEventShape(claimEv, EVENT_CONTRACT.PositionClaimed);
  }, 360_000);

  it("forceClaim by keeper emits PositionClaimed on a resolved market", async (testCtx) => {
    if (!ctx.keeper) {
      testCtx.skip(true, "needs keeper key for forceClaim");
      return;
    }
    const { bytes } = uniqueMarketLabel("forceclaim");
    const beforeOrder = await getOrderCursor(ctx.client);
    const placeTx = new Transaction();
    placeOrder(ctx.client, placeTx, {
      accountId: ctx.accountId,
      marketId: bytes,
      selection: "YES",
      maxSpend: 1_000n,
      minShares: 1n,
      priceCapBps: 9_000n,
      expiryTs: FAR_FUTURE,
    });
    await executeAndFetch(ctx.client, ctx.signer, placeTx);
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId =
      afterOrder.back ?? (beforeOrder.back !== null ? beforeOrder.back + 1n : afterOrder.front);

    const beforePos = await getPositionCursor(ctx.client);
    const fillTx = new Transaction();
    fillOrder(ctx.client, fillTx, { orderId: orderId!, filledShares: 1n, filledCost: 1n });
    await executeAndFetch(ctx.client, ctx.keeper, fillTx);
    const afterPos = await getPositionCursor(ctx.client);
    const positionId =
      afterPos.back ?? (beforePos.back !== null ? beforePos.back + 1n : afterPos.front);

    const resolveTx = new Transaction();
    resolveMarket(ctx.client, resolveTx, { marketId: bytes, outcome: "YES" });
    await executeAndFetch(ctx.client, ctx.keeper, resolveTx);

    const tx = new Transaction();
    forceClaim(ctx.client, tx, { positionId: positionId! });
    const result = await executeAndFetch(ctx.client, ctx.keeper, tx);
    const forceEv = expectEvent(result, EVENT_CONTRACT.PositionClaimed.suffix, {
      position_id: String(positionId),
      payout: "1",
    });
    expectEventShape(forceEv, EVENT_CONTRACT.PositionClaimed);
  }, 360_000);
});
