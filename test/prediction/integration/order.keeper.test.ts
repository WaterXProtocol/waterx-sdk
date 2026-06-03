import { getOrderCursor, getPositionCursor } from "~predict/fetch.ts";
import { cancelOrder, fillOrder, placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import {
  INTEGRATION_FILLABLE_PRICE_CAP_BPS,
  INTEGRATION_MIN_FILL,
} from "../fixtures/ptb-params.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape } from "../helpers/events.ts";
import {
  INTEGRATION_FAR_FUTURE,
  INTEGRATION_OPEN_MARKET_BYTES,
} from "../helpers/integration-positions.ts";
import {
  executeAndFetch,
  requireIntegrationKeeper,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

/**
 * Keeper order lifecycle — `fillOrder` / `cancelOrder` event shapes.
 * Run via `pnpm test:integration:keeper` (needs registered keeper).
 */
describe.skipIf(!hasWriteCredentials())("order keeper integration (sign + execute)", () => {
  let ctx: IntegrationCtx;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("keeper fillOrder on a fresh order emits OrderFilled", async (testCtx) => {
    requireIntegrationKeeper(ctx, testCtx);
    const beforeOrder = await getOrderCursor(ctx.client);
    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      placeOrder(ctx.client, tx, {
        accountId: ctx.accountId,
        marketId: INTEGRATION_OPEN_MARKET_BYTES,
        selection: "YES",
        maxSpend: 1_000n,
        minShares: 1n,
        priceCapBps: INTEGRATION_FILLABLE_PRICE_CAP_BPS,
        expiryTs: INTEGRATION_FAR_FUTURE,
      });
    });
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId =
      afterOrder.back ?? (beforeOrder.back !== null ? beforeOrder.back + 1n : afterOrder.front);
    expect(orderId).toBeDefined();

    const beforePos = await getPositionCursor(ctx.client);
    const result = await executeAndFetch(ctx.client, ctx.keeper!, (tx) => {
      fillOrder(ctx.client, tx, { orderId: orderId!, ...INTEGRATION_MIN_FILL });
    });
    const ev = expectEvent(result, EVENT_CONTRACT.OrderFilled.suffix, {
      order_id: String(orderId),
      filled_shares: "1",
      filled_cost: "1",
    });
    expectEventShape(ev, EVENT_CONTRACT.OrderFilled);

    const afterPos = await getPositionCursor(ctx.client);
    const positionId =
      afterPos.back ?? (beforePos.back !== null ? beforePos.back + 1n : afterPos.front);
    expect(positionId).toBeDefined();
    expect(BigInt(String(ev.json.position_id))).toBe(positionId);
    expect(afterPos.count).toBeGreaterThan(beforePos.count);
  }, 180_000);

  it("keeper cancelOrder emits OrderCancelled with refund", async (testCtx) => {
    requireIntegrationKeeper(ctx, testCtx);
    const beforeOrder = await getOrderCursor(ctx.client);
    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      placeOrder(ctx.client, tx, {
        accountId: ctx.accountId,
        marketId: INTEGRATION_OPEN_MARKET_BYTES,
        selection: "YES",
        maxSpend: 1_000n,
        minShares: 1n,
        priceCapBps: 9_000n,
        expiryTs: INTEGRATION_FAR_FUTURE,
      });
    });
    const afterOrder = await getOrderCursor(ctx.client);
    const orderId =
      afterOrder.back ?? (beforeOrder.back !== null ? beforeOrder.back + 1n : afterOrder.front);
    expect(orderId).toBeDefined();

    const result = await executeAndFetch(ctx.client, ctx.keeper!, (tx) => {
      cancelOrder(ctx.client, tx, { orderId: orderId! });
    });
    const cancelEv = expectEvent(result, EVENT_CONTRACT.OrderCancelled.suffix, {
      order_id: String(orderId),
      refund_amount: "1000",
    });
    expectEventShape(cancelEv, EVENT_CONTRACT.OrderCancelled);
  }, 180_000);
});
