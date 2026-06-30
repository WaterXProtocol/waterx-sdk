import type { OrderView, PositionView } from "~predict/types.ts";
import { describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import {
  assertOrderFilledEventMatchesPositionView,
  assertOrderPlacedEventMatchesOrderView,
  normalizeEventMarketIdHex,
} from "../helpers/journey-event-assertions.ts";

const ORDER: OrderView = {
  orderId: 42n,
  kind: "OPEN",
  accountId: `0x${"a".repeat(64)}`,
  // Distinct from accountId (bet-sharing) so the assertion actually verifies the
  // event's receiver_account_id is matched against receiverAccountId, not accountId.
  receiverAccountId: `0x${"c".repeat(64)}`,
  marketId: new Uint8Array(Buffer.from("pred-e2e-open-v1", "utf8")),
  marketIdHex: `0x${Buffer.from("pred-e2e-open-v1", "utf8").toString("hex")}`,
  selection: "YES",
  positionId: null,
  maxSpend: 1_000n,
  minShares: 1n,
  priceCapBps: 10_000n,
  minProceeds: 0n,
  expiryTs: 9_999_999_999_999n,
  selfCancelAfterTs: 0n,
  createdTs: 1n,
  byAdmin: false,
};

const POSITION: PositionView = {
  positionId: 7n,
  accountId: ORDER.accountId,
  marketId: ORDER.marketId,
  marketIdHex: ORDER.marketIdHex,
  selection: "YES",
  status: "OPEN",
  filledShares: 1n,
  filledCost: 1n,
  openedTs: 2n,
  payout: 0n,
  closeOrderId: null,
  closeMinProceeds: 0n,
  closeExpiryTs: 0n,
  closeSelfCancelAfterTs: 0n,
};

describe("journey-event-assertions", () => {
  it("normalizeEventMarketIdHex accepts utf8 label bytes as hex", () => {
    expect(normalizeEventMarketIdHex(ORDER.marketIdHex)).toBe(ORDER.marketIdHex);
  });

  it("assertOrderPlacedEventMatchesOrderView", () => {
    assertOrderPlacedEventMatchesOrderView(
      {
        type: "0x1::events::OrderPlaced",
        json: {
          market_registry_id: `0x${"b".repeat(64)}`,
          order_id: "42",
          account_id: ORDER.accountId,
          receiver_account_id: ORDER.receiverAccountId,
          market_id: ORDER.marketIdHex,
          selection: "YES",
          max_spend: "1000",
          min_shares: "1",
          price_cap: "10000",
          expiry_ts: "9999999999999",
          self_cancel_after_ts: "0",
          by_admin: false,
        },
      },
      ORDER,
    );
  });

  it("assertOrderFilledEventMatchesPositionView without order id lock (bypass)", () => {
    assertOrderFilledEventMatchesPositionView(
      {
        type: "0x1::events::OrderFilled",
        json: {
          market_registry_id: `0x${"b".repeat(64)}`,
          order_id: "99",
          position_id: "7",
          filled_shares: "1",
          filled_cost: "1",
        },
      },
      POSITION,
    );
  });

  it("rejects OrderPlaced missing account_id", () => {
    expect(() =>
      assertOrderPlacedEventMatchesOrderView(
        {
          type: "0x1::events::OrderPlaced",
          json: {
            market_registry_id: `0x${"b".repeat(64)}`,
            order_id: "42",
            receiver_account_id: ORDER.receiverAccountId,
            market_id: ORDER.marketIdHex,
            selection: "YES",
            max_spend: "1000",
            min_shares: "1",
            price_cap: "10000",
            expiry_ts: "1",
            self_cancel_after_ts: "0",
            by_admin: false,
          },
        },
        ORDER,
      ),
    ).toThrow();
    void EVENT_CONTRACT;
  });
});
