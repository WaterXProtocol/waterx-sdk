import { Transaction } from "@mysten/sui/transactions";
import { E2E_OPEN_MARKET_LABEL } from "~predict-scripts/seed/stages.ts";
import { getOrderCursor, getPosition, getPositionCursor } from "~predict/fetch.ts";
import {
  cancelClose,
  confirmClose,
  fillOrder,
  placeOrder,
  requestClose,
} from "~predict/prediction.ts";
import type { PositionView } from "~predict/types.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape } from "../helpers/events.ts";
import {
  executeAndFetch,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

const FAR_FUTURE = 9_999_999_999_999n;
const OPEN_MARKET_BYTES = new Uint8Array(Buffer.from(E2E_OPEN_MARKET_LABEL, "utf8"));

async function createOpenPosition(ctx: IntegrationCtx): Promise<bigint> {
  if (!ctx.keeper) throw new Error("createOpenPosition requires a keeper key");
  const beforeOrder = await getOrderCursor(ctx.client);
  const placeTx = new Transaction();
  placeOrder(ctx.client, placeTx, {
    accountId: ctx.accountId,
    marketId: OPEN_MARKET_BYTES,
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
  if (orderId == null) throw new Error("createOpenPosition: could not infer orderId");

  const beforePos = await getPositionCursor(ctx.client);
  const fillTx = new Transaction();
  fillOrder(ctx.client, fillTx, { orderId, filledShares: 1n, filledCost: 1n });
  await executeAndFetch(ctx.client, ctx.keeper, fillTx);
  const afterPos = await getPositionCursor(ctx.client);
  const positionId =
    afterPos.back ?? (beforePos.back !== null ? beforePos.back + 1n : afterPos.front);
  if (positionId == null) throw new Error("createOpenPosition: could not infer positionId");
  return positionId;
}

async function findOpenPosition(ctx: IntegrationCtx): Promise<PositionView | undefined> {
  const cursor = await getPositionCursor(ctx.client);
  if (cursor.count === 0n || cursor.front == null) return undefined;
  const back = cursor.back ?? cursor.front;
  for (let id = cursor.front; id <= back; id += 1n) {
    try {
      const p = await getPosition(ctx.client, { positionId: id });
      if (p.accountId === ctx.accountId && p.status === "OPEN") return p;
    } catch {
      /* gap */
    }
  }
  return undefined;
}

/**
 * Close pipeline integration — verifies `CloseRequested` / `CloseConfirmed` / `CloseCancelled`
 * events are emitted in the shape the indexer's `close_*` handlers decode.
 *
 * Each test creates a fresh OPEN position (place + fill) when a keeper key is available; without
 * a keeper, falls back to the seeded `openPositionId` when present. Otherwise the test skips.
 */
describe.skipIf(!hasWriteCredentials())("close pipeline integration (sign + execute)", () => {
  let ctx: IntegrationCtx;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("requestClose on an OPEN position emits CloseRequested", async (testCtx) => {
    let positionId: bigint | undefined;
    if (ctx.keeper) {
      positionId = await createOpenPosition(ctx);
    } else {
      const found = await findOpenPosition(ctx);
      if (!found) {
        testCtx.skip(true, "no OPEN position available and no keeper key to create one");
        return;
      }
      positionId = found.positionId;
    }
    const tx = new Transaction();
    requestClose(ctx.client, tx, {
      positionId: positionId!,
      minProceeds: 1n,
      expiryTs: FAR_FUTURE,
    });
    const result = await executeAndFetch(ctx.client, ctx.signer, tx);
    const ev = expectEvent(result, EVENT_CONTRACT.CloseRequested.suffix, {
      position_id: String(positionId),
      min_proceeds: "1",
    });
    expectEventShape(ev, EVENT_CONTRACT.CloseRequested);
    expect(typeof ev.json.order_id).toBe("string");
    expect(BigInt(String(ev.json.order_id))).not.toBe(BigInt(String(positionId)));

    // After requestClose the position should be PENDING_CLOSE.
    const after = await getPosition(ctx.client, { positionId: positionId! });
    expect(after.status).toBe("PENDING_CLOSE");
  }, 180_000);

  // `selfCancelClose` is a rescue path: the contract requires `now >= close_order.self_cancel_after_ts`
  // (requestClose + 30s cooldown) AND `now >= close_order.expiry_ts`. Cycling through this in an
  // integration test would add 30+ seconds of wall-clock waiting per run. The PTB shape + Move call
  // is already exercised by `tests/e2e/close.e2e.test.ts > selfCancelClose on an expired
  // PENDING_CLOSE position (rescue path)` once `pnpm seed:testnet -- --preset=with-rescue` has run.
  it.skip("selfCancelClose (rescue path) — see e2e suite", () => {});

  it("keeper cancelClose emits CloseCancelled(by_self=false)", async (testCtx) => {
    if (!ctx.keeper) {
      testCtx.skip(true, "needs keeper for cancelClose");
      return;
    }
    const positionId = await createOpenPosition(ctx);
    const reqTx = new Transaction();
    requestClose(ctx.client, reqTx, { positionId, minProceeds: 1n, expiryTs: FAR_FUTURE });
    await executeAndFetch(ctx.client, ctx.signer, reqTx);

    const tx = new Transaction();
    cancelClose(ctx.client, tx, { positionId });
    const result = await executeAndFetch(ctx.client, ctx.keeper, tx);
    const cancelEv = expectEvent(result, EVENT_CONTRACT.CloseCancelled.suffix, {
      position_id: String(positionId),
      by_self: false,
    });
    expectEventShape(cancelEv, EVENT_CONTRACT.CloseCancelled);
  }, 240_000);

  it("keeper confirmClose emits CloseConfirmed with proceeds", async (testCtx) => {
    if (!ctx.keeper) {
      testCtx.skip(true, "needs keeper for confirmClose");
      return;
    }
    const positionId = await createOpenPosition(ctx);
    const reqTx = new Transaction();
    requestClose(ctx.client, reqTx, { positionId, minProceeds: 1n, expiryTs: FAR_FUTURE });
    await executeAndFetch(ctx.client, ctx.signer, reqTx);

    const tx = new Transaction();
    confirmClose(ctx.client, tx, { positionId, proceeds: 1n });
    const result = await executeAndFetch(ctx.client, ctx.keeper, tx);
    const confirmEv = expectEvent(result, EVENT_CONTRACT.CloseConfirmed.suffix, {
      position_id: String(positionId),
      proceeds: "1",
    });
    expectEventShape(confirmEv, EVENT_CONTRACT.CloseConfirmed);
  }, 240_000);
});
