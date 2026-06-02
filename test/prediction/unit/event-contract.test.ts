import { describe, expect, it } from "vitest";

import { EVENT_CONTRACT } from "../contract/event-fields.ts";
import { expectEventShape, normalizeEnumField } from "../helpers/events.ts";

describe("event contract helpers", () => {
  it("EVENT_CONTRACT covers all Move event payloads (15 types; 14 indexer handlers)", () => {
    expect(Object.keys(EVENT_CONTRACT)).toHaveLength(15);
  });

  it("expectEventShape rejects missing required fields", () => {
    expect(() =>
      expectEventShape(
        {
          type: "0x1::events::OrderPlaced",
          json: {
            market_registry_id: `0x${"a".repeat(64)}`,
            order_id: "1",
            market_id: "0x01",
            selection: "YES",
            max_spend: "1",
            min_shares: "1",
            price_cap: "1",
            expiry_ts: "1",
            self_cancel_after_ts: "1",
            by_admin: false,
          },
        },
        EVENT_CONTRACT.OrderPlaced,
      ),
    ).toThrow(/missing account_id/);
  });

  it("normalizeEnumField accepts string and object enum wire shapes", () => {
    expect(normalizeEnumField("YES")).toBe("YES");
    expect(normalizeEnumField({ Yes: true })).toBe("YES");
  });
});
