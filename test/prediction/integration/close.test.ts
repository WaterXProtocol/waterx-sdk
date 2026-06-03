import { getPosition } from "~predict/fetch.ts";
import { requestClose } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape } from "../helpers/events.ts";
import {
  createOpenPosition,
  findOpenPosition,
  INTEGRATION_FAR_FUTURE,
} from "../helpers/integration-positions.ts";
import {
  executeAndFetch,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

/**
 * Owner close pipeline — `requestClose` event shape (keeper fill/confirm tests live in
 * `close.keeper.integration.test.ts`).
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
    const result = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
      requestClose(ctx.client, tx, {
        positionId: positionId!,
        minProceeds: 1n,
        expiryTs: INTEGRATION_FAR_FUTURE,
      });
    });
    const ev = expectEvent(result, EVENT_CONTRACT.CloseRequested.suffix, {
      position_id: String(positionId),
      min_proceeds: "1",
    });
    expectEventShape(ev, EVENT_CONTRACT.CloseRequested);
    expect(typeof ev.json.order_id).toBe("string");
    expect(BigInt(String(ev.json.order_id))).not.toBe(BigInt(String(positionId)));

    const after = await getPosition(ctx.client, { positionId: positionId! });
    expect(after.status).toBe("PENDING_CLOSE");
  }, 180_000);

  // Rescue path — see `tests/e2e/close.e2e.test.ts` + `pnpm seed:testnet -- --preset=with-rescue`.
  it.skip("selfCancelClose (rescue path) — see e2e suite", () => {});
});
