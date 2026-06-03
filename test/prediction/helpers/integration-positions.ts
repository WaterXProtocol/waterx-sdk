import { E2E_OPEN_MARKET_LABEL } from "~predict-scripts/seed/stages.ts";
import { getOrderCursor, getPosition, getPositionCursor } from "~predict/fetch.ts";
import { fillOrder, placeOrder } from "~predict/prediction.ts";
import type { PositionView } from "~predict/types.ts";

import {
  INTEGRATION_FILLABLE_PRICE_CAP_BPS,
  INTEGRATION_MIN_FILL,
} from "../fixtures/ptb-params.ts";
import { executeAndFetch, type IntegrationCtx } from "./integration-setup.ts";

export const INTEGRATION_FAR_FUTURE = 9_999_999_999_999n;
export const INTEGRATION_OPEN_MARKET_BYTES = new Uint8Array(
  Buffer.from(E2E_OPEN_MARKET_LABEL, "utf8"),
);

/** place + keeper fill on the seeded open market; returns the new position id. */
export async function createOpenPosition(ctx: IntegrationCtx): Promise<bigint> {
  if (!ctx.keeper) throw new Error("createOpenPosition requires a registered keeper key");
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
  if (orderId == null) throw new Error("createOpenPosition: could not infer orderId");

  const beforePos = await getPositionCursor(ctx.client);
  await executeAndFetch(ctx.client, ctx.keeper, (tx) => {
    fillOrder(ctx.client, tx, { orderId, ...INTEGRATION_MIN_FILL });
  });
  const afterPos = await getPositionCursor(ctx.client);
  const positionId =
    afterPos.back ?? (beforePos.back !== null ? beforePos.back + 1n : afterPos.front);
  if (positionId == null) throw new Error("createOpenPosition: could not infer positionId");
  return positionId;
}

export async function findOpenPosition(ctx: IntegrationCtx): Promise<PositionView | undefined> {
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
