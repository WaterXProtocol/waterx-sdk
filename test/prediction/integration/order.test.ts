import { getOrderCursor } from "~predict/fetch.ts";
import { placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape, normalizeEnumField } from "../helpers/events.ts";
import {
  INTEGRATION_FAR_FUTURE,
  INTEGRATION_OPEN_MARKET_BYTES,
} from "../helpers/integration-positions.ts";
import {
  executeAndFetch,
  hexToBytes,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

/**
 * Owner order lifecycle — `OrderPlaced` event shape. Keeper fill/cancel tests live in
 * `order.keeper.integration.test.ts`.
 */
describe.skipIf(!hasWriteCredentials())("order integration (sign + execute)", () => {
  let ctx: IntegrationCtx;
  let openOrderId: bigint | undefined;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("placeOrder emits OrderPlaced with the registered account id", async () => {
    const before = await getOrderCursor(ctx.client);
    const result = await executeAndFetch(ctx.client, ctx.signer, (tx) => {
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
    const ev = expectEvent(result, EVENT_CONTRACT.OrderPlaced.suffix, {
      account_id: ctx.accountId,
      receiver_account_id: ctx.accountId,
      max_spend: "1000",
      min_shares: "1",
      price_cap: "9000",
      by_admin: false,
    });
    expectEventShape(ev, EVENT_CONTRACT.OrderPlaced);
    expect(normalizeEnumField(ev.json.selection)).toBe("YES");

    const after = await getOrderCursor(ctx.client);
    openOrderId =
      after.back ?? (before.back !== null ? before.back + 1n : (after.front ?? undefined));
    expect(openOrderId, "orderId should be inferrable from order cursor").toBeDefined();
    expect(BigInt(String(ev.json.order_id))).toBe(openOrderId);
  });

  // Rescue path — see `tests/e2e/order.e2e.test.ts` + `pnpm seed:testnet -- --preset=with-rescue`.
  it.skip("selfCancelOrder (rescue path) — see e2e suite", () => {});
});

void hexToBytes;
