import { Transaction } from "@mysten/sui/transactions";
import { E2E_OPEN_MARKET_LABEL } from "~predict-scripts/seed/stages.ts";
import { getOrderCursor, getPositionCursor } from "~predict/fetch.ts";
import { cancelOrder, fillOrder, placeOrder } from "~predict/prediction.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { hasWriteCredentials } from "../helpers/env.ts";
import { expectEvent, expectEventShape, normalizeEnumField } from "../helpers/events.ts";
import {
  executeAndFetch,
  hexToBytes,
  setupIntegration,
  type IntegrationCtx,
} from "../helpers/integration-setup.ts";

const FAR_FUTURE = 9_999_999_999_999n;
const OPEN_MARKET_BYTES = new Uint8Array(Buffer.from(E2E_OPEN_MARKET_LABEL, "utf8"));

/**
 * Order lifecycle integration — verifies `OrderPlaced` / `OrderFilled` / `OrderCancelled` events
 * are emitted with the field shapes the data-infra indexer decodes. Keeper-only tests skip when
 * `E2E_KEEPER_PRIVATE_KEY` (or the owner) is not registered as a keeper.
 */
describe.skipIf(!hasWriteCredentials())("order integration (sign + execute)", () => {
  let ctx: IntegrationCtx;
  let openOrderId: bigint | undefined;

  beforeAll(async () => {
    ctx = await setupIntegration();
  }, 180_000);

  it("placeOrder emits OrderPlaced with the registered account id", async () => {
    const before = await getOrderCursor(ctx.client);
    const tx = new Transaction();
    placeOrder(ctx.client, tx, {
      accountId: ctx.accountId,
      marketId: OPEN_MARKET_BYTES,
      selection: "YES",
      maxSpend: 1_000n,
      minShares: 1n,
      priceCapBps: 9_000n,
      expiryTs: FAR_FUTURE,
    });
    const result = await executeAndFetch(ctx.client, ctx.signer, tx);
    const ev = expectEvent(result, EVENT_CONTRACT.OrderPlaced.suffix, {
      account_id: ctx.accountId,
      max_spend: "1000",
      min_shares: "1",
      price_cap: "9000",
      by_admin: false,
    });
    expectEventShape(ev, EVENT_CONTRACT.OrderPlaced);
    expect(normalizeEnumField(ev.json.selection)).toBe("YES");

    // Derive orderId from cursor (event reports it but type differs across SDK versions).
    const after = await getOrderCursor(ctx.client);
    openOrderId =
      after.back ?? (before.back !== null ? before.back + 1n : (after.front ?? undefined));
    expect(openOrderId, "orderId should be inferrable from order cursor").toBeDefined();
    // Sanity check the orderId matches the event payload.
    expect(BigInt(String(ev.json.order_id))).toBe(openOrderId);
  });

  // `selfCancelOrder` is a rescue path: the contract requires `now >= self_cancel_after_ts`
  // (place + 30s cooldown) AND `now >= expiry_ts`. Cycling through this in an integration
  // test would add 30+ seconds of wall-clock waiting per run. The PTB shape + Move call is
  // already exercised by `tests/e2e/order.e2e.test.ts > selfCancelOrder on an expired OPEN
  // order (rescue path)` once `pnpm seed:testnet -- --preset=with-rescue` has been run.
  it.skip("selfCancelOrder (rescue path) — see e2e suite", () => {});

  it.skipIf(false)(
    "keeper fillOrder on a fresh order emits OrderFilled",
    async (testCtx) => {
      if (!ctx.keeper) {
        testCtx.skip(true, "no keeper key registered (E2E_KEEPER_PRIVATE_KEY)");
        return;
      }
      // Place a fresh order to fill.
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
      expect(orderId).toBeDefined();

      const beforePos = await getPositionCursor(ctx.client);
      const fillTx = new Transaction();
      fillOrder(ctx.client, fillTx, { orderId: orderId!, filledShares: 1n, filledCost: 1n });
      const result = await executeAndFetch(ctx.client, ctx.keeper, fillTx);
      const ev = expectEvent(result, EVENT_CONTRACT.OrderFilled.suffix, {
        order_id: String(orderId),
        filled_shares: "1",
        filled_cost: "1",
      });
      expectEventShape(ev, EVENT_CONTRACT.OrderFilled);
      expect(BigInt(String(ev.json.position_id))).toBe(orderId);

      const afterPos = await getPositionCursor(ctx.client);
      expect(afterPos.count).toBeGreaterThan(beforePos.count);
    },
    180_000,
  );

  it.skipIf(false)(
    "keeper cancelOrder emits OrderCancelled with refund",
    async (testCtx) => {
      if (!ctx.keeper) {
        testCtx.skip(true, "no keeper key registered (E2E_KEEPER_PRIVATE_KEY)");
        return;
      }
      // Place a fresh order to cancel via keeper path.
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
      expect(orderId).toBeDefined();

      const cancelTx = new Transaction();
      cancelOrder(ctx.client, cancelTx, { orderId: orderId! });
      const result = await executeAndFetch(ctx.client, ctx.keeper, cancelTx);
      const cancelEv = expectEvent(result, EVENT_CONTRACT.OrderCancelled.suffix, {
        order_id: String(orderId),
        refund_amount: "1000",
      });
      expectEventShape(cancelEv, EVENT_CONTRACT.OrderCancelled);
    },
    180_000,
  );
});

// Reference imports to satisfy bundler when this file is loaded directly.
void hexToBytes;
