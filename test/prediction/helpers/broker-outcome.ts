/**
 * Poll chain events for resting orders (fill / cancel / timeout).
 */
import { getOrder } from "~predict/fetch.ts";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import type { IntegrationCtx } from "./integration-setup.ts";
import { findChainEventByOrderId } from "./query-prediction-events.ts";

export type BrokerChainOutcome = "filled" | "cancelled" | "open" | "timeout";

export interface BrokerOutcomeResult {
  outcome: BrokerChainOutcome;
  waitMs: number;
  refundAmount?: bigint;
  positionId?: bigint;
}

export async function waitForBrokerChainOutcome(
  ctx: IntegrationCtx,
  orderId: bigint,
  deadlineMs: number,
  pollMs = 1_000,
): Promise<BrokerOutcomeResult> {
  const started = Date.now();
  const deadline = started + deadlineMs;

  while (Date.now() < deadline) {
    const filled = await findChainEventByOrderId(ctx.client, EVENT_CONTRACT.OrderFilled, orderId);
    if (filled) {
      return {
        outcome: "filled",
        waitMs: Date.now() - started,
        positionId: BigInt(String(filled.json.position_id)),
      };
    }
    const cancelled = await findChainEventByOrderId(
      ctx.client,
      EVENT_CONTRACT.OrderCancelled,
      orderId,
    );
    if (cancelled) {
      return {
        outcome: "cancelled",
        waitMs: Date.now() - started,
        refundAmount: BigInt(String(cancelled.json.refund_amount)),
      };
    }
    try {
      const order = await getOrder(ctx.client, { orderId });
      if (order.kind !== "OPEN") {
        const lateFill = await findChainEventByOrderId(
          ctx.client,
          EVENT_CONTRACT.OrderFilled,
          orderId,
        );
        if (lateFill) {
          return {
            outcome: "filled",
            waitMs: Date.now() - started,
            positionId: BigInt(String(lateFill.json.position_id)),
          };
        }
        const lateCancel = await findChainEventByOrderId(
          ctx.client,
          EVENT_CONTRACT.OrderCancelled,
          orderId,
        );
        if (lateCancel) {
          return {
            outcome: "cancelled",
            waitMs: Date.now() - started,
            refundAmount: BigInt(String(lateCancel.json.refund_amount)),
          };
        }
      }
    } catch {
      /* order gone — re-check events next poll */
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  return { outcome: "timeout", waitMs: Date.now() - started };
}
