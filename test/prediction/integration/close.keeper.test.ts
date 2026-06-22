import { getPosition } from "~predict/fetch.ts";
import { cancelClose, confirmClose, requestClose } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape } from "../helpers/events.ts";
import { createOpenPosition, INTEGRATION_FAR_FUTURE } from "../helpers/integration-positions.ts";
import {
  executeAndFetch,
  requireIntegrationKeeper,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

/**
 * Keeper close pipeline — `cancelClose` / `confirmClose` event shapes.
 * Run via `pnpm test:integration:keeper`.
 */
describe.skipIf(!hasWriteCredentials())("close keeper integration (sign + execute)", () => {
  let ctx: IntegrationCtx;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("keeper cancelClose emits CloseCancelled(by_self=false)", async (testCtx) => {
    requireIntegrationKeeper(ctx, testCtx);
    const positionId = await createOpenPosition(ctx);
    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      requestClose(ctx.client, tx, {
        positionId,
        minProceeds: 1n,
        expiryTs: INTEGRATION_FAR_FUTURE,
      });
    });

    const result = await executeAndFetch(ctx.client, ctx.keeper!, (tx) => {
      cancelClose(ctx.client, tx, { positionId });
    });
    const cancelEv = expectEvent(result, EVENT_CONTRACT.CloseCancelled.suffix, {
      position_id: String(positionId),
      by_self: false,
    });
    expectEventShape(cancelEv, EVENT_CONTRACT.CloseCancelled);
  }, 240_000);

  it("keeper confirmClose emits CloseConfirmed with proceeds", async (testCtx) => {
    requireIntegrationKeeper(ctx, testCtx);
    const positionId = await createOpenPosition(ctx);
    await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      requestClose(ctx.client, tx, {
        positionId,
        minProceeds: 1n,
        expiryTs: INTEGRATION_FAR_FUTURE,
      });
    });

    const result = await executeAndFetch(ctx.client, ctx.keeper!, (tx) => {
      confirmClose(ctx.client, tx, { positionId, proceeds: 1n });
    });
    const confirmEv = expectEvent(result, EVENT_CONTRACT.CloseConfirmed.suffix, {
      position_id: String(positionId),
      proceeds: "1",
    });
    expectEventShape(confirmEv, EVENT_CONTRACT.CloseConfirmed);
  }, 240_000);
});
